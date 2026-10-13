const LINK_PREFIX = "maotai-auth-linked";

function authUserOf(data) {
  if (!data || typeof data !== "object") return null;
  const row = data.user && typeof data.user === "object" ? data.user : data;
  const id = String(row.id || row.user_id || row.userId || row.sub || "").trim();
  if (!id) return null;
  const email = typeof row.email === "string" ? row.email.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return { id, email, name, username: email || name || id };
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

export function createAccountClient(app = "scratch") {
  const game = app === "tank" ? "tank" : "scratch";

  function loginHref() {
    return `/api/auth/login?return=${encodeURIComponent(location.href)}`;
  }

  async function request(path, body) {
    const response = await fetch(`/api/account${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "请求失败");
    return data;
  }

  async function linkOnce(user) {
    const mark = `${LINK_PREFIX}:${game}:${user.id}`;
    try {
      if (localStorage.getItem(mark) === "1") return;
    } catch { /* still try */ }
    const response = await fetch("/api/auth/link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: game, external_user_id: user.id })
    });
    if (!response.ok) return;
    try { localStorage.setItem(mark, "1"); } catch { /* ignore */ }
  }

  return {
    loginHref,
    redirectLogin() {
      location.assign(loginHref());
    },
    async current() {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const type = response.headers.get("content-type") || "";
      if (response.status !== 200 || !type.includes("json")) return null;
      const user = authUserOf(await response.json().catch(() => null));
      if (!user) return null;
      await linkOnce(user);
      return user;
    },
    async logout() {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    },
    async load() {
      return request("/load", {});
    },
    async save(save) {
      let prev = null;
      try {
        const current = await request("/load", {});
        prev = current.save;
      } catch { /* still write the incoming slice */ }
      await request("/save", { save: mergeAccountSave(prev, save) });
    },
    async ticketStatus(ticketId) {
      const key = String(ticketId || "").trim();
      if (!/^[a-z0-9-]{2,32}$/.test(key)) throw new Error("奖票不对");
      try {
        const data = await request("/ticket-status", { ticket: key });
        const issued = Math.max(0, Number(data.issued) || 0);
        if (Number.isFinite(issued)) {
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
          return String(data.serial).replace(/\D/g, "").padStart(5, "0");
        }
      } catch (err) {
        const message = String(err?.message || "");
        if (message.includes("售罄") || message.includes("奖票不对")) throw err;
        let remote = false;
        try {
          const ping = await fetch("/api/account/ping", { method: "GET" });
          remote = ping.ok;
        } catch { remote = false; }
        if (/maotaiworks\.com$/i.test(location.hostname) || remote) {
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
    }
  };
}
