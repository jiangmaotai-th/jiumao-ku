import { createAccountClient, gameSaveOf } from "./account.js";
import { createAudio } from "./audio.js";
import { assignedTicketSerial, createTicket, discoveryBonus, formatTicketSerial, MODES, modesForCountry, ticketSeries, winningSymbols } from "./data.js";
import { localizedHref, t } from "../../i18n";
import { displayMode, formatCoins, g, gameError, tierLabel } from "./i18n.js";
import { createRenderer } from "./renderer.js";
import { createScratchController } from "./scratch.js";
import { createUI } from "./ui.js";

const DEFAULT_SAVE = { version: 1, coins: 0, collected: [], plays: 0, giftClaimed: false, dailyClaimedOn: "", modeId: MODES[0].id, albumReset: 1, stubs: [] };
const ALBUM_RESET = 1;
const DAILY_PLAYS = 10;
const STUB_EPOCH_MIN = Math.floor(Date.UTC(2026, 0, 1) / 60000);
const STUB_STATUS = { lose: 0, win: 1, pending: 2 };

function modeIndexOf(modeId) {
  const index = MODES.findIndex((mode) => mode.id === modeId);
  return index < 0 ? 0 : index;
}

function stubRecord(mode, serial, boughtAt, status, prize) {
  const stamped = assignedTicketSerial(serial);
  return {
    id: `${mode.id}-${stamped || "pending"}-${boughtAt}`,
    serial: stamped,
    country: mode.country,
    series: ticketSeries(mode),
    title: mode.title,
    modeId: mode.id,
    cost: mode.cost,
    boughtAt,
    status,
    prize
  };
}

function makeStub(mode, serial) {
  return stubRecord(mode, serial, Date.now(), "pending", 0);
}

function pushVarint(bytes, value) {
  let n = Math.max(0, value >>> 0);
  while (n >= 128) {
    bytes.push((n & 127) | 128);
    n >>>= 7;
  }
  bytes.push(n);
}

function readVarint(bytes, offset) {
  let n = 0;
  let shift = 0;
  let i = offset;
  while (i < bytes.length) {
    const bit = bytes[i++];
    n |= (bit & 127) << shift;
    if ((bit & 128) === 0) break;
    shift += 7;
    if (shift > 28) break;
  }
  return [n >>> 0, i];
}

function zigZag(value) {
  return value >= 0 ? value * 2 : (-value * 2) - 1;
}

function unZigZag(value) {
  return (value & 1) ? -((value + 1) >> 1) : value >> 1;
}

function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    binary += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) u8[i] = binary.charCodeAt(i);
  return u8;
}

function packStubs(stubs) {
  if (!Array.isArray(stubs) || !stubs.length) return "";
  const rows = stubs.map((item) => {
    const mode = MODES[modeIndexOf(item.modeId)] || MODES[0];
    return {
      modeIndex: modeIndexOf(mode.id),
      serial: Math.max(1, parseInt(String(item.serial ?? "").replace(/\D/g, ""), 10) || 1),
      boughtAt: Number(item.boughtAt) || 0,
      status: STUB_STATUS[item.status] ?? 0,
      prize: Math.max(0, Math.floor(Number(item.prize) || 0))
    };
  }).filter((row) => row.boughtAt > 0).sort((a, b) => a.boughtAt - b.boughtAt || a.serial - b.serial);
  const bytes = [2];
  pushVarint(bytes, rows.length);
  let prevMin = 0;
  for (const row of rows) {
    const minutes = Math.max(0, Math.round(row.boughtAt / 60000) - STUB_EPOCH_MIN);
    pushVarint(bytes, zigZag(minutes - prevMin));
    prevMin = minutes;
    bytes.push(row.modeIndex & 255);
    bytes.push((row.serial >> 8) & 255, row.serial & 255);
    bytes.push(row.status & 3);
    if (row.status === 1) pushVarint(bytes, row.prize);
  }
  return `S2.${bytesToBase64(bytes)}`;
}

function unpackPackedStubs(payload) {
  const bytes = base64ToBytes(payload);
  if (!bytes.length || bytes[0] !== 2) return [];
  let offset = 1;
  let count;
  [count, offset] = readVarint(bytes, offset);
  const stubs = [];
  let prevMin = 0;
  for (let n = 0; n < count && offset + 3 < bytes.length; n += 1) {
    let dt;
    [dt, offset] = readVarint(bytes, offset);
    prevMin += unZigZag(dt);
    const mode = MODES[bytes[offset++]] || MODES[0];
    const serial = (bytes[offset++] << 8) | bytes[offset++];
    const statusCode = bytes[offset++] & 3;
    let prize = 0;
    if (statusCode === 1) [prize, offset] = readVarint(bytes, offset);
    const status = statusCode === 1 ? "win" : statusCode === 2 ? "pending" : "lose";
    stubs.push(stubRecord(mode, serial, (prevMin + STUB_EPOCH_MIN) * 60000, status, prize));
  }
  stubs.reverse();
  return stubs;
}

function hydrateStub(item) {
  const mode = MODES[modeIndexOf(item?.modeId)] || MODES.find((entry) => entry.country === item?.country) || MODES[0];
  const serial = formatTicketSerial(item?.serial);
  const boughtAt = Number.isFinite(item?.boughtAt) ? item.boughtAt : 0;
  const status = ["pending", "win", "lose"].includes(item?.status) ? item.status : "lose";
  const prize = Number.isFinite(item?.prize) ? Math.max(0, Math.floor(item.prize)) : 0;
  if (!serial || !boughtAt) return null;
  return stubRecord(mode, serial, boughtAt, status, prize);
}

function unpackStubs(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    if (!raw.startsWith("S2.")) return [];
    try { return unpackPackedStubs(raw.slice(3)); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(hydrateStub).filter(Boolean);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function cleanDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function cleanSave(raw) {
  if (!raw || raw.version !== 1) return { ...DEFAULT_SAVE };
  const keepAlbum = raw.albumReset === ALBUM_RESET;
  return {
    version: 1,
    coins: Number.isFinite(raw.coins) ? Math.max(0, Math.floor(raw.coins)) : 0,
    collected: keepAlbum && Array.isArray(raw.collected) ? raw.collected.filter((item) => typeof item === "string") : [],
    plays: Number.isFinite(raw.plays) ? Math.max(0, Math.floor(raw.plays)) : 0,
    giftClaimed: Boolean(raw.giftClaimed),
    dailyClaimedOn: cleanDate(raw.dailyClaimedOn),
    modeId: MODES.some((mode) => mode.id === raw.modeId) ? raw.modeId : MODES[0].id,
    albumReset: ALBUM_RESET,
    stubs: unpackStubs(raw.stubs).filter((item) => item.status !== "pending")
  };
}

function snapshotFrom(state, modeId) {
  return {
    version: 1,
    coins: state.coins,
    collected: [...state.collected],
    plays: state.plays,
    giftClaimed: state.giftClaimed,
    dailyClaimedOn: state.dailyClaimedOn,
    modeId,
    albumReset: ALBUM_RESET,
    stubs: packStubs(state.stubs.filter((item) => item.status !== "pending")),
    savedAt: Date.now()
  };
}

function toSaveCode(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `SG1.${btoa(binary)}`;
}

function fromSaveCode(text) {
  const raw = String(text || "").trim().replace(/\s+/g, "");
  if (!raw) throw new Error("empty");
  let parsed;
  if (raw.startsWith("SG1.")) {
    const binary = atob(raw.slice(4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } else if (raw.startsWith("{")) {
    parsed = JSON.parse(raw);
  } else {
    throw new Error("format");
  }
  return cleanSave(parsed);
}

export function createGame({ mount, sdk, ready, tweaks, assets }) {
  let cleanup = () => {};

  return {
    start() {
      const homeHref = localizedHref("/");
      const homeLabel = t("common.backHome");
      const shell = document.createElement("section");
      shell.className = "game-shell";
      shell.innerHTML = `
        <header class="hud-row top-bar">
          <div class="hud-lead">
            <a class="home-link" href="${homeHref}" aria-label="${homeLabel}" title="${homeLabel}">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.6 11.2 12 4.8l7.4 6.4"/>
                <path d="M6.4 10.6V19a1.2 1.2 0 0 0 1.2 1.2h3.2v-5h2.4v5h3.2A1.2 1.2 0 0 0 17.6 19v-8.4"/>
              </svg>
              <span>${homeLabel}</span>
            </a>
            <div class="wallet-cluster">
              <div class="badge coin-badge"><span class="coin-mark">◈</span><strong data-coins>—</strong></div>
              <button class="shop-btn" data-shop type="button" aria-label="${g("shop")}">
                <span class="shop-btn-roof" aria-hidden="true"></span>
                <span class="shop-btn-label">${g("shopLabel")}</span>
              </button>
            </div>
          </div>
          <div class="hud-actions">
            <button class="icon-btn" data-rules aria-label="${g("rules")}">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 4.6h7.4L18.8 9.2V19.4H7A1.6 1.6 0 0 1 5.4 17.8V6.2A1.6 1.6 0 0 1 7 4.6Z"/>
                <path d="M14.2 4.8V9h4.6"/>
                <circle cx="12" cy="12.4" r="1" fill="currentColor" stroke="none"/>
                <path d="M12 14.2v3.2"/>
              </svg>
            </button>
            <button class="icon-btn" data-stubs aria-label="${g("stubs")}">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5.2" y="4.6" width="13.6" height="14.8" rx="1.7"/>
                <path d="M5.2 9.4h13.6" stroke-dasharray="1.6 1.5"/>
                <path d="M8.2 12.6h7.6M8.2 15.6h5.2"/>
              </svg>
            </button>
            <button class="icon-btn" data-account aria-label="${g("guestAccount")}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <g class="icon-guest" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="8" r="3.15"/>
                  <path d="M5.6 19.2c.7-3.5 3.2-5.3 6.4-5.3s5.7 1.8 6.4 5.3"/>
                </g>
                <g class="icon-signed" fill="currentColor">
                  <circle cx="12" cy="8" r="3.3"/>
                  <path d="M5.4 19.4c.4-3.8 3.3-5.7 6.6-5.7s6.2 1.9 6.6 5.7C16.8 20.6 7.2 20.6 5.4 19.4Z"/>
                </g>
              </svg>
            </button>
            <button class="icon-btn" data-collection aria-label="${g("collection")}">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5.2" y="4.8" width="13.6" height="14.4" rx="1.8"/>
                <path d="M8.2 8.4h7.6M8.2 11.6h5.4M8.2 14.8h6.2"/>
                <path d="M16.8 4.8v14.4" opacity=".55"/>
              </svg>
            </button>
            <button class="icon-btn" data-odds aria-label="${g("odds")}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" stroke-width="1.8"/>
                <path fill="currentColor" d="M12 12V4.6A7.4 7.4 0 0 1 18.7 16.2Z"/>
              </svg>
            </button>
            <button class="icon-btn" data-sound aria-label="${g("soundOn")}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M4.8 9.4h3.1L12.2 6v12l-4.3-3.4H4.8Z"/>
                <g class="sound-on" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                  <path d="M15.4 9.1a3.4 3.4 0 0 1 0 5.8"/>
                  <path d="M17.8 7a6.2 6.2 0 0 1 0 10"/>
                </g>
                <path class="sound-off" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.2 9.4l5 5M20.2 9.4l-5 5"/>
              </svg>
            </button>
          </div>
        </header>
        <div class="play-body">
          <aside class="country-rail" data-country-rail aria-label="${g("railTitle")}">
            <div class="rail-list" data-rail-list></div>
          </aside>
          <main class="ticket-stage" aria-label="${g("ticketStage")}">
          <canvas class="base-canvas"></canvas>
          <canvas class="scratch-canvas"></canvas>
          <canvas class="effects-canvas"></canvas>
          <div class="scratch-progress" data-progress><i></i></div>
          <div class="loading-plaque">${g("loading")}</div>
          <div class="toast" role="status"></div>
        </main>
        </div>
        <footer class="controls-row bottom-bar">
          <button class="control-btn nav-btn" data-prev aria-label="${g("prevMode")}">‹</button>
          <div class="mode-chip-wrap">
            <button class="mode-chip" data-modes aria-label="${g("chooseMode")}"><span data-mode-title></span><small data-mode-country></small></button>
            <button class="mode-info" data-mode-info type="button" aria-label="${g("help")}">i</button>
          </div>
          <button class="control-btn nav-btn" data-next-mode aria-label="${g("nextMode")}">›</button>
          <button class="control-btn primary next-btn" data-next disabled><span class="control-label">${g("scratching")}</span></button>
        </footer>
        <div class="overlay-host" hidden></div>
        <div class="coin-fly-layer" data-coin-fly aria-hidden="true"></div>
      `;

      mount.replaceChildren(shell);
      let alive = true;
      let renderer;
      let scratch;
      const audio = createAudio({ tweaks, assets });
      const unsubscribers = [tweaks.subscribe("musicVolume", (value) => audio.setVolume(value))];

      const boot = async () => {
        const saved = cleanSave(await sdk.gameState.load().catch(() => null));
        if (!alive) return;
        const accounts = createAccountClient();
        let session = accounts.restore();
        let started = false;
        const state = {
          ...saved,
          collected: new Set(saved.collected),
          modeIndex: Math.max(0, MODES.findIndex((mode) => mode.id === saved.modeId)),
          ticket: null,
          settled: true
        };
        const ui = createUI({
          shell,
          renderer: {
            drawIconPreview: (...args) => renderer?.drawIconPreview(...args),
            drawCharmScatter: (...args) => renderer?.drawCharmScatter(...args)
          },
          assets,
          onMode: (id) => switchMode(id),
          onCountry: (country) => enterCountry(country),
          onNext: () => buyTicket(),
          onSound: () => audio.toggle(),
          onRelief: () => { state.coins += 100; persist(); refresh(); buyTicket(); },
          onCoinArrive: () => audio.coin(),
          onExportSave: () => {
            persist();
            return toSaveCode(snapshotFrom(state, currentMode().id));
          },
          onImportSave: (text) => {
            try {
              const next = fromSaveCode(text);
              abandonTicket();
              state.coins = next.coins;
              state.collected = new Set(next.collected);
              state.plays = next.plays;
              state.giftClaimed = next.giftClaimed;
              state.dailyClaimedOn = next.dailyClaimedOn;
              state.modeIndex = Math.max(0, MODES.findIndex((mode) => mode.id === next.modeId));
              state.stubs = next.stubs;
              persist();
              refresh(0);
              return { ok: true, message: g("restoreOk", { n: state.collected.size, coins: formatCoins(state.coins) }) };
            } catch {
              return { ok: false, message: g("restoreBad") };
            }
          },
          onLogin: async (username, password) => {
            const data = await accounts.login(username, password);
            session = { username: data.username, token: data.token };
            const cloud = gameSaveOf(data.save, "scratch");
            if (cloud) applySaveData(cloud);
            ui.closeOverlay();
            ui.showToast(g("welcomeBack", { name: data.username }));
            afterAuth();
          },
          onRegister: async (username, password, extra) => {
            const payload = snapshotFrom(state, currentMode().id);
            const data = await accounts.register(username, password, { scratch: payload }, extra);
            session = { username: data.username, token: data.token };
            ui.closeOverlay();
            ui.showToast(g("accountCreated", { name: data.username }));
            persist();
            afterAuth();
          },
          onSendCode: (username, email, password) => accounts.sendCode(username, email, password),
          onGuest: () => afterAuth(),
          onLogout: async () => {
            persist();
            if (session?.token) await accounts.logout(session.token);
            session = null;
            ui.closeOverlay();
            ui.setAccount(null);
            refresh();
            ui.showToast(g("loggedOut"));
          }
        });
        try {
          renderer = await createRenderer({
            stage: shell.querySelector(".ticket-stage"),
            baseCanvas: shell.querySelector(".base-canvas"),
            scratchCanvas: shell.querySelector(".scratch-canvas"),
            effectsCanvas: shell.querySelector(".effects-canvas"),
            assets
          });
        } catch {
          shell.querySelector(".loading-plaque").textContent = g("loadFail");
          return;
        }
        if (!alive) return;
        shell.querySelector(".loading-plaque").hidden = true;
        ui.paintRail();
        let buying = false;
        let serialClaim = null;
        scratch = createScratchController({
          canvas: shell.querySelector(".scratch-canvas"),
          getTicketRect: renderer.getTicketRect,
          radius: () => Number(tweaks.get("scratchRadius")),
          onScratch: ({ mark, point, check, sound }) => {
            if (state.settled) return;
            if (mark || check) void claimSerialIfNeeded();
            if (mark) renderer.applyScratch(mark, point);
            if (sound) audio.scratch();
            if (mark || check) {
              const result = renderer.coverage();
              scratch.updateCoverage(result.slotCoverage, result.overall);
              refresh(result.overall);
            }
          },
          onReveal: (index) => { renderer.reveal(index); audio.reveal(index); },
          onComplete: (_value, allRevealed) => {
            if (!state.settled && allRevealed) void settleWhenReady();
          }
        });
        const unlock = () => {
          void audio.unlock().then((ok) => {
            if (!ok) return;
            shell.removeEventListener("pointerdown", unlock, true);
            shell.removeEventListener("touchstart", unlock, true);
            document.removeEventListener("WeixinJSBridgeReady", unlock);
          });
        };
        shell.addEventListener("pointerdown", unlock, true);
        shell.addEventListener("touchstart", unlock, { capture: true, passive: true });
        document.addEventListener("WeixinJSBridgeReady", unlock);

        function currentMode() { return MODES[state.modeIndex]; }

        function modesInCountry(country = currentMode().country) {
          return modesForCountry(country).map((mode) => ({
            mode,
            index: Math.max(0, MODES.findIndex((entry) => entry.id === mode.id))
          }));
        }

        function enterCountry(country) {
          if (country === currentMode().country) return;
          const list = modesInCountry(country);
          if (!list.length) return;
          switchMode(list[0].mode.id);
        }

        function finishedStubs() {
          return state.stubs.filter((item) => item.status !== "pending");
        }

        function scratchStarted() {
          return Boolean(!state.settled && state.ticket && ((scratch?.marks?.length || 0) > 0 || (scratch?.progress || 0) > 0));
        }

        function expose() {
          window.__currentScratchMode = currentMode();
          window.__scratchCollection = state.collected;
          window.__scratchStubs = finishedStubs();
          window.__scratchAccount = session?.username || null;
        }

        function refresh(progress = scratch?.progress || 0) {
          expose();
          ui.setState({
            coins: state.coins,
            collected: state.collected,
            stubs: finishedStubs(),
            mode: currentMode(),
            settled: state.settled,
            scratchProgress: progress,
            switchLocked: scratchStarted()
          });
        }

        function persist() {
          const payload = snapshotFrom(state, currentMode().id);
          void sdk.gameState.save(payload).catch(() => {});
          if (session?.token) void accounts.save(session.token, { scratch: payload }).catch(() => {});
        }

        function applySaveData(raw) {
          const next = cleanSave(raw);
          abandonTicket();
          state.coins = next.coins;
          state.collected = new Set(next.collected);
          state.plays = next.plays;
          state.giftClaimed = next.giftClaimed;
          state.dailyClaimedOn = next.dailyClaimedOn;
          state.modeIndex = Math.max(0, MODES.findIndex((mode) => mode.id === next.modeId));
          state.stubs = next.stubs;
          state.ticket = null;
          state.settled = true;
        }

        function offerDaily(then) {
          if (state.dailyClaimedOn === todayKey()) {
            then();
            return;
          }
          const mode = currentMode();
          const amount = mode.cost * DAILY_PLAYS;
          ui.openDaily(amount, DAILY_PLAYS, displayMode(mode).title, {
            onClaim: () => {
              state.coins += amount;
              state.dailyClaimedOn = todayKey();
              persist();
              refresh();
              ui.showToast(g("dailyClaimed", { n: formatCoins(amount) }));
              then();
            },
            onClose: then
          });
        }

        function afterAuth() {
          ui.setAccount(session?.username || null);
          refresh();
          if (!started) {
            started = true;
            const startPlay = () => buyTicket();
            if (!state.giftClaimed) {
              const amount = Number(tweaks.get("firstGift"));
              ui.openGift(amount, () => {
                state.giftClaimed = true;
                state.coins += amount;
                persist();
                refresh();
                offerDaily(startPlay);
              });
            } else {
              offerDaily(startPlay);
            }
            return;
          }
          if (state.dailyClaimedOn !== todayKey()) {
            offerDaily(() => {
              if (state.settled && !state.ticket) buyTicket();
            });
            return;
          }
          if (state.settled && !state.ticket && state.giftClaimed) buyTicket();
        }

        async function buyTicket() {
          if (buying) return;
          const mode = currentMode();
          if (state.coins < mode.cost) { ui.openInsufficient(); return; }
          buying = true;
          serialClaim = null;
          try {
            const status = await accounts.ticketStatus(mode.id);
            if (status.issued >= 10000) throw new Error("本奖票已售罄，发行上限 10000 张");
            if (state.coins < mode.cost) { ui.openInsufficient(); return; }
            state.coins -= mode.cost;
            state.plays += 1;
            state.ticket = createTicket(mode, "", status.issued);
            state.settled = false;
            state.stubs = [makeStub(mode, ""), ...state.stubs];
            scratch.reset();
            renderer.setTicket(mode, state.ticket);
            audio.setCountry(mode.country);
            persist();
            refresh(0);
            const shown = displayMode(mode);
            ui.showToast(shown.hint || g("boughtToast", { title: shown.title, left: status.remaining }));
          } catch (err) {
            ui.showToast(gameError(err?.message) || g("serialFail"));
          } finally {
            buying = false;
          }
        }

        function stampTicketSerial(ticket, serial) {
          const stamped = assignedTicketSerial(serial);
          if (!ticket || !stamped) return;
          ticket.serial = stamped;
          ticket.editionIssued = parseInt(stamped, 10) || ticket.editionIssued;
          const stub = state.stubs.find((item) => item.status === "pending");
          if (stub) {
            stub.serial = stamped;
            stub.id = `${currentMode().id}-${stamped}-${stub.boughtAt}`;
          }
        }

        function claimSerialIfNeeded() {
          const ticket = state.ticket;
          if (!ticket || assignedTicketSerial(ticket.serial)) return Promise.resolve(ticket.serial);
          if (serialClaim) return serialClaim;
          serialClaim = (async () => {
            try {
              const serial = await accounts.nextTicketSerial(currentMode().id);
              if (state.ticket !== ticket || state.settled) return "";
              stampTicketSerial(ticket, serial);
              persist();
              return ticket.serial;
            } catch (err) {
              const soldOut = String(err?.message || "").includes("售罄");
              if (state.ticket === ticket) {
                ui.showToast(gameError(err?.message) || g("serialFail"));
                if (soldOut) {
                  abandonTicket();
                  scratch?.reset();
                  persist();
                  refresh();
                }
              }
              throw err;
            } finally {
              serialClaim = null;
            }
          })();
          return serialClaim;
        }

        async function settleWhenReady() {
          try {
            await claimSerialIfNeeded();
          } catch {
            return;
          }
          if (state.settled || !assignedTicketSerial(state.ticket?.serial)) return;
          settleTicket();
        }

        function settleTicket() {
          if (state.settled) return;
          state.settled = true;
          scratch.setCompleted(true);
          renderer.clearCoating();
          let bonus = 0;
          let discoveries = 0;
          winningSymbols(state.ticket, currentMode()).forEach((symbol) => {
            if (!state.collected.has(symbol.id)) {
              state.collected.add(symbol.id);
              bonus += discoveryBonus(symbol);
              discoveries += 1;
            }
          });
          const prize = state.ticket.tier.prize;
          const kind = state.ticket.kind;
          const serial = formatTicketSerial(state.ticket.serial);
          const stub = state.stubs.find((item) => item.status === "pending" && item.serial === serial && item.modeId === currentMode().id)
            || state.stubs.find((item) => item.status === "pending");
          if (stub) {
            stub.status = prize > 0 ? "win" : "lose";
            stub.prize = prize;
          }
          state.coins += prize + bonus;
          persist();
          if (prize > 0) {
            const mode = currentMode();
            const bigWin = prize >= mode.cost * 5;
            const jackpot = prize >= mode.cost * 20;
            audio.win(jackpot ? 3 : bigWin ? 2 : 1);
            renderer.celebrate(jackpot || bigWin);
            void sdk.device.haptics.vibrate(jackpot ? [30, 40, 55, 40, 90] : bigWin ? [35, 40, 70] : 35).catch(() => {});
            const doubled = kind === "multiplier" && state.ticket.multiplier?.live ? tierLabel(state.ticket.multiplier.label) : "";
            const keyed = kind === "key-match" && state.ticket.cells.some((cell) => cell.key && cell.hit) ? g("keyHit") : "";
            const bingo = kind === "bingo" && state.ticket.pattern === "x" ? g("bingoX") : kind === "bingo" && state.ticket.pattern === "corners" ? g("bingoCorners") : kind === "bingo" ? g("bingoLine") : "";
            const dual = kind === "dual-bingo" ? (state.ticket.patterns?.includes("x") ? g("dualX") : state.ticket.patterns?.every((p) => p !== "miss") ? g("dualBingo") : g("bingoLine")) : "";
            const words = kind === "crossword" ? g("wordsN", { n: state.ticket.completeCount }) : "";
            const gold = kind === "line-3" && state.ticket.goldLine ? g("goldLine") : "";
            const detail = [keyed, bingo, dual, words, gold, doubled].filter(Boolean).join(" · ") || displayMode(mode).title;
            ui.openResult({
              win: true,
              big: bigWin,
              jackpot,
              title: jackpot ? g("jackpotTitle") : bigWin ? g("bigTitle") : g("winTitle"),
              prize,
              bonus,
              detail,
              tier: state.ticket.tier.label,
              gained: prize + bonus,
              walletAfter: state.coins
            });
          } else {
            audio.lose();
            void sdk.device.haptics.vibrate([25, 70, 35]).catch(() => {});
            const miss = kind === "match-number" || kind === "key-match" ? g("missMatch")
              : kind === "bingo" || kind === "dual-bingo" ? g("missBingo")
              : kind === "compare" ? g("missCompare")
              : kind === "coordinate" ? g("missCoord")
              : kind === "walk" ? g("missWalk")
              : kind === "maze" ? g("missMaze")
              : kind === "crossword" ? g("missWords")
              : kind === "sum7" ? g("missSum")
              : g("missDefault");
            ui.openResult({
              win: false,
              title: g("missTitle"),
              detail: discoveries ? `${miss} · ${g("albumBonus", { n: bonus })}` : miss
            });
          }
          refresh(1);
          const score = state.collected.size * 100 + state.plays;
          void sdk.leaderboard.submit(score).catch(() => {});
        }

        function abandonTicket() {
          if (state.settled || !state.ticket) return;
          serialClaim = null;
          state.stubs = state.stubs.filter((item) => item.status !== "pending");
          state.coins += currentMode().cost;
          state.plays = Math.max(0, state.plays - 1);
          state.ticket = null;
          state.settled = true;
        }

        function switchMode(id) {
          if (scratchStarted()) {
            ui.showToast(g("finishScratch"));
            return;
          }
          const list = modesInCountry();
          const pos = Math.max(0, list.findIndex((entry) => entry.index === state.modeIndex));
          let nextIndex = state.modeIndex;
          if (id === "prev") nextIndex = list[(pos - 1 + list.length) % list.length].index;
          else if (id === "next") nextIndex = list[(pos + 1) % list.length].index;
          else nextIndex = Math.max(0, MODES.findIndex((mode) => mode.id === id));
          if (nextIndex === state.modeIndex) return;
          const refund = !state.settled && state.ticket ? currentMode().cost : 0;
          if (state.coins + refund < MODES[nextIndex].cost) {
            ui.openInsufficient();
            return;
          }
          abandonTicket();
          state.modeIndex = nextIndex;
          persist();
          refresh(0);
          buyTicket();
        }

        refresh();
        ui.setAccount(session?.username || null);
        if (session?.token) {
          try {
            const data = await accounts.load(session.token);
            session = { username: data.username, token: data.token || session.token };
            const cloud = gameSaveOf(data.save, "scratch");
            if (cloud) applySaveData(cloud);
          } catch {
            session = null;
            ui.setAccount(null);
          }
        }
        afterAuth();

        cleanup = () => {
          alive = false;
          shell.removeEventListener("pointerdown", unlock, true);
          shell.removeEventListener("touchstart", unlock, true);
          document.removeEventListener("WeixinJSBridgeReady", unlock);
          scratch?.destroy();
          renderer?.destroy();
          audio.destroy();
          unsubscribers.forEach((unsubscribe) => unsubscribe?.());
          mount.replaceChildren();
        };
      };

      void boot();

      cleanup = () => {
        alive = false;
        audio.destroy();
        unsubscribers.forEach((unsubscribe) => unsubscribe?.());
        mount.replaceChildren();
      };
    },
    destroy() {
      cleanup();
      cleanup = () => {};
    },
    sdk,
    ready,
    tweaks,
    assets,
  };
}
