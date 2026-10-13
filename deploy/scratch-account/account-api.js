import fs from "node:fs";
import path from "node:path";

const AUTH_ME = "http://127.0.0.1:3196/api/auth/me";

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

function authUserOf(data) {
  if (!data || typeof data !== "object") return null;
  const row = data.user && typeof data.user === "object" ? data.user : data;
  const id = String(row.id || row.user_id || row.userId || row.sub || "").trim();
  if (!id || id.length > 128 || /[\u0000-\u001f]/.test(id)) return null;
  const email = typeof row.email === "string" ? row.email.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return { id, email, name, username: email || name || id };
}

async function userFromCookie(req) {
  const cookie = req.headers.cookie;
  if (!cookie || typeof cookie !== "string") return null;
  const response = await fetch(AUTH_ME, {
    headers: { cookie, accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(4000)
  });
  const type = response.headers.get("content-type") || "";
  if (response.status !== 200 || !type.includes("json")) return null;
  return authUserOf(await response.json().catch(() => null));
}

export function createAccountMiddleware(rootDir) {
  const dataDir = path.join(rootDir, "data");
  const savesPath = path.join(dataDir, "saves.json");
  const serialPath = path.join(dataDir, "serials.json");
  let serialQueue = Promise.resolve();
  let saveQueue = Promise.resolve();

  function loadJson(file, fallback) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return raw && typeof raw === "object" ? raw : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(file, data) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, file);
  }

  function peekTicketIssued(ticketId) {
    const job = serialQueue.then(() => Math.max(0, Number(loadJson(serialPath, {})[ticketId]) || 0));
    serialQueue = job.then(() => {}, () => {});
    return job;
  }

  function nextTicketSerial(ticketId) {
    const job = serialQueue.then(() => {
      const db = loadJson(serialPath, {});
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
      writeJson(serialPath, db);
      return String(next).padStart(5, "0");
    });
    serialQueue = job.then(() => {}, () => {});
    return job;
  }

  function asSaveBundle(save) {
    if (!save || typeof save !== "object" || Array.isArray(save)) return {};
    if ("scratch" in save || "tank" in save) return { ...save };
    return { scratch: save };
  }

  function mergeAccountSave(prev, incoming) {
    const base = asSaveBundle(prev);
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return base;
    if ("scratch" in incoming || "tank" in incoming) return { ...base, ...incoming };
    return { ...base, scratch: incoming };
  }

  function withSaves(fn) {
    const job = saveQueue.then(fn);
    saveQueue = job.then(() => {}, () => {});
    return job;
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

      if (route === "/api/account/load" || route === "/api/account/save") {
        const user = await userFromCookie(req);
        if (!user) {
          json(res, 401, { error: "请重新登录" });
          return true;
        }
        if (route === "/api/account/load") {
          const row = await withSaves(() => {
            const db = loadJson(savesPath, { users: {} });
            return db.users?.[user.id] || null;
          });
          json(res, 200, {
            id: user.id,
            username: user.username,
            email: user.email,
            save: row?.save || null
          });
          return true;
        }
        await withSaves(() => {
          const db = loadJson(savesPath, { users: {} });
          const users = db.users && typeof db.users === "object" ? db.users : {};
          const prev = users[user.id]?.save || null;
          users[user.id] = {
            id: user.id,
            save: mergeAccountSave(prev, payload.save),
            updatedAt: Date.now()
          };
          writeJson(savesPath, { users });
        });
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
