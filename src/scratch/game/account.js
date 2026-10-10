const SESSION_KEY = "scratch-gallery-session";
const VAULT_KEY = "scratch-gallery-accounts";

function nameKey(name) {
  return String(name || "").trim().toLocaleLowerCase();
}

function loadVault() {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) || "null") || { users: {} };
  } catch {
    return { users: {} };
  }
}

function saveVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hashPassword(password, saltBytes) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function writeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function asSaveBundle(save) {
  if (!save || typeof save !== "object") return {};
  if ("scratch" in save || "tank" in save) return { ...save };
  return { scratch: save };
}

export function mergeAccountSave(prev, incoming) {
  const base = asSaveBundle(prev);
  if (!incoming || typeof incoming !== "object") return base;
  if ("scratch" in incoming || "tank" in incoming) return { ...base, ...incoming };
  return { ...base, scratch: incoming };
}

export function gameSaveOf(save, game) {
  if (!save || typeof save !== "object") return null;
  if ("scratch" in save || "tank" in save) return save[game] || null;
  return game === "scratch" ? save : null;
}

export function createAccountClient() {
  let remote = null;

  async function probe() {
    if (remote !== null) return remote;
    try {
      const response = await fetch("/api/account/ping", { method: "GET" });
      remote = response.ok;
    } catch {
      remote = false;
    }
    return remote;
  }

  async function request(path, body) {
    const response = await fetch(`/api/account${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "请求失败");
    return data;
  }

  function findLocalUser(vault, login) {
    const raw = String(login || "").trim();
    if (!raw) return null;
    if (raw.includes("@")) {
      const key = nameKey(raw);
      return Object.values(vault.users).find((entry) => nameKey(entry.email) === key) || null;
    }
    return vault.users[nameKey(raw)] || null;
  }

  async function localLogin(username, password) {
    const vault = loadVault();
    const user = findLocalUser(vault, username);
    if (!user) throw new Error("账号或密码不对");
    const hash = await hashPassword(password, hexToBytes(user.salt));
    if (bytesToHex(hash) !== user.hash) throw new Error("账号或密码不对");
    user.token = randomToken();
    saveVault(vault);
    return { username: user.username, email: user.email || "", token: user.token, save: user.save || null };
  }

  async function localLoad(token) {
    const vault = loadVault();
    const user = Object.values(vault.users).find((entry) => entry.token === token);
    if (!user) throw new Error("请重新登录");
    return { username: user.username, token: user.token, save: user.save || null };
  }

  async function localSave(token, save) {
    const vault = loadVault();
    const user = Object.values(vault.users).find((entry) => entry.token === token);
    if (!user) throw new Error("请重新登录");
    user.save = mergeAccountSave(user.save, save);
    saveVault(vault);
  }

  async function localLogout(token) {
    const vault = loadVault();
    const user = Object.values(vault.users).find((entry) => entry.token === token);
    if (user) {
      user.token = randomToken();
      saveVault(vault);
    }
  }

  return {
    restore() {
      return readSession();
    },
    async sendCode(username, email, password) {
      if (!(await probe())) throw new Error("需要游戏服务器才能发送邮箱验证码");
      return request("/send-code", { username: String(username || "").trim(), email, password });
    },
    async register(username, password, save, extra = {}) {
      if (!(await probe())) throw new Error("需要游戏服务器才能完成邮箱注册");
      const data = await request("/register", {
        username: String(username || "").trim(),
        password,
        save,
        email: extra.email,
        code: extra.code
      });
      writeSession({ username: data.username, token: data.token });
      return data;
    },
    async login(username, password) {
      const name = String(username || "").trim();
      const data = await probe()
        ? await request("/login", { username: name, password })
        : await localLogin(name, password);
      writeSession({ username: data.username, token: data.token });
      return data;
    },
    async load(token) {
      return await probe() ? await request("/load", { token }) : await localLoad(token);
    },
    async save(token, save) {
      if (await probe()) {
        let prev = null;
        try {
          const current = await request("/load", { token });
          prev = current.save;
        } catch { /* still write */ }
        await request("/save", { token, save: mergeAccountSave(prev, save) });
      } else {
        await localSave(token, save);
      }
    },
    async ticketStatus(ticketId) {
      const key = String(ticketId || "").trim();
      if (!/^[a-z0-9-]{2,32}$/.test(key)) throw new Error("奖票不对");
      try {
        const data = await request("/ticket-status", { ticket: key });
        const issued = Math.max(0, Number(data.issued) || 0);
        if (Number.isFinite(issued)) {
          remote = true;
          return { issued, remaining: Math.max(0, 10000 - issued), edition: 10000 };
        }
      } catch {
        /* old servers have no peek route; remaining still updates on first scratch */
      }
      let db = {};
      try { db = JSON.parse(localStorage.getItem("scratch-gallery-editions") || "{}") || {}; } catch { db = {}; }
      const issued = Math.max(0, Number(db[key]) || 0);
      return { issued, remaining: Math.max(0, 10000 - issued), edition: 10000 };
    },
    async nextTicketSerial(ticketId) {
      const key = String(ticketId || "").trim();
      if (!/^[a-z0-9-]{2,32}$/.test(key)) throw new Error("奖票不对");
      try {
        const data = await request("/ticket", { ticket: key });
        if (data.serial) {
          remote = true;
          return String(data.serial).replace(/\D/g, "").padStart(5, "0");
        }
      } catch (err) {
        const message = String(err?.message || "");
        if (message.includes("售罄") || message.includes("奖票不对")) throw err;
        if (/maotaiworks\.com$/i.test(location.hostname) || await probe()) {
          throw err instanceof Error ? err : new Error("彩票号领取失败，请再试一次");
        }
      }
      let db = {};
      try { db = JSON.parse(localStorage.getItem("scratch-gallery-editions") || "{}") || {}; } catch { db = {}; }
      const next = (Number(db[key]) || 0) + 1;
      if (next > 10000) throw new Error("本奖票已售罄，发行上限 10000 张");
      db[key] = next;
      localStorage.setItem("scratch-gallery-editions", JSON.stringify(db));
      return String(next).padStart(5, "0");
    },
    async logout(token) {
      try {
        if (await probe()) await request("/logout", { token });
        else await localLogout(token);
      } catch { /* still drop local session */ }
      writeSession(null);
    }
  };
}
