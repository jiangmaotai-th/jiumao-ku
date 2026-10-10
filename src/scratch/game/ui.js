import { countryCatalog, ICONS, MODES, modesForCountry, rtp, ticketSeries } from "./data.js";
import { countryLabel, displayMode, formatCoins, g, gameError, mechanicText, modeHelpText, rarityLabel, tierLabel } from "./i18n.js";

export function createUI({ shell, renderer, assets, onMode, onCountry, onNext, onSound, onRelief, onCoinArrive, onExportSave, onImportSave, onLogin, onRegister, onSendCode, onLogout, onGuest }) {
  const coinValue = shell.querySelector("[data-coins]");
  const coinBadge = shell.querySelector(".coin-badge");
  const coinMark = shell.querySelector(".coin-mark");
  const topBar = shell.querySelector(".top-bar");
  const flyLayer = shell.querySelector("[data-coin-fly]");
  const modeTitle = shell.querySelector("[data-mode-title]");
  const modeCountry = shell.querySelector("[data-mode-country]");
  const nextButton = shell.querySelector("[data-next]");
  const prevButton = shell.querySelector("[data-prev]");
  const nextModeButton = shell.querySelector("[data-next-mode]");
  const modesButton = shell.querySelector("[data-modes]");
  const progress = shell.querySelector("[data-progress]");
  const toast = shell.querySelector(".toast");
  const overlay = shell.querySelector(".overlay-host");
  const accountBtn = shell.querySelector("[data-account]");
  const soundBtn = shell.querySelector("[data-sound]");
  let toastTimer;
  let heldCoins = null;
  let codeCooldownUntil = 0;
  let codeTimer;

  function paintCoins(value) {
    const shown = formatCoins(value);
    coinValue.textContent = shown;
    overlay.querySelectorAll("[data-shop-coins]").forEach((el) => {
      el.textContent = shown;
    });
  }

  const setState = ({ coins, collected, stubs = [], mode, settled, scratchProgress = 0, switchLocked = false }) => {
    paintCoins(heldCoins ?? coins);
    const shown = displayMode(mode);
    modeTitle.textContent = shown.title;
    modeCountry.textContent = g("modeMeta", { flag: mode.flag, cost: mode.cost });
    nextButton.disabled = !settled;
    nextButton.querySelector(".control-label").textContent = settled ? g("playAgain", { cost: mode.cost }) : g("scratching");
    progress.style.setProperty("--progress", `${Math.min(1, scratchProgress) * 100}%`);
    prevButton?.classList.toggle("is-locked", switchLocked);
    nextModeButton?.classList.toggle("is-locked", switchLocked);
    modesButton?.classList.toggle("is-locked", switchLocked);
    prevButton?.setAttribute("aria-disabled", switchLocked ? "true" : "false");
    nextModeButton?.setAttribute("aria-disabled", switchLocked ? "true" : "false");
    modesButton?.setAttribute("aria-disabled", switchLocked ? "true" : "false");
    paintRailState(mode, collected, switchLocked);
  };

  function showToast(message, tone = "normal") {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function closeOverlay() {
    overlay.replaceChildren();
    overlay.hidden = true;
    topBar.classList.remove("coin-catch");
    flyLayer.replaceChildren();
  }

  function holdCoins(value) {
    heldCoins = value;
    paintCoins(value);
  }

  function releaseCoins(value) {
    heldCoins = null;
    if (Number.isFinite(value)) paintCoins(value);
  }

  function flyCoins({ fromEl, gained, walletAfter }) {
    return new Promise((resolve) => {
      const startRect = (fromEl || overlay).getBoundingClientRect();
      const destRect = (coinMark || coinBadge).getBoundingClientRect();
      const sx = startRect.left + startRect.width / 2;
      const sy = startRect.top + startRect.height / 2;
      const ex = destRect.left + destRect.width / 2;
      const ey = destRect.top + destRect.height / 2;
      const count = Math.min(16, Math.max(8, Math.round(6 + Math.log10(Math.max(1, gained)) * 5)));
      const before = walletAfter - gained;
      holdCoins(before);
      topBar.classList.add("coin-catch");
      let arrived = 0;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        flyLayer.replaceChildren();
        releaseCoins(walletAfter);
        coinBadge.classList.remove("coin-pulse");
        resolve();
      };
      for (let i = 0; i < count; i++) {
        const coin = document.createElement("span");
        coin.className = "fly-coin";
        coin.textContent = "◈";
        const jitterX = (Math.random() - .5) * 56;
        const jitterY = (Math.random() - .5) * 28;
        coin.style.left = `${sx + jitterX}px`;
        coin.style.top = `${sy + jitterY}px`;
        flyLayer.appendChild(coin);
        const delay = 40 + i * 48;
        const duration = 680 + Math.random() * 220;
        const arcX = (ex - (sx + jitterX)) * .45 + (Math.random() - .5) * 90;
        const arcY = Math.min(sy, ey) - sy - 70 - Math.random() * 90;
        coin.animate([
          { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
          { transform: "translate(-50%, -50%) scale(1.12)", opacity: 1, offset: .12 },
          { transform: `translate(calc(-50% + ${arcX}px), calc(-50% + ${arcY}px)) scale(1.05)`, opacity: 1, offset: .48 },
          { transform: `translate(calc(-50% + ${ex - sx - jitterX}px), calc(-50% + ${ey - sy - jitterY}px)) scale(.42)`, opacity: .9 }
        ], { duration, delay, easing: "cubic-bezier(.2,.72,.18,1)", fill: "forwards" });
        window.setTimeout(() => {
          arrived += 1;
          holdCoins(Math.round(before + gained * (arrived / count)));
          coinBadge.classList.remove("coin-pulse");
          void coinBadge.offsetWidth;
          coinBadge.classList.add("coin-pulse");
          if (arrived % 2 === 1) onCoinArrive?.();
          coin.remove();
          if (arrived >= count) done();
        }, delay + duration);
      }
      window.setTimeout(done, 40 + count * 48 + 980);
    });
  }

  function confettiBits(count) {
    const colors = ["#ffd76d", "#ff5b4a", "#fff4c4", "#3ecf8e", "#5aa8ff", "#ff8ad4", "#ffe08a"];
    return Array.from({ length: count }, (_, i) => {
      const left = ((i * 37) % 100) + Math.random() * 4;
      const delay = (i % 12) * 0.08 + Math.random() * 0.2;
      const duration = 1.8 + Math.random() * 1.6;
      const size = 6 + Math.random() * 8;
      const color = colors[i % colors.length];
      return `<i class="confetti-bit" style="left:${left}%;animation-delay:${delay}s;animation-duration:${duration}s;width:${size}px;height:${size * (i % 3 ? 1.6 : .55)}px;background:${color}"></i>`;
    }).join("");
  }

  function openResult({ win, jackpot, big, title, prize = 0, bonus = 0, detail, tier, gained = 0, walletAfter = 0, onContinue }) {
    overlay.hidden = false;
    if (win) {
      topBar.classList.add("coin-catch");
      if (gained > 0 && walletAfter > 0) holdCoins(walletAfter - gained);
      const rank = jackpot ? "jackpot" : big ? "big" : "win";
      overlay.innerHTML = `
        <div class="overlay result-overlay win-overlay rank-${rank}" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="confetti-layer" aria-hidden="true">${confettiBits(jackpot ? 48 : big ? 38 : 30)}</div>
          <div class="win-glow" aria-hidden="true"></div>
          <section class="win-card">
            <div class="win-lanterns" aria-hidden="true"><span></span><span></span></div>
            <p class="win-kicker">${jackpot ? g("winJackpot") : big ? g("winBig") : g("winNorm")}</p>
            <h2>${title}</h2>
            ${tier ? `<p class="win-tier">${tierLabel(tier)}</p>` : ""}
            <strong class="win-prize" data-prize>0</strong>
            <small class="win-unit">${g("gold")}</small>
            ${detail ? `<p class="win-detail">${detail}</p>` : ""}
            ${bonus ? `<p class="win-bonus">${g("albumBonus", { n: bonus })}</p>` : ""}
            <button class="control-btn primary win-claim" data-claim><span class="control-label">${g("claimPrize")}</span></button>
          </section>
        </div>`;
      const prizeEl = overlay.querySelector("[data-prize]");
      const start = performance.now();
      const duration = jackpot ? 1100 : 850;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        prizeEl.textContent = `+${formatCoins(Math.round(prize * eased))}`;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else {
      overlay.innerHTML = `
        <div class="overlay result-overlay miss-overlay" role="dialog" aria-modal="true" aria-label="${title}">
          <section class="miss-card">
            <div class="miss-seal" aria-hidden="true">${g("missSeal")}</div>
            <h2>${title}</h2>
            <p>${detail || g("missDefault")}</p>
            <button class="control-btn miss-dismiss" data-claim><span class="control-label">${g("missRetry")}</span></button>
          </section>
        </div>`;
    }
    let closing = false;
    const finish = () => {
      if (closing) return;
      closing = true;
      const claim = overlay.querySelector("[data-claim]");
      if (claim) claim.disabled = true;
      const run = win && gained > 0
        ? flyCoins({ fromEl: overlay.querySelector("[data-prize]"), gained, walletAfter })
        : Promise.resolve();
      void run.then(() => {
        closeOverlay();
        onContinue?.();
      });
    };
    overlay.querySelector("[data-claim]").addEventListener("click", finish);
    overlay.querySelector(".overlay").addEventListener("pointerdown", (event) => {
      if (event.target === event.currentTarget) finish();
    });
  }

  function openPanel(title, body, afterOpen, options = {}) {
    const locked = Boolean(options.locked);
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay" role="dialog" aria-modal="true" aria-label="${title}">
        <section class="museum-panel">
          <header class="panel-head"><h2>${title}</h2>${locked ? "" : `<button class="icon-btn close-btn" aria-label="${g("close")}">×</button>`}</header>
          <div class="panel-body">${body}</div>
        </section>
      </div>`;
    if (!locked) {
      const dismiss = () => {
        closeOverlay();
        options.onClose?.();
      };
      overlay.querySelector(".close-btn").addEventListener("click", dismiss);
      overlay.querySelector(".overlay").addEventListener("pointerdown", (event) => {
        if (event.target === event.currentTarget) dismiss();
      });
    }
    afterOpen?.(overlay);
  }

  function modeButton(mode, currentMode) {
    const shown = displayMode(mode);
    return `<button class="mode-option ${mode.id === currentMode?.id ? "selected" : ""}" data-mode="${mode.id}">
        <span class="country-medal">${mode.flag}</span>
        <span class="mode-copy"><b>${shown.title}</b><small>${shown.subtitle}</small></span>
        <span class="mode-price">${mode.cost}<small>${g("gold")}</small></span>
      </button>`;
  }

  function openModes(currentMode) {
    const country = currentMode?.country;
    const modes = modesForCountry(country);
    const body = `<p class="mode-hint">${g("modeHint")}</p>
      <section class="mode-section"><h3>${countryLabel(country)}</h3><div class="mode-list">${modes.map((mode) => modeButton(mode, currentMode)).join("")}</div></section>`;
    openPanel(g("chooseMode"), body, (host) => {
      host.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
        closeOverlay();
        onMode(button.dataset.mode);
      }));
    });
  }

  let scatterObserver;
  function paintRail() {
    const list = shell.querySelector("[data-rail-list]");
    if (!list) return;
    const catalog = countryCatalog();
    const charmsByCountry = new Map(catalog.map((entry) => [entry.country, entry.charms]));
    list.innerHTML = catalog.map((entry) => {
      const art = assets?.get?.(entry.ticket) || "";
      return `<button class="rail-country" type="button" data-country="${escapeHtml(entry.country)}" style="--ticket-art: url('${art}'); --card-accent: ${entry.accent}">
        <span class="rail-country-art" aria-hidden="true"></span>
        <span class="rail-country-scatter" aria-hidden="true"><canvas data-scatter></canvas></span>
        <span class="rail-country-copy">
          <b>${escapeHtml(countryLabel(entry.country))}</b>
          <small>${g("lobbyGames", { n: entry.games })}</small>
        </span>
      </button>`;
    }).join("");
    list.querySelectorAll("[data-country]").forEach((button) => {
      button.addEventListener("click", () => {
        if (shell.querySelector("[data-country-rail]")?.classList.contains("is-locked")) {
          showToast(g("finishScratch"));
          return;
        }
        onCountry?.(button.dataset.country);
      });
    });
    const paintScatter = (canvas) => {
      const country = canvas.closest("[data-country]")?.dataset.country;
      const charms = charmsByCountry.get(country);
      if (country && charms) renderer.drawCharmScatter?.(canvas, charms);
    };
    scatterObserver?.disconnect();
    scatterObserver = new ResizeObserver((entries) => {
      for (const entry of entries) paintScatter(entry.target);
    });
    list.querySelectorAll("canvas[data-scatter]").forEach((canvas) => {
      scatterObserver.observe(canvas);
      requestAnimationFrame(() => paintScatter(canvas));
    });
  }

  function paintRailState(mode, collected, switchLocked) {
    const rail = shell.querySelector("[data-country-rail]");
    if (!rail) return;
    rail.classList.toggle("is-locked", Boolean(switchLocked));
    rail.querySelectorAll("[data-country]").forEach((button) => {
      button.classList.toggle("is-current", button.dataset.country === mode.country);
    });
  }

  function setAccount(username) {
    if (!accountBtn) return;
    accountBtn.classList.toggle("is-signed", Boolean(username));
    accountBtn.setAttribute("aria-label", username ? g("accountUser", { name: username }) : g("guestAccount"));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function authForm(kind) {
    if (kind === "login") {
      return `<form class="auth-form" data-auth="login">
        <label>${g("userOrEmail")}<input name="username" maxlength="64" autocomplete="username" required></label>
        <label>${g("password")}<input name="password" type="password" maxlength="32" autocomplete="current-password" required></label>
        <p class="auth-error" data-error hidden></p>
        <button class="control-btn primary" type="submit"><span class="control-label">${g("login")}</span></button>
      </form>`;
    }
    const codeRow = `<label>${g("code")}
        <span class="auth-code-row">
          <input name="code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required>
          <button class="control-btn" type="button" data-send-code><span class="control-label">${g("sendCode")}</span></button>
        </span>
      </label>`;
    if (kind === "quick") {
      return `<form class="auth-form" data-auth="quick">
        <p class="auth-quick-hint">${g("quickHint")}</p>
        <label>${g("email")}<input name="email" type="email" maxlength="64" autocomplete="email" required></label>
        <label>${g("password")}<input name="password" type="password" maxlength="32" autocomplete="new-password" required></label>
        ${codeRow}
        <p class="auth-error" data-error hidden></p>
        <button class="control-btn primary" type="submit"><span class="control-label">${g("finishRegister")}</span></button>
        <button class="auth-link" type="button" data-auth-tab="register">${g("customRegister")}</button>
      </form>`;
    }
    return `<form class="auth-form" data-auth="register">
      <label>${g("email")}<input name="email" type="email" maxlength="64" autocomplete="email" required></label>
      <label>${g("usernameOptional")}<input name="username" maxlength="16" autocomplete="username" placeholder="${g("usernamePlaceholder")}"></label>
      <label>${g("password")}<input name="password" type="password" maxlength="32" autocomplete="new-password" required></label>
      <label>${g("confirm")}<input name="confirm" type="password" maxlength="32" autocomplete="new-password" required></label>
      ${codeRow}
      <p class="auth-error" data-error hidden></p>
      <button class="control-btn primary" type="submit"><span class="control-label">${g("finishRegister")}</span></button>
      <button class="auth-link" type="button" data-auth-tab="quick">${g("backToQuick")}</button>
    </form>`;
  }

  function fieldsFrom(form) {
    const data = new FormData(form);
    return {
      username: String(data.get("username") || "").trim(),
      email: String(data.get("email") || "").trim(),
      password: String(data.get("password") || ""),
      confirm: String(data.get("confirm") || ""),
      code: String(data.get("code") || "").trim()
    };
  }

  function paintCooldown(button) {
    clearInterval(codeTimer);
    const label = button?.querySelector(".control-label");
    const tick = () => {
      const remain = Math.ceil((codeCooldownUntil - Date.now()) / 1000);
      if (!button) return;
      if (remain <= 0) {
        button.disabled = false;
        if (label) label.textContent = g("sendCode");
        clearInterval(codeTimer);
        return;
      }
      button.disabled = true;
      if (label) label.textContent = g("retryIn", { n: remain });
    };
    tick();
    codeTimer = window.setInterval(tick, 250);
  }

  function bindAuthForm(host, kind) {
    const form = host.querySelector("form");
    const error = form.querySelector("[data-error]");
    const showError = (message) => {
      error.hidden = false;
      error.textContent = message;
    };
    form.querySelector("[data-send-code]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const fields = fieldsFrom(form);
      error.hidden = true;
      if (kind === "register" && fields.password !== fields.confirm) {
        showError(g("passwordMismatch"));
        return;
      }
      button.disabled = true;
      try {
        const data = await onSendCode?.(fields.username, fields.email, fields.password);
        codeCooldownUntil = Date.now() + 60000;
        paintCooldown(button);
        showToast(data?.username ? g("codeSentAs", { name: data.username }) : g("codeSent"));
      } catch (err) {
        showError(gameError(err.message) || g("codeFail"));
        button.disabled = false;
      }
    });
    const sendButton = form.querySelector("[data-send-code]");
    if (sendButton && codeCooldownUntil > Date.now()) paintCooldown(sendButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = fieldsFrom(form);
      const button = form.querySelector("button[type=submit]");
      error.hidden = true;
      if (kind === "register" && fields.password !== fields.confirm) {
        showError(g("passwordMismatch"));
        return;
      }
      button.disabled = true;
      try {
        if (kind === "login") await onLogin?.(fields.username, fields.password);
        else await onRegister?.(fields.username, fields.password, { email: fields.email, code: fields.code });
      } catch (err) {
        showError(gameError(err.message) || g("failRetry"));
        button.disabled = false;
      }
    });
  }

  function openAuthGate(options = {}) {
    const locked = Boolean(options.locked);
    const showGuest = Boolean(options.guest);
    const hint = showGuest ? g("authHintGuest") : g("authHintUpgrade");
    const body = `<p class="mode-hint">${hint}</p>
      <div class="auth-tabs">
        <button type="button" class="control-btn primary" data-auth-tab="login"><span class="control-label">${g("login")}</span></button>
        <button type="button" class="control-btn" data-auth-tab="quick"><span class="control-label">${g("quickRegister")}</span></button>
      </div>
      <div data-auth-panel></div>
      ${showGuest ? `<button type="button" class="control-btn guest-btn" data-guest><span class="control-label">${g("guestPlay")}</span></button>` : ""}`;
    openPanel(g("accountTitle"), body, (host) => {
      const panel = host.querySelector("[data-auth-panel]");
      const show = (kind) => {
        panel.innerHTML = authForm(kind);
        host.querySelectorAll(".auth-tabs [data-auth-tab]").forEach((tab) => {
          tab.classList.toggle("primary", kind === "login" ? tab.dataset.authTab === "login" : tab.dataset.authTab === "quick");
        });
        bindAuthForm(host, kind);
        panel.querySelector("[data-auth-tab]")?.addEventListener("click", (event) => {
          show(event.currentTarget.dataset.authTab);
        });
      };
      show(options.tab === "login" ? "login" : options.tab === "register" ? "register" : "quick");
      host.querySelectorAll(".auth-tabs [data-auth-tab]").forEach((tab) => tab.addEventListener("click", () => show(tab.dataset.authTab)));
      host.querySelector("[data-guest]")?.addEventListener("click", () => {
        closeOverlay();
        onGuest?.();
      });
    }, { locked });
  }

  function openAccount(username) {
    if (!username) {
      openAuthGate({ locked: false, guest: false, tab: "quick" });
      return;
    }
    const body = `<div class="gift-box">
      <p class="account-name">${escapeHtml(username)}</p>
      <p>${g("accountSaved")}</p>
      <button class="control-btn" type="button" data-logout><span class="control-label">${g("logout")}</span></button>
    </div>`;
    openPanel(g("accountTitle"), body, (host) => {
      host.querySelector("[data-logout]").addEventListener("click", async () => {
        await onLogout?.();
      });
    });
  }

  function formatStubTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function stubStatus(item) {
    if (item.status === "win") return { label: item.prize ? g("stubWinPrize", { n: item.prize }) : g("stubWin"), tone: "win" };
    if (item.status === "pending") return { label: g("stubPending"), tone: "pending" };
    return { label: g("stubLose"), tone: "lose" };
  }

  function stubTitle(item) {
    const mode = MODES.find((entry) => entry.id === item.modeId);
    return (mode ? displayMode(mode).title : item.title) || g("stubTicket");
  }

  function stubCard(item) {
    const mark = stubStatus(item);
    return `<article class="stub-card is-${mark.tone}">
      <span class="stub-series">${escapeHtml(item.series || "XX")}</span>
      <strong>${g("stubNo", { n: item.serial, series: item.series || ticketSeries(MODES.find((entry) => entry.id === item.modeId)) })}</strong>
      <b>${escapeHtml(countryLabel(item.country) || "")} · ${escapeHtml(stubTitle(item))}</b>
      <small>${formatStubTime(item.boughtAt)}</small>
      <span class="stub-stamp">${mark.label}</span>
    </article>`;
  }

  function openStubs(stubs = []) {
    const rows = stubs.filter((item) => item.status !== "pending");
    const page = 50;
    let shown = Math.min(rows.length, page);
    const empty = `<p class="mode-hint">${g("stubEmpty")}</p>`;
    const moreBtn = rows.length > page
      ? `<button class="control-btn" type="button" data-more-stubs><span class="control-label">${g("stubMore")}</span></button>`
      : "";
    const body = `<div class="stub-list">${rows.length ? rows.slice(0, shown).map(stubCard).join("") : empty}</div>
      ${moreBtn}`;
    openPanel(g("stubs"), body, (host) => {
      host.querySelector("[data-more-stubs]")?.addEventListener("click", (event) => {
        shown = Math.min(rows.length, shown + page);
        host.querySelector(".stub-list").innerHTML = rows.slice(0, shown).map(stubCard).join("");
        if (shown >= rows.length) event.currentTarget.remove();
        else event.currentTarget.querySelector(".control-label").textContent = g("stubMoreLeft", { n: rows.length - shown });
      });
    });
  }

  function openCollection(collected) {
    const countries = [...new Set(ICONS.map((item) => item.country))];
    const body = `<div class="collection-summary">
        <div>${g("collectionLead", { n: collected.size, total: ICONS.length })}</div>
        <p class="save-note">${g("collectionNote")}</p>
        <div class="save-actions">
          <button class="control-btn" type="button" data-export><span class="control-label">${g("exportSave")}</span></button>
          <button class="control-btn primary" type="button" data-import><span class="control-label">${g("importSave")}</span></button>
        </div>
      </div>
      ${countries.map((country) => `<section class="collection-section"><h3>${countryLabel(country)}</h3><div class="collection-grid">${ICONS.filter((item) => item.country === country).map((item) => {
        const owned = collected.has(item.id);
        return `<div class="collection-item ${owned ? "owned" : "locked"}"><canvas data-icon="${item.id}"></canvas><b>${owned ? item.name : "???"}</b><small>${owned ? rarityLabel(item.rarity) : g("locked")}</small></div>`;
      }).join("")}</div></section>`).join("")}`;
    openPanel(g("albumTitle"), body, (host) => {
      host.querySelector("[data-export]").addEventListener("click", () => openExport());
      host.querySelector("[data-import]").addEventListener("click", () => openImport());
      requestAnimationFrame(() => {
        host.querySelectorAll("canvas[data-icon]").forEach((canvas) => {
          const item = ICONS.find((icon) => icon.id === canvas.dataset.icon);
          renderer.drawIconPreview(canvas, item, collected.has(item.id));
        });
      });
    });
  }

  async function openExport() {
    const code = onExportSave?.() || "";
    const body = `<p class="mode-hint">${g("exportHint")}</p>
      <textarea class="save-code" readonly rows="6">${code}</textarea>
      <button class="control-btn primary" type="button" data-copy><span class="control-label">${g("copyCode")}</span></button>`;
    openPanel(g("exportSave"), body, (host) => {
      const area = host.querySelector(".save-code");
      host.querySelector("[data-copy]").addEventListener("click", async () => {
        area.select();
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          document.execCommand("copy");
        }
        showToast(g("copied"));
      });
    });
  }

  function openImport() {
    const body = `<p class="mode-hint">${g("importHint")}</p>
      <textarea class="save-code" data-import-code rows="6" placeholder="${g("importPlaceholder")}"></textarea>
      <button class="control-btn primary" type="button" data-apply><span class="control-label">${g("importApply")}</span></button>`;
    openPanel(g("importSave"), body, (host) => {
      host.querySelector("[data-apply]").addEventListener("click", () => {
        const text = host.querySelector("[data-import-code]").value;
        const result = onImportSave?.(text);
        if (!result?.ok) {
          showToast(result?.message || g("importBad"));
          return;
        }
        closeOverlay();
        showToast(result.message || g("copied"), "win");
      });
    });
  }

  function openRules() {
    const paras = [1, 3, 4, 5, 7].map((n) => `<p>${g(`rules${n}`)}</p>`).join("");
    openPanel(g("rules"), `<div class="help-block">${paras}</div>`);
  }

  function openModeHelp(mode) {
    const shown = displayMode(mode);
    const body = `<div class="help-block">
      <p class="help-kicker">${escapeHtml(shown.country)} · ${g("goldAmount", { n: mode.cost })}</p>
      <p>${escapeHtml(shown.subtitle)}</p>
      <p>${escapeHtml(modeHelpText(mode))}</p>
      <button class="control-btn primary" type="button" data-odds-from-help><span class="control-label">${g("odds")}</span></button>
    </div>`;
    openPanel(g("helpTitle", { title: shown.title }), body, (host) => {
      host.querySelector("[data-odds-from-help]")?.addEventListener("click", () => openOdds(mode));
    });
  }

  function openOdds(mode) {
    const shown = displayMode(mode);
    const chance = 100 - mode.tiers[0].probability;
    const named = Boolean(mode.kind);
    const rows = mode.tiers.map((tier, index) => {
      const jackpot = named && index === mode.tiers.length - 1;
      const prizeText = tier.prize || named ? g("goldAmount", { n: tier.prize || 0 }) : "—";
      return `<tr${jackpot ? ' class="jackpot"' : ""}><td>${tierLabel(tier.label)}</td><td>${tier.probability.toFixed(tier.probability < 1 ? 1 : 0)}%</td><td>${prizeText}</td></tr>`;
    }).join("");
    const mechanic = mechanicText(mode);
    const body = `<div class="odds-lead"><b>${shown.country} · ${shown.title}</b><span>${g("oddsRate", { n: chance })}</span><span>${g("oddsRtp", { n: rtp(mode) })}</span></div>
      <table class="odds-table"><thead><tr><th>${g("oddsTier")}</th><th>${g("oddsChance")}</th><th>${g("oddsPrize")}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="fine-print">${mechanic} ${g("oddsFoot")}</p>`;
    openPanel(g("oddsTitle", { title: shown.title }), body);
  }

  function openDaily(amount, plays, modeTitle, { onClaim, onClose } = {}) {
    let claimed = false;
    const body = `<div class="gift-box"><div class="gift-coins" aria-hidden="true">◈</div><h3>${g("dailyHead")}</h3><strong>${g("goldAmount", { n: formatCoins(amount) })}</strong><p>${g("dailyBody", { n: plays, title: modeTitle })}</p><button class="control-btn primary" data-claim><span class="control-label">${g("claim")}</span></button></div>`;
    openPanel(g("dailyTitle"), body, (host) => {
      host.querySelector("[data-claim]").addEventListener("click", () => {
        claimed = true;
        closeOverlay();
        onClaim?.();
      });
    }, { onClose: () => { if (!claimed) onClose?.(); } });
  }

  function openGift(amount, onClaim) {
    const body = `<div class="gift-box"><div class="gift-coins" aria-hidden="true">◈</div><h3>${g("giftHead")}</h3><strong>${g("goldAmount", { n: formatCoins(amount) })}</strong><p>${g("giftBody")}</p><button class="control-btn primary" data-claim><span class="control-label">${g("takeGift")}</span></button></div>`;
    openPanel(g("giftTitle"), body, (host) => host.querySelector("[data-claim]").addEventListener("click", () => {
      closeOverlay();
      onClaim();
    }));
  }

  function openShop() {
    const coins = coinValue.textContent || "0";
    const bays = Array.from({ length: 6 }, (_, i) => `
      <button class="shop-bay" type="button" data-bay="${i}" aria-label="${g("shopWindow")} · ${g("shopClosed")}">
        <span class="shop-bay-frame" aria-hidden="true"></span>
        <span class="shop-shutter" aria-hidden="true"></span>
        <span class="shop-bay-label">${g("shopClosed")}</span>
      </button>`).join("");
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay shop-overlay" role="dialog" aria-modal="true" aria-label="${g("shopTitle")}">
        <section class="shop-room">
          <header class="shop-beam">
            <div class="shop-signboard">
              <span class="shop-lantern" aria-hidden="true"></span>
              <div class="shop-sign-copy">
                <h2>${g("shopTitle")}</h2>
                <small>${g("shopClosedSign")}</small>
              </div>
            </div>
            <button class="icon-btn close-btn" aria-label="${g("close")}">×</button>
          </header>
          <div class="shop-wall">
            <div class="shop-windows">${bays}</div>
          </div>
          <footer class="shop-counter">
            <div class="shop-till">
              <span class="coin-mark">◈</span>
              <strong data-shop-coins>${coins}</strong>
              <small>${g("gold")}</small>
            </div>
            <p class="shop-note">${g("shopLead")}</p>
          </footer>
        </section>
      </div>`;
    const dismiss = () => closeOverlay();
    overlay.querySelector(".close-btn").addEventListener("click", dismiss);
    overlay.querySelector(".overlay").addEventListener("pointerdown", (event) => {
      if (event.target === event.currentTarget) dismiss();
    });
    const note = overlay.querySelector(".shop-note");
    let slipTimer;
    overlay.querySelectorAll("[data-bay]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!note) return;
        note.textContent = g("shopComing");
        note.classList.add("is-alert");
        clearTimeout(slipTimer);
        slipTimer = window.setTimeout(() => {
          note.textContent = g("shopLead");
          note.classList.remove("is-alert");
        }, 1800);
      });
    });
  }

  function openInsufficient() {
    const body = `<div class="gift-box"><div class="gift-coins small" aria-hidden="true">◈</div><h3>${g("poorHead")}</h3><p>${g("poorBody")}</p><button class="control-btn primary" data-relief><span class="control-label">${g("takeRelief")}</span></button></div>`;
    openPanel(g("poorTitle"), body, (host) => host.querySelector("[data-relief]").addEventListener("click", () => {
      closeOverlay();
      onRelief();
    }));
  }

  shell.querySelector("[data-modes]").addEventListener("click", () => {
    if (modesButton?.classList.contains("is-locked")) {
      showToast(g("finishScratch"));
      return;
    }
    openModes(window.__currentScratchMode || MODES[0]);
  });
  shell.querySelector("[data-account]").addEventListener("click", () => openAccount(window.__scratchAccount || null));
  shell.querySelector("[data-stubs]")?.addEventListener("click", () => openStubs(window.__scratchStubs || []));
  shell.querySelector("[data-shop]")?.addEventListener("click", () => openShop());
  shell.querySelector("[data-collection]").addEventListener("click", () => openCollection(window.__scratchCollection || new Set()));
  shell.querySelector("[data-odds]").addEventListener("click", () => openOdds(window.__currentScratchMode));
  shell.querySelector("[data-rules]")?.addEventListener("click", () => openRules());
  shell.querySelector("[data-mode-info]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openModeHelp(window.__currentScratchMode || MODES[0]);
  });
  soundBtn.addEventListener("click", () => {
    const enabled = onSound();
    soundBtn.classList.toggle("is-muted", !enabled);
    soundBtn.setAttribute("aria-label", enabled ? g("soundOn") : g("soundOff"));
  });
  shell.querySelector("[data-prev]").addEventListener("click", () => onMode("prev"));
  shell.querySelector("[data-next-mode]").addEventListener("click", () => onMode("next"));
  nextButton.addEventListener("click", onNext);

  return { setState, setAccount, paintRail, showToast, openModes, openShop, openCollection, openStubs, openOdds, openRules, openModeHelp, openGift, openDaily, openInsufficient, openResult, openAuthGate, openAccount, closeOverlay };
}
