import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sendVerifyCode } from "./mail.js";

const NAME_RE = /^[\u4e00-\u9fffA-Za-z0-9_]{2,16}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const CODE_RE = /^\d{6}$/;
const CODE_TTL = 10 * 60 * 1000;
const CODE_COOLDOWN = 60 * 1000;
const CODE_TRIES = 5;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function nameKey(name) {
  return String(name || "").trim().toLocaleLowerCase();
}

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function verifyPassword(password, saltHex, hashHex) {
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

function hashCode(code, saltHex = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${saltHex}:${code}`).digest("hex");
  return { codeSalt: saltHex, codeHash: hash };
}

function verifyCode(code, saltHex, hashHex) {
  const next = Buffer.from(hashCode(code, saltHex).codeHash, "hex");
  const expected = Buffer.from(hashHex, "hex");
  return next.length === expected.length && timingSafeEqual(next, expected);
}

function validateMailPass(password, email) {
  if (password.length < 6 || password.length > 32) return "密码需为 6–32 位";
  if (!EMAIL_RE.test(email) || email.length > 64) return "请填写正确的邮箱";
  return null;
}

function usernameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  let base = local.replace(/[^\u4e00-\u9fffA-Za-z0-9_]/g, "");
  if (base.length > 16) base = base.slice(0, 16);
  if (base.length < 2 || !NAME_RE.test(base)) base = `p${randomInt(1000, 9999)}`;
  return base;
}

function allocateUsername(db, email, requested) {
  const wanted = String(requested || "").trim();
  if (wanted) {
    if (!NAME_RE.test(wanted)) return { error: "账号需为 2–16 个字，可用中文、字母或数字" };
    if (db.users[nameKey(wanted)]) return { error: "这个账号已经有人用了" };
    return { username: wanted };
  }
  const base = usernameFromEmail(email);
  if (!db.users[nameKey(base)]) return { username: base };
  for (let i = 2; i < 1000; i++) {
    const suffix = String(i);
    const name = `${base.slice(0, Math.max(1, 16 - suffix.length))}${suffix}`;
    if (NAME_RE.test(name) && !db.users[nameKey(name)]) return { username: name };
  }
  return { error: "这个账号已经有人用了" };
}

export function createAccountMiddleware(rootDir) {
  const dataDir = path.join(rootDir, "data");
  const dbPath = path.join(dataDir, "accounts.json");

  function loadDb() {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      return { users: db.users || {}, pending: db.pending || {} };
    } catch {
      return { users: {}, pending: {} };
    }
  }

  function saveDb(db) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temp = `${dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(db));
    fs.renameSync(temp, dbPath);
  }

  const serialPath = path.join(dataDir, "serials.json");
  let serialQueue = Promise.resolve();

  function loadSerials() {
    try {
      const raw = JSON.parse(fs.readFileSync(serialPath, "utf8"));
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveSerials(db) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temp = `${serialPath}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(db));
    fs.renameSync(temp, serialPath);
  }

  function peekTicketIssued(ticketId) {
    const job = serialQueue.then(() => {
      const db = loadSerials();
      return Math.max(0, Number(db[ticketId]) || 0);
    });
    serialQueue = job.then(() => {}, () => {});
    return job;
  }

  function nextTicketSerial(ticketId) {
    const job = serialQueue.then(() => {
      const db = loadSerials();
      const next = (Number(db[ticketId]) || 0) + 1;
      if (!Number.isSafeInteger(next) || next < 1) {
        const err = new Error("彩票号暂时发不出去");
        err.expose = true;
        throw err;
      }
      if (next > 10000) {
        const err = new Error("本奖票已售罄，发行上限 10000 张");
        err.expose = true;
        throw err;
      }
      db[ticketId] = next;
      saveSerials(db);
      return String(next).padStart(5, "0");
    });
    serialQueue = job.then(() => {}, () => {});
    return job;
  }

  function publicUser(user) {
    return { username: user.username, email: user.email || "", token: user.token, save: user.save || null };
  }

  function asSaveBundle(save) {
    if (!save || typeof save !== "object") return {};
    if ("scratch" in save || "tank" in save) return { ...save };
    return { scratch: save };
  }

  function mergeAccountSave(prev, incoming) {
    const base = asSaveBundle(prev);
    if (!incoming || typeof incoming !== "object") return base;
    if ("scratch" in incoming || "tank" in incoming) return { ...base, ...incoming };
    return { ...base, scratch: incoming };
  }

  function findByToken(db, token) {
    if (!token) return null;
    return Object.values(db.users).find((user) => user.token === token) || null;
  }

  function findByEmail(db, email) {
    const key = emailKey(email);
    if (!key) return null;
    return Object.values(db.users).find((user) => emailKey(user.email) === key) || null;
  }

  function findByLogin(db, login) {
    const raw = String(login || "").trim();
    if (!raw) return null;
    if (raw.includes("@")) return findByEmail(db, raw);
    return db.users[nameKey(raw)] || null;
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const route = url.pathname.replace(/\/+$/, "") || "/";
    if (!route.startsWith("/api/account")) return false;

    if (req.method === "GET" && route === "/api/account/ping") {
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method !== "POST") {
      json(res, 405, { error: "不支持的请求" });
      return true;
    }

    let payload = {};
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      json(res, 400, { error: "请求格式不对" });
      return true;
    }

    const db = loadDb();
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");
    const token = String(payload.token || "");
    const email = emailKey(payload.email);
    const code = String(payload.code || "").trim();

    try {
      if (route === "/api/account/ticket" || route === "/api/account/ticket-status") {
        const ticketId = String(payload.ticket || "").trim();
        if (!/^[a-z0-9-]{2,32}$/.test(ticketId)) {
          json(res, 400, { error: "奖票不对" });
          return true;
        }
        if (route === "/api/account/ticket-status") {
          const issued = await peekTicketIssued(ticketId);
          json(res, 200, { issued, remaining: Math.max(0, 10000 - issued), edition: 10000, ticket: ticketId });
          return true;
        }
        const serial = await nextTicketSerial(ticketId);
        json(res, 200, { serial, ticket: ticketId, issued: Number(serial), edition: 10000 });
        return true;
      }

      if (route === "/api/account/send-code") {
        const invalid = validateMailPass(password, email);
        if (invalid) {
          json(res, 400, { error: invalid });
          return true;
        }
        if (findByEmail(db, email)) {
          json(res, 409, { error: "这个邮箱已经注册过了" });
          return true;
        }
        const allocated = allocateUsername(db, email, username);
        if (allocated.error) {
          json(res, allocated.error.includes("已经") ? 409 : 400, { error: allocated.error });
          return true;
        }
        const accountName = allocated.username;
        const pending = db.pending[email];
        if (pending && Date.now() - pending.sentAt < CODE_COOLDOWN) {
          json(res, 429, { error: "验证码刚发过，请稍后再获取" });
          return true;
        }
        const verify = String(randomInt(0, 1_000_000)).padStart(6, "0");
        const secret = hashPassword(password);
        const codeSecret = hashCode(verify);
        await sendVerifyCode(rootDir, { email, username: accountName, code: verify });
        db.pending[email] = {
          username: accountName,
          email,
          salt: secret.salt,
          hash: secret.hash,
          codeSalt: codeSecret.codeSalt,
          codeHash: codeSecret.codeHash,
          expires: Date.now() + CODE_TTL,
          sentAt: Date.now(),
          tries: 0
        };
        saveDb(db);
        json(res, 200, { ok: true, username: accountName });
        return true;
      }

      if (route === "/api/account/register") {
        const invalid = validateMailPass(password, email);
        if (invalid) {
          json(res, 400, { error: invalid });
          return true;
        }
        if (!CODE_RE.test(code)) {
          json(res, 400, { error: "请填写 6 位邮箱验证码" });
          return true;
        }
        const pending = db.pending[email];
        if (!pending || pending.expires < Date.now()) {
          json(res, 400, { error: "请先获取邮箱验证码" });
          return true;
        }
        const accountName = username || pending.username;
        if (pending.username !== accountName) {
          json(res, 400, { error: "请使用获取验证码时填写的账号" });
          return true;
        }
        if (!verifyPassword(password, pending.salt, pending.hash)) {
          json(res, 400, { error: "请使用获取验证码时填写的密码" });
          return true;
        }
        if (pending.tries >= CODE_TRIES) {
          delete db.pending[email];
          saveDb(db);
          json(res, 400, { error: "验证码已失效，请重新获取" });
          return true;
        }
        pending.tries += 1;
        if (!verifyCode(code, pending.codeSalt, pending.codeHash)) {
          saveDb(db);
          json(res, 400, { error: "验证码不对" });
          return true;
        }
        if (db.users[nameKey(accountName)] || findByEmail(db, email)) {
          delete db.pending[email];
          saveDb(db);
          json(res, 409, { error: "这个账号或邮箱已经有人用了" });
          return true;
        }
        const user = {
          username: accountName,
          email,
          salt: pending.salt,
          hash: pending.hash,
          token: randomBytes(24).toString("hex"),
          save: mergeAccountSave(null, payload.save),
          createdAt: Date.now()
        };
        db.users[nameKey(accountName)] = user;
        delete db.pending[email];
        saveDb(db);
        json(res, 200, publicUser(user));
        return true;
      }

      if (route === "/api/account/login") {
        const user = findByLogin(db, username);
        if (!user || !verifyPassword(password, user.salt, user.hash)) {
          json(res, 401, { error: "账号或密码不对" });
          return true;
        }
        user.token = randomBytes(24).toString("hex");
        saveDb(db);
        json(res, 200, publicUser(user));
        return true;
      }

      if (route === "/api/account/logout") {
        const user = findByToken(db, token);
        if (user) {
          user.token = randomBytes(24).toString("hex");
          saveDb(db);
        }
        json(res, 200, { ok: true });
        return true;
      }

      if (route === "/api/account/load") {
        const user = findByToken(db, token);
        if (!user) {
          json(res, 401, { error: "请重新登录" });
          return true;
        }
        json(res, 200, publicUser(user));
        return true;
      }

      if (route === "/api/account/save") {
        const user = findByToken(db, token);
        if (!user) {
          json(res, 401, { error: "请重新登录" });
          return true;
        }
        user.save = mergeAccountSave(user.save, payload.save);
        saveDb(db);
        json(res, 200, { ok: true });
        return true;
      }

      json(res, 404, { error: "找不到接口" });
    } catch (err) {
      json(res, err?.expose ? 503 : 500, { error: err?.expose ? err.message : "账号服务暂时不可用" });
    }
    return true;
  }

  return (req, res, next) => {
    const url = req.url || "";
    if (!url.startsWith("/api/account")) {
      next();
      return;
    }
    void handle(req, res).then((handled) => {
      if (!handled) next();
    }).catch(() => json(res, 500, { error: "账号服务暂时不可用" }));
  };
}
