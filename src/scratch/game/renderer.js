import { TICKET_EDITION_SIZE, ticketSeries, ticketsLeft } from "./data.js";
import { countryLabel, displayMode, g, localeFont, tierLabel } from "./i18n.js";

const FRAME_URLS = {
  A: "/generated-assets/charms_a-transparent.frames.json",
  B: "/generated-assets/charms_b-transparent.frames.json",
  C: "/generated-assets/charms_c-transparent.frames.json",
  D: "/generated-assets/charms_d-transparent.frames.json",
  E: "/generated-assets/charms_e-transparent.frames.json",
  F: "/generated-assets/charms_f-transparent.frames.json",
  G: "/generated-assets/charms_g-transparent.frames.json",
  H: "/generated-assets/charms_h-transparent.frames.json",
  I: "/generated-assets/charms_i-transparent.frames.json",
  J: "/generated-assets/charms_j-transparent.frames.json",
  K: "/generated-assets/charms_k-transparent.frames.json",
  L: "/generated-assets/charms_l-transparent.frames.json"
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function hashSeed(value) {
  let h = 2166136261;
  for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function drawContained(ctx, image, frame, box, scaleBoost = 1) {
  const crop = frame.content || frame.source;
  const inset = crop.w > 12 && crop.h > 12 ? 2 : 0;
  const sx = crop.x + inset;
  const sy = crop.y + inset;
  const sw = Math.max(1, crop.w - inset * 2);
  const sh = Math.max(1, crop.h - inset * 2);
  const scale = Math.min(box.w / sw, box.h / sh) * scaleBoost;
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(image, sx, sy, sw, sh, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

export async function createRenderer({ stage, baseCanvas, scratchCanvas, effectsCanvas, assets }) {
  const ticketKeys = ["TICKET_CHINA", "TICKET_JAPAN", "TICKET_USA", "TICKET_KOREA", "TICKET_UK", "TICKET_FRANCE", "TICKET_INDIA", "TICKET_MEXICO", "TICKET_EGYPT"];
  const groupKeys = Object.keys(FRAME_URLS);
  const [wood, ticketList, charmPacks] = await Promise.all([
    loadImage(assets.get("WOOD_BACKDROP")),
    Promise.all(ticketKeys.map(async (key) => [key, await loadImage(assets.get(key))])),
    Promise.all(groupKeys.map(async (group) => {
      const [image, frameData] = await Promise.all([
        loadImage(assets.get(`CHARMS_${group}`)),
        fetch(FRAME_URLS[group]).then((response) => response.json())
      ]);
      return [group, image, new Map(frameData.frames.map((frame) => [frame.name, frame]))];
    }))
  ]);
  const ticketImages = Object.fromEntries(ticketList);
  const charmImages = Object.fromEntries(charmPacks.map(([group, image]) => [group, image]));
  const frameMaps = Object.fromEntries(charmPacks.map(([group, , frames]) => [group, frames]));
  const contexts = [baseCanvas, scratchCanvas, effectsCanvas].map((canvas) => canvas.getContext("2d"));
  let width = 1;
  let height = 1;
  let ticketRect = { x: 0, y: 0, w: 1, h: 1 };
  let slots = [];
  let mode;
  let ticket;
  let marks = [];
  let grids = [];
  let revealedAt = [];
  let particles = [];
  let winGlowUntil = 0;
  let lastFrame = performance.now();
  let animationId;

  function computeLayout() {
    const kind = mode?.kind;
    const dense = kind === "match-number" || kind === "key-match" || kind === "bingo" || kind === "coordinate" || kind === "crossword" || kind === "dual-bingo" || kind === "walk" || kind === "maze" || kind === "sum7";
    const wide = kind === "line-3" || kind === "triangle" || kind === "bingo" || kind === "coordinate" || kind === "crossword" || kind === "dual-bingo" || kind === "walk" || kind === "maze";
    const packedMatch = kind === "match-number" && (mode.slots || 0) > 6;
    const hintBand = kind ? Math.max(36, height * .055) : (dense ? height * .018 : 0);
    const maxH = (height - hintBand) * (dense ? .96 : .99);
    const maxW = width * .94;
    const h = Math.min(maxH, maxW * 1.5);
    const w = h / 1.5;
    ticketRect = {
      x: Math.round((width - w) / 2),
      y: Math.round(hintBand + Math.max(0, (height - hintBand - h) / 2)),
      w: Math.round(w),
      h: Math.round(h)
    };
    const insetX = ticketRect.w * (kind === "match-number" || kind === "key-match" ? .09 : wide ? .055 : .095);
    const left = ticketRect.x + insetX;
    const right = ticketRect.x + ticketRect.w - insetX;
    const top = ticketRect.y + ticketRect.h * (kind === "match-number" || kind === "key-match" || wide || kind === "sum7" ? .235 : .34);
    const bottom = ticketRect.y + ticketRect.h * (kind === "dual-bingo" || kind === "crossword" || packedMatch ? .90 : kind === "match-number" || kind === "key-match" ? .86 : .82);
    const areaW = right - left;
    const areaH = bottom - top;
    const gap = ticketRect.w * .018;
    if (kind === "match-number" || kind === "key-match") {
      const count = kind === "key-match" ? 6 : Math.max(1, mode.slots || 6);
      const cols = kind === "key-match" ? 3 : Math.max(1, mode.cols || 3);
      const rows = Math.ceil(count / cols);
      const bannerH = Math.min(areaH * (rows >= 3 ? .15 : .22), ticketRect.h * (rows >= 3 ? .065 : .09));
      const restH = areaH - bannerH - gap;
      const cellW = (areaW - gap * (cols - 1)) / cols;
      const cellH = (restH - gap * (rows - 1)) / rows;
      const winning = { x: left, y: top, w: areaW, h: bannerH, role: "winning" };
      const cells = Array.from({ length: count }, (_, index) => ({
        x: left + (index % cols) * (cellW + gap),
        y: top + bannerH + gap + Math.floor(index / cols) * (cellH + gap),
        w: cellW,
        h: cellH,
        role: "cell"
      }));
      slots = [winning, ...cells];
      return;
    }
    if (kind === "line-3") {
      const cellW = (areaW - gap * 2) / 3;
      const cellH = (areaH - gap * 2) / 3;
      slots = Array.from({ length: 9 }, (_, index) => ({
        x: left + (index % 3) * (cellW + gap),
        y: top + Math.floor(index / 3) * (cellH + gap),
        w: cellW,
        h: cellH
      }));
      return;
    }
    if (kind === "bingo") {
      const callerH = areaH * .28;
      const cellW = (areaW - gap * 3) / 4;
      const callerCellH = (callerH - gap) / 2;
      const callers = Array.from({ length: 8 }, (_, index) => ({
        x: left + (index % 4) * (cellW + gap),
        y: top + Math.floor(index / 4) * (callerCellH + gap),
        w: cellW,
        h: callerCellH,
        role: "caller"
      }));
      const boardTop = top + callerH + gap;
      const boardH = bottom - boardTop;
      const boardW = (areaW - gap * 2) / 3;
      const boardCellH = (boardH - gap * 2) / 3;
      const cards = Array.from({ length: 9 }, (_, index) => ({
        x: left + (index % 3) * (boardW + gap),
        y: boardTop + Math.floor(index / 3) * (boardCellH + gap),
        w: boardW,
        h: boardCellH,
        role: "card"
      }));
      slots = [...callers, ...cards];
      return;
    }
    if (kind === "coordinate") {
      const pairH = Math.min(areaH * .2, ticketRect.h * .085);
      const pairW = (areaW - gap) / 2;
      const coordW = (pairW - gap) / 2;
      const coords = Array.from({ length: 4 }, (_, index) => {
        const pair = Math.floor(index / 2);
        const inner = index % 2;
        return {
          x: left + pair * (pairW + gap) + inner * (coordW + gap),
          y: top,
          w: coordW,
          h: pairH,
          role: inner ? "coord-number" : "coord-letter"
        };
      });
      const boardTop = top + pairH + gap;
      const boardH = bottom - boardTop;
      const cols = 3;
      const rows = 4;
      const cellW = (areaW - gap * (cols - 1)) / cols;
      const cellH = (boardH - gap * (rows - 1)) / rows;
      const board = Array.from({ length: 12 }, (_, index) => ({
        x: left + (index % cols) * (cellW + gap),
        y: boardTop + Math.floor(index / cols) * (cellH + gap),
        w: cellW,
        h: cellH,
        role: "board"
      }));
      slots = [...coords, ...board];
      return;
    }
    if (kind === "walk" || kind === "maze") {
      const bannerH = kind === "walk" ? Math.min(areaH * .18, ticketRect.h * .075) : 0;
      const gridTop = top + (bannerH ? bannerH + gap : 0);
      const gridH = bottom - gridTop;
      const cellW = (areaW - gap * 3) / 4;
      const cellH = (gridH - gap) / 2;
      const path = [
        { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
        { col: 3, row: 1 }, { col: 2, row: 1 }, { col: 1, row: 1 }, { col: 0, row: 1 }
      ].map((pos) => ({
        x: left + pos.col * (cellW + gap),
        y: gridTop + pos.row * (cellH + gap),
        w: cellW,
        h: cellH,
        role: "path"
      }));
      slots = kind === "walk" ? [{ x: left, y: top, w: areaW, h: bannerH, role: "steps" }, ...path] : path;
      return;
    }
    if (kind === "crossword") {
      const letterH = areaH * .48;
      const cellW = (areaW - gap * 3) / 4;
      const cellH = (letterH - gap * 2) / 3;
      const letters = Array.from({ length: 12 }, (_, index) => ({
        x: left + (index % 4) * (cellW + gap),
        y: top + Math.floor(index / 4) * (cellH + gap),
        w: cellW,
        h: cellH,
        role: "letter"
      }));
      const wordTop = top + letterH + gap;
      const wordH = (bottom - wordTop - gap * 5) / 6;
      const words = Array.from({ length: 6 }, (_, index) => ({
        x: left,
        y: wordTop + index * (wordH + gap),
        w: areaW,
        h: wordH,
        role: "word"
      }));
      slots = [...letters, ...words];
      return;
    }
    if (kind === "dual-bingo") {
      const callerH = areaH * .3;
      const callerW = (areaW - gap * 5) / 6;
      const callerCellH = (callerH - gap) / 2;
      const callers = Array.from({ length: 12 }, (_, index) => ({
        x: left + (index % 6) * (callerW + gap),
        y: top + Math.floor(index / 6) * (callerCellH + gap),
        w: callerW,
        h: callerCellH,
        role: "caller"
      }));
      const boardTop = top + callerH + gap * 1.6;
      const boardH = bottom - boardTop;
      const cardGap = gap * 1.4;
      const cardW = (areaW - cardGap) / 2;
      const inner = gap * .7;
      const cellW = (cardW - inner * 2) / 3;
      const cellH = (boardH - inner * 2) / 3;
      const cards = [0, 1].flatMap((card) => Array.from({ length: 9 }, (_, index) => ({
        x: left + card * (cardW + cardGap) + (index % 3) * (cellW + inner),
        y: boardTop + Math.floor(index / 3) * (cellH + inner),
        w: cellW,
        h: cellH,
        role: "card",
        card
      })));
      slots = [...callers, ...cards];
      return;
    }
    if (kind === "triangle") {
      const size = Math.min(areaW, areaH) * .28;
      const points = [[.5, .12], [.22, .48], [.78, .48], [.1, .86], [.5, .86], [.9, .86]];
      slots = points.map(([px, py]) => ({
        x: left + px * areaW - size / 2,
        y: top + py * areaH - size / 2,
        w: size,
        h: size
      }));
      return;
    }
    if (kind === "multiplier") {
      const barH = Math.min(areaH * .18, ticketRect.h * .08);
      const gridH = areaH - barH - gap;
      const cellW = (areaW - gap) / 2;
      const cellH = (gridH - gap * 2) / 3;
      const cells = Array.from({ length: 6 }, (_, index) => ({
        x: left + (index % 2) * (cellW + gap),
        y: top + Math.floor(index / 2) * (cellH + gap),
        w: cellW,
        h: cellH
      }));
      slots = [...cells, { x: left, y: bottom - barH, w: areaW, h: barH, role: "multiplier" }];
      return;
    }
    if (kind === "instant-symbol" || kind === "pair-match" || kind === "compare" || kind === "sum7") {
      const cols = kind === "instant-symbol" ? 3 : 2;
      const rows = kind === "instant-symbol" ? 2 : kind === "sum7" ? 4 : 3;
      const cellW = (areaW - gap * (cols - 1)) / cols;
      const cellH = (areaH - gap * (rows - 1)) / rows;
      slots = Array.from({ length: cols * rows }, (_, index) => ({
        x: left + (index % cols) * (cellW + gap),
        y: top + Math.floor(index / cols) * (cellH + gap),
        w: cellW,
        h: cellH,
        role: kind === "compare" || kind === "sum7" ? (index % 2 ? "theirs" : "mine") : "cell"
      }));
      return;
    }
    const cols = mode?.cols || 2;
    const count = mode?.slots || 6;
    const rows = Math.ceil(count / cols);
    const gridGap = ticketRect.w * (count >= 15 ? .012 : .022);
    const maxCellW = (areaW - gridGap * (cols - 1)) / cols;
    const maxCellH = (areaH - gridGap * (rows - 1)) / rows;
    const cellW = Math.min(maxCellW, maxCellH * 1.14);
    const cellH = Math.min(maxCellH, cellW * 1.05);
    const gridH = rows * cellH + gridGap * (rows - 1);
    const startY = top + (areaH - gridH) / 2;
    slots = Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / cols);
      const rowCount = Math.min(cols, count - row * cols);
      const rowW = rowCount * cellW + gridGap * (rowCount - 1);
      const startX = left + (areaW - rowW) / 2;
      return {
        x: startX + (index % cols) * (cellW + gridGap),
        y: startY + row * (cellH + gridGap),
        w: cellW,
        h: cellH
      };
    });
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    [baseCanvas, scratchCanvas, effectsCanvas].forEach((canvas, index) => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      contexts[index].setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    computeLayout();
    redrawCoating();
  }

  function setTicket(nextMode, nextTicket) {
    mode = nextMode;
    ticket = nextTicket;
    marks = [];
    revealedAt = [];
    particles = [];
    winGlowUntil = 0;
    computeLayout();
    grids = Array.from({ length: slots.length }, () => new Uint8Array(18 * 18));
    redrawCoating();
  }

  function drawSerialBand(ctx, x, y, w, h) {
    const serial = String(ticket?.serial || "").replace(/\D/g, "");
    const digits = (serial ? serial.padStart(5, "0") : "-----").split("");
    const radius = Math.min(h * .28, 8);
    roundRect(ctx, x, y, w, h, radius);
    const gold = ctx.createLinearGradient(x, y, x, y + h);
    gold.addColorStop(0, "#fff4c0");
    gold.addColorStop(.42, "#e4b34a");
    gold.addColorStop(1, "#9a5f16");
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.strokeStyle = "#fff8d6";
    ctx.lineWidth = Math.max(1, h * .06);
    ctx.stroke();
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(2, radius - 1));
    ctx.strokeStyle = "rgba(90,42,8,.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const locCountry = countryLabel(mode.country);
    const series = ticketSeries(mode);
    const padX = w * .016;
    const countryW = Math.max(36, Math.min(w * .22, locCountry.length * h * .32 + 10));
    const left = ticketsLeft(serial, ticket?.editionIssued);
    const editionLabel = g("edition", { n: left, total: TICKET_EDITION_SIZE });
    const badgeMax = Math.min(w * .46, w - countryW - 88);
    let editionSize = Math.max(7, h * .34);
    let editionFont = `500 ${editionSize}px ${localeFont()}`;
    ctx.font = editionFont;
    while (editionSize > 6 && ctx.measureText(editionLabel).width + h * .5 > badgeMax) {
      editionSize -= 0.4;
      editionFont = `500 ${editionSize}px ${localeFont()}`;
      ctx.font = editionFont;
    }
    const badgeW = Math.max(72, Math.min(badgeMax, ctx.measureText(editionLabel).width + h * .5));
    const noW = w - countryW - badgeW - padX * 4;
    const midY = y + h / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5c2f0c";
    ctx.font = `800 ${Math.max(9, h * .38)}px ${localeFont()}`;
    ctx.fillText(locCountry, x + padX + countryW / 2, midY);

    const cellGap = Math.max(2, noW * .014);
    const wordW = Math.max(14, h * .62);
    const seriesW = Math.max(18, series.length * h * .42);
    const innerW = Math.max(36, noW - wordW * 2 - seriesW - cellGap);
    const cellW = Math.min((innerW - cellGap * (digits.length - 1)) / digits.length, h * .78);
    const rowW = wordW + seriesW + cellGap + digits.length * cellW + (digits.length - 1) * cellGap + wordW;
    const startX = x + padX * 2 + countryW + Math.max(0, (noW - rowW) / 2);
    ctx.fillStyle = "#5c2f0c";
    ctx.font = `900 ${Math.max(10, h * .42)}px ${localeFont()}`;
    ctx.fillText(g("serialBefore"), startX + wordW / 2, midY);
    let cx = startX + wordW;
    ctx.fillStyle = "#3a1c08";
    ctx.font = `900 ${Math.max(10, h * .4)}px "Courier New", ui-monospace, ${localeFont()}`;
    ctx.fillText(series, cx + seriesW / 2, midY);
    cx += seriesW + cellGap;
    digits.forEach((digit) => {
      roundRect(ctx, cx, y + h * .14, cellW, h * .72, Math.max(2, cellW * .12));
      ctx.fillStyle = "#1a1008";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 232, 160, .55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#ffe38a";
      ctx.font = `900 ${Math.max(11, h * .48)}px "Courier New", ui-monospace, ${localeFont()}`;
      ctx.fillText(digit, cx + cellW / 2, midY + 0.5);
      cx += cellW + cellGap;
    });
    ctx.fillStyle = "#5c2f0c";
    ctx.font = `900 ${Math.max(10, h * .42)}px ${localeFont()}`;
    ctx.fillText(g("serialAfter"), cx + wordW / 2 - cellGap, midY);

    const bx = x + w - padX - badgeW;
    const by = y + h * .16;
    const bh = h * .68;
    roundRect(ctx, bx, by, badgeW, bh, bh * .45);
    ctx.fillStyle = "#c43b2c";
    ctx.fill();
    ctx.strokeStyle = "#7a1f16";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#fff4c8";
    ctx.font = editionFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(editionLabel, bx + badgeW / 2, midY);
    ctx.textBaseline = "alphabetic";
  }

  function themeInk() {
    if (mode.ticket === "TICKET_USA") return { ink: "#f7e9bf", panel: "rgba(7,24,48,.82)", edge: "#d6ad62" };
    if (mode.ticket === "TICKET_CHINA") return { ink: "#fff0bd", panel: "rgba(104,12,10,.72)", edge: "#e7c063" };
    return { ink: "#31261f", panel: "rgba(255,250,229,.82)", edge: mode.accent };
  }

  function drawBase(now) {
    const ctx = contexts[0];
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(wood, 0, 0, width, height);
    if (!mode || !ticket) return;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = Math.max(8, ticketRect.w * .035);
    ctx.shadowOffsetY = ticketRect.w * .018;
    ctx.drawImage(ticketImages[mode.ticket], ticketRect.x, ticketRect.y, ticketRect.w, ticketRect.h);
    ctx.restore();
    const theme = themeInk();
    const kind = mode.kind;
    const compact = Boolean(kind);
    const pad = ticketRect.w * .09;
    const headerY = ticketRect.y + ticketRect.h * (compact ? .105 : .135);
    const headerH = ticketRect.h * (compact ? .115 : .165);
    const headerX = ticketRect.x + pad;
    const headerW = ticketRect.w - pad * 2;
    roundRect(ctx, headerX, headerY, headerW, headerH, ticketRect.w * .035);
    ctx.fillStyle = theme.panel;
    ctx.fill();
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = Math.max(1, ticketRect.w * .005);
    ctx.stroke();
    const shown = displayMode(mode);
    const title = kind === "match-number" && ticket.mascot ? `${shown.title} · ${ticket.mascot}` : shown.title;
    const subtitle = shown.hint || (kind === "match-number" ? g("matchHint") : kind === "line-3" ? g("lineHint") : shown.subtitle);
    if (kind) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(12,8,4,.82)";
      ctx.fillStyle = "#fff8e8";
      const hintSize = Math.max(12, Math.min(ticketRect.w * .038, ticketRect.y * .42));
      ctx.lineWidth = Math.max(3, hintSize * .22);
      ctx.font = `800 ${hintSize}px ${localeFont()}`;
      const hintY = ticketRect.y - Math.max(6, ctx.lineWidth * .55);
      ctx.strokeText(subtitle, ticketRect.x + ticketRect.w / 2, hintY);
      ctx.fillText(subtitle, ticketRect.x + ticketRect.w / 2, hintY);
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = theme.ink;
    let titleSize = Math.max(15, ticketRect.w * (compact ? .048 : .068));
    ctx.font = `900 ${titleSize}px ${localeFont()}`;
    const titleMax = headerW * .92;
    while (titleSize > 11 && ctx.measureText(title).width > titleMax) {
      titleSize -= 0.5;
      ctx.font = `900 ${titleSize}px ${localeFont()}`;
    }
    ctx.fillText(title, ticketRect.x + ticketRect.w / 2, headerY + headerH * .32);
    ctx.font = `600 ${Math.max(9, ticketRect.w * .024)}px ${localeFont()}`;
    ctx.fillText(shown.subtitle, ticketRect.x + ticketRect.w / 2, headerY + headerH * .52);
    drawSerialBand(ctx, headerX + headerW * .03, headerY + headerH * .60, headerW * .94, headerH * .34);

    if (kind === "match-number" || kind === "key-match") drawMatchNumberSlots(ctx, now);
    else if (kind === "compare") drawCompareSlots(ctx, now);
    else if (kind === "bingo") drawBingoSlots(ctx, now);
    else if (kind === "instant-symbol") drawInstantSlots(ctx, now);
    else if (kind === "coordinate") drawCoordinateSlots(ctx, now);
    else if (kind === "walk") drawWalkSlots(ctx, now);
    else if (kind === "maze") drawMazeSlots(ctx, now);
    else if (kind === "crossword") drawCrosswordSlots(ctx, now);
    else if (kind === "dual-bingo") drawDualBingoSlots(ctx, now);
    else if (kind === "sum7") drawSum7Slots(ctx, now);
    else drawIconSlots(ctx, now);
  }

  function drawIconSlots(ctx, now) {
    const lineCells = new Set(ticket.hitCells || ticket.lineCells || []);
    const goldLine = Boolean(ticket.goldLine);
    slots.forEach((slot, index) => {
      if (slot.role === "multiplier") {
        const shown = Boolean(revealedAt[index]);
        const live = ticket.multiplier?.live && shown;
        roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.h * .28);
        ctx.fillStyle = live ? "#15233d" : "#fffbe6";
        ctx.fill();
        ctx.strokeStyle = live ? "#f3d27a" : mode.accent;
        ctx.lineWidth = Math.max(1.4, ticketRect.w * .005);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = live ? "#f3d27a" : "#3f3027";
        ctx.font = `900 ${Math.max(16, slot.h * .48)}px ${localeFont()}`;
        ctx.fillText(tierLabel(ticket.multiplier?.label || "×1"), slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.textBaseline = "alphabetic";
        return;
      }
      const onLine = lineCells.has(index);
      const shown = Boolean(revealedAt[index]);
      const highlight = onLine && shown;
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.w * .1);
      ctx.fillStyle = highlight
        ? goldLine ? "#ffe496" : "#ffecb0"
        : mode.ticket === "TICKET_USA" ? "#f8f0d8" : "#fffbe6";
      ctx.fill();
      ctx.strokeStyle = highlight ? (goldLine ? "#d7a227" : "#c84a38") : mode.accent;
      ctx.lineWidth = Math.max(1.2, ticketRect.w * (highlight ? .007 : .004));
      ctx.stroke();
      const symbol = ticket.symbols[index];
      if (!symbol) return;
      const image = charmImages[symbol.group];
      const frame = frameMaps[symbol.group].get(symbol.id);
      if (!frame) return;
      const age = shown ? (now - revealedAt[index]) / 1000 : 0;
      const bounce = shown ? Math.sin(Math.min(age, 1.4) * 13) * Math.exp(-age * 2.2) : 0;
      ctx.save();
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.rotate(bounce * .17 + Math.sin(now / 520 + index) * .018);
      const scale = shown ? 1 + Math.abs(bounce) * .08 : 1;
      ctx.scale(scale, scale);
      const iconBox = mode.kind === "line-3" || mode.kind === "triangle"
        ? { x: -slot.w * .38, y: -slot.h * .38, w: slot.w * .76, h: slot.h * .7 }
        : { x: -slot.w * .34, y: -slot.h * .34, w: slot.w * .68, h: slot.h * .64 };
      drawContained(ctx, image, frame, iconBox);
      ctx.restore();
      ctx.fillStyle = highlight && goldLine ? "#7a4a12" : "#3f3027";
      ctx.font = `700 ${Math.max(8, ticketRect.w * .025)}px ${localeFont()}`;
      ctx.textAlign = "center";
      ctx.fillText(symbol.name, slot.x + slot.w / 2, slot.y + slot.h * .9);
    });
    const line = ticket.lineCells;
    if ((mode.kind === "line-3" || mode.kind === "triangle") && line?.length && line.every((index) => revealedAt[index])) {
      const first = slots[line[0]];
      const last = slots[line[line.length - 1]];
      ctx.save();
      ctx.strokeStyle = goldLine ? "rgba(212,154,42,.72)" : "rgba(200,74,56,.62)";
      ctx.lineWidth = Math.max(4, ticketRect.w * .016);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(first.x + first.w / 2, first.y + first.h / 2);
      ctx.lineTo(last.x + last.w / 2, last.y + last.h / 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMatchNumberSlots(ctx, now) {
    slots.forEach((slot, index) => {
      if (slot.role === "winning") {
        roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.h * .28);
        ctx.fillStyle = "#15233d";
        ctx.fill();
        ctx.strokeStyle = "#d6ad62";
        ctx.lineWidth = Math.max(1.4, ticketRect.w * .005);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#f3d27a";
        ctx.font = `900 ${Math.max(18, slot.h * .58)}px ${localeFont()}`;
        ctx.fillText(ticket.winningLabel, slot.x + slot.w / 2, slot.y + slot.h * .72);
        return;
      }
      const cell = ticket.cells[index - 1];
      if (!cell) return;
      const hit = cell?.hit;
      const shown = Boolean(revealedAt[index]);
      const age = shown ? (now - revealedAt[index]) / 1000 : 0;
      const bounce = shown ? Math.sin(Math.min(age, 1.4) * 13) * Math.exp(-age * 2.2) : 0;
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.w * .12);
      ctx.fillStyle = hit && shown ? "#ffecb0" : "#fffbe6";
      ctx.fill();
      ctx.strokeStyle = hit && shown ? "#c8891f" : mode.accent;
      ctx.lineWidth = Math.max(1.4, ticketRect.w * (hit && shown ? .007 : .004));
      ctx.stroke();
      ctx.save();
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h * .42);
      ctx.scale(1 + Math.abs(bounce) * .08, 1 + Math.abs(bounce) * .08);
      const radius = Math.min(slot.w, slot.h) * .22;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = hit && shown ? "#f4c648" : "#fff";
      ctx.fill();
      ctx.strokeStyle = hit && shown ? "#8f5315" : "rgba(63,48,39,.28)";
      ctx.lineWidth = Math.max(1, ticketRect.w * .004);
      ctx.stroke();
      ctx.fillStyle = hit && shown ? "#5a320c" : "#2c221c";
      ctx.font = `900 ${Math.max(12, radius * (cell?.key ? .7 : .95))}px ${localeFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cell.label, 0, 1);
      ctx.restore();
      ctx.fillStyle = hit && shown ? "#8a3b12" : "#3f3027";
      ctx.font = `700 ${Math.max(8, Math.min(slot.h * .2, ticketRect.w * .028))}px ${localeFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(g("goldAmount", { n: cell.prize }), slot.x + slot.w / 2, slot.y + slot.h * .88);
    });
  }

  function drawInstantSlots(ctx, now) {
    slots.forEach((slot, index) => {
      const cell = ticket.cells[index];
      const shown = Boolean(revealedAt[index]);
      const hit = cell?.hit && shown;
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.w * .12);
      ctx.fillStyle = hit ? "#ffecb0" : "#fffbe6";
      ctx.fill();
      ctx.strokeStyle = hit ? "#c8891f" : mode.accent;
      ctx.lineWidth = Math.max(1.2, ticketRect.w * (hit ? .007 : .004));
      ctx.stroke();
      const symbol = cell.symbol;
      const frame = frameMaps[symbol.group].get(symbol.id);
      if (frame) {
        const age = shown ? (now - revealedAt[index]) / 1000 : 0;
        const bounce = shown ? Math.sin(Math.min(age, 1.4) * 13) * Math.exp(-age * 2.2) : 0;
        ctx.save();
        ctx.translate(slot.x + slot.w / 2, slot.y + slot.h * .4);
        ctx.scale(1 + Math.abs(bounce) * .08, 1 + Math.abs(bounce) * .08);
        drawContained(ctx, charmImages[symbol.group], frame, { x: -slot.w * .32, y: -slot.h * .32, w: slot.w * .64, h: slot.h * .5 });
        ctx.restore();
      }
      ctx.fillStyle = hit ? "#8a3b12" : "#3f3027";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(8, ticketRect.w * .024)}px ${localeFont()}`;
      ctx.fillText(symbol.name, slot.x + slot.w / 2, slot.y + slot.h * .74);
      ctx.font = `700 ${Math.max(8, ticketRect.w * .026)}px ${localeFont()}`;
      ctx.fillText(g("goldAmount", { n: cell.prize }), slot.x + slot.w / 2, slot.y + slot.h * .9);
    });
  }

  function drawCompareSlots(ctx, now) {
    slots.forEach((slot, index) => {
      const round = ticket.rounds[Math.floor(index / 2)];
      const mine = index % 2 === 0;
      const base = index - (index % 2);
      const roundShown = Boolean(revealedAt[base] && revealedAt[base + 1]);
      const hit = round.hit && roundShown;
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.w * .1);
      ctx.fillStyle = hit ? "#ffecb0" : mine ? "#fffbe6" : "#f3e6c8";
      ctx.fill();
      ctx.strokeStyle = hit ? "#c8891f" : mode.accent;
      ctx.lineWidth = Math.max(1.2, ticketRect.w * .004);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "#7a6450";
      ctx.font = `700 ${Math.max(9, ticketRect.w * .024)}px ${localeFont()}`;
      ctx.fillText(mine ? g("myScore") : g("rivalScore"), slot.x + slot.w / 2, slot.y + slot.h * .28);
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(18, slot.h * .38)}px ${localeFont()}`;
      ctx.fillText(String(mine ? round.mine : round.theirs), slot.x + slot.w / 2, slot.y + slot.h * .68);
      if (mine) {
        ctx.fillStyle = hit ? "#8a3b12" : "#6a5644";
        ctx.font = `700 ${Math.max(8, ticketRect.w * .022)}px ${localeFont()}`;
        ctx.fillText(g("goldAmount", { n: round.prize }), slot.x + slot.w / 2, slot.y + slot.h * .9);
      }
    });
  }

  function drawBingoSlots(ctx, now) {
    const marked = new Set(ticket.marked || []);
    slots.forEach((slot, index) => {
      const shown = Boolean(revealedAt[index]);
      const isCaller = slot.role === "caller";
      const cardIndex = isCaller ? -1 : index - 8;
      const value = isCaller ? ticket.caller[index] : ticket.card[cardIndex];
      const hit = !isCaller && marked.has(cardIndex) && shown;
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, Math.min(slot.w, slot.h) * .16);
      ctx.fillStyle = isCaller ? "#15233d" : hit ? "#ffecb0" : "#fffbe6";
      ctx.fill();
      ctx.strokeStyle = hit ? "#c8891f" : isCaller ? "#d6ad62" : mode.accent;
      ctx.lineWidth = Math.max(1.1, ticketRect.w * (hit ? .006 : .004));
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isCaller ? "#f3d27a" : hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(11, Math.min(slot.h * .48, ticketRect.w * .045))}px ${localeFont()}`;
      ctx.fillText(String(value).padStart(2, "0"), slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.textBaseline = "alphabetic";
    });
  }

  function paintCell(ctx, slot, { hit = false, dark = false }) {
    roundRect(ctx, slot.x, slot.y, slot.w, slot.h, Math.min(slot.w, slot.h) * .16);
    ctx.fillStyle = dark ? "#15233d" : hit ? "#ffecb0" : "#fffbe6";
    ctx.fill();
    ctx.strokeStyle = hit ? "#c8891f" : dark ? "#d6ad62" : mode.accent;
    ctx.lineWidth = Math.max(1.1, ticketRect.w * (hit ? .006 : .004));
    ctx.stroke();
  }

  function drawCoordinateSlots(ctx) {
    slots.forEach((slot, index) => {
      if (slot.role !== "board") {
        const coord = ticket.coords[Math.floor(index / 2)];
        const letter = index % 2 === 0;
        paintCell(ctx, slot, { dark: true });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f3d27a";
        ctx.font = `900 ${Math.max(14, slot.h * .52)}px ${localeFont()}`;
        ctx.fillText(letter ? coord.letter : String(coord.number), slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.textBaseline = "alphabetic";
        return;
      }
      const cell = ticket.board[index - 4];
      const shown = Boolean(revealedAt[index]);
      const hit = cell.hit && shown;
      paintCell(ctx, slot, { hit });
      ctx.textAlign = "center";
      ctx.fillStyle = hit ? "#8a3b12" : "#7a6450";
      ctx.font = `700 ${Math.max(8, ticketRect.w * .022)}px ${localeFont()}`;
      ctx.fillText(cell.label, slot.x + slot.w / 2, slot.y + slot.h * .28);
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(11, slot.h * .34)}px ${localeFont()}`;
      ctx.fillText(cell.prize ? `${cell.prize}` : "—", slot.x + slot.w / 2, slot.y + slot.h * .68);
    });
  }

  function drawWalkSlots(ctx) {
    slots.forEach((slot, index) => {
      if (slot.role === "steps") {
        paintCell(ctx, slot, { dark: true });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f3d27a";
        ctx.font = `900 ${Math.max(16, slot.h * .5)}px ${localeFont()}`;
        ctx.fillText(g("walkN", { n: ticket.steps }), slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.textBaseline = "alphabetic";
        return;
      }
      const cell = ticket.cells[index - 1];
      const shown = Boolean(revealedAt[index]);
      const hit = cell.hit && shown;
      paintCell(ctx, slot, { hit });
      ctx.textAlign = "center";
      ctx.fillStyle = hit ? "#8a3b12" : "#7a6450";
      ctx.font = `700 ${Math.max(8, ticketRect.w * .022)}px ${localeFont()}`;
      ctx.fillText(index === 1 ? g("startMark") : `${cell.step}`, slot.x + slot.w / 2, slot.y + slot.h * .26);
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(12, slot.h * .36)}px ${localeFont()}`;
      ctx.fillText(cell.prize ? `${cell.prize}` : "—", slot.x + slot.w / 2, slot.y + slot.h * .68);
    });
  }

  function drawMazeSlots(ctx) {
    slots.forEach((slot, index) => {
      const cell = ticket.cells[index];
      const shown = Boolean(revealedAt[index]);
      const hit = cell.hit && shown;
      paintCell(ctx, slot, { hit, dark: Boolean(cell.end) && !hit });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (cell.end) {
        ctx.fillStyle = hit ? "#8a3b12" : "#f3d27a";
        ctx.font = `800 ${Math.max(9, ticketRect.w * .022)}px ${localeFont()}`;
        ctx.fillText(g("endMark"), slot.x + slot.w / 2, slot.y + slot.h * .28);
        ctx.fillStyle = hit ? "#8a3b12" : "#f3d27a";
        ctx.font = `900 ${Math.max(12, slot.h * .36)}px ${localeFont()}`;
        ctx.fillText(cell.prize ? `${cell.prize}` : "—", slot.x + slot.w / 2, slot.y + slot.h * .62);
      } else {
        ctx.fillStyle = "#7a6450";
        ctx.font = `800 ${Math.max(8, ticketRect.w * .02)}px ${localeFont()}`;
        ctx.fillText(cell.start ? g("startMark") : "", slot.x + slot.w / 2, slot.y + slot.h * .22);
        ctx.fillStyle = "#2c221c";
        ctx.font = `900 ${Math.max(18, slot.h * .42)}px ${localeFont()}`;
        ctx.fillText(cell.arrow, slot.x + slot.w / 2, slot.y + slot.h * (cell.start ? .58 : .52));
      }
      ctx.textBaseline = "alphabetic";
    });
  }

  function drawCrosswordSlots(ctx) {
    slots.forEach((slot, index) => {
      if (slot.role === "letter") {
        paintCell(ctx, slot, { dark: true });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f3d27a";
        ctx.font = `900 ${Math.max(14, slot.h * .5)}px ${localeFont()}`;
        ctx.fillText(ticket.letters[index], slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.textBaseline = "alphabetic";
        return;
      }
      const word = ticket.words[index - 12];
      const shown = Boolean(revealedAt[index]);
      const hit = word.complete && shown;
      paintCell(ctx, slot, { hit });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(12, slot.h * .55)}px ${localeFont()}`;
      ctx.fillText(word.word.split("").join("  "), slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.textBaseline = "alphabetic";
    });
  }

  function drawDualBingoSlots(ctx) {
    slots.forEach((slot, index) => {
      const shown = Boolean(revealedAt[index]);
      if (slot.role === "caller") {
        paintCell(ctx, slot, { dark: true });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f3d27a";
        ctx.font = `900 ${Math.max(10, Math.min(slot.h * .48, ticketRect.w * .032))}px ${localeFont()}`;
        ctx.fillText(String(ticket.caller[index]).padStart(2, "0"), slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.textBaseline = "alphabetic";
        return;
      }
      const cardIndex = slot.card;
      const cellIndex = index - 12 - cardIndex * 9;
      const marked = new Set(ticket.marked[cardIndex] || []);
      const hit = marked.has(cellIndex) && shown;
      paintCell(ctx, slot, { hit });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(10, Math.min(slot.h * .42, ticketRect.w * .032))}px ${localeFont()}`;
      ctx.fillText(String(ticket.cards[cardIndex][cellIndex]).padStart(2, "0"), slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.textBaseline = "alphabetic";
    });
  }

  function drawSum7Slots(ctx) {
    slots.forEach((slot, index) => {
      const pair = ticket.pairs[Math.floor(index / 2)];
      const left = index % 2 === 0;
      const base = index - (index % 2);
      const shown = Boolean(revealedAt[base] && revealedAt[base + 1]);
      const hit = pair.hit && shown;
      paintCell(ctx, slot, { hit });
      ctx.textAlign = "center";
      ctx.fillStyle = "#7a6450";
      ctx.font = `700 ${Math.max(8, ticketRect.w * .02)}px ${localeFont()}`;
      ctx.fillText(left ? g("leftNum") : g("rightNum"), slot.x + slot.w / 2, slot.y + slot.h * .24);
      ctx.fillStyle = hit ? "#8a3b12" : "#2c221c";
      ctx.font = `900 ${Math.max(16, slot.h * .4)}px ${localeFont()}`;
      ctx.fillText(String(left ? pair.a : pair.b), slot.x + slot.w / 2, slot.y + slot.h * .62);
      if (left) {
        ctx.fillStyle = hit ? "#8a3b12" : "#6a5644";
        ctx.font = `700 ${Math.max(8, ticketRect.w * .02)}px ${localeFont()}`;
        ctx.fillText(g("goldAmount", { n: pair.prize }), slot.x + slot.w / 2, slot.y + slot.h * .88);
      }
    });
  }

  function foilRect() {
    const inset = ticketRect.w * .09;
    const minX = ticketRect.x + inset;
    const maxX = ticketRect.x + ticketRect.w - inset;
    if (mode?.kind && slots.length) {
      const pad = ticketRect.w * .01;
      const left = Math.max(minX, Math.min(...slots.map((slot) => slot.x)) - pad);
      const top = Math.min(...slots.map((slot) => slot.y)) - pad;
      const right = Math.min(maxX, Math.max(...slots.map((slot) => slot.x + slot.w)) + pad);
      const bottom = Math.max(...slots.map((slot) => slot.y + slot.h)) + pad;
      return { x: left, y: top, w: right - left, h: bottom - top };
    }
    return {
      x: minX,
      y: ticketRect.y + ticketRect.h * .325,
      w: maxX - minX,
      h: ticketRect.h * .51
    };
  }

  function paintSilver(ctx) {
    const foil = foilRect();
    ctx.fillStyle = "#a3aab0";
    ctx.fillRect(foil.x, foil.y, foil.w, foil.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(foil.x, foil.y, foil.w, foil.h);
    ctx.clip();
    for (let y = Math.ceil(foil.y); y < foil.y + foil.h; y += 1) {
      const band = Math.floor(y - foil.y) % 4;
      ctx.globalAlpha = band === 0 ? .085 : band === 2 ? .045 : .025;
      ctx.fillStyle = band === 0 ? "#eef0f1" : "#596168";
      ctx.fillRect(foil.x, y, foil.w, .55);
    }
    ctx.globalAlpha = .035;
    for (let x = Math.ceil(foil.x); x < foil.x + foil.w; x += 3) {
      ctx.fillStyle = Math.floor(x) % 2 ? "#ffffff" : "#444c52";
      ctx.fillRect(x, foil.y, .45, foil.h);
    }
    ctx.globalAlpha = .16;
    for (let i = 0; i < 130; i++) {
      const x = foil.x + ((i * 73) % 131) / 131 * foil.w;
      const y = foil.y + ((i * 47) % 127) / 127 * foil.h;
      ctx.fillStyle = i % 4 ? "#e7e9ea" : "#747c82";
      ctx.fillRect(x, y, i % 9 === 0 ? 1.8 : .8, .8);
    }
    ctx.globalAlpha = .25;
    ctx.fillStyle = "#5b6369";
    ctx.textAlign = "center";
    slots.forEach((slot) => {
      ctx.font = `900 ${Math.max(9, Math.min(ticketRect.w * .07, slot.w * .28))}px ${localeFont()}`;
      ctx.fillText(g("scratchCell"), slot.x + slot.w / 2, slot.y + slot.h * .6);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = "rgba(91,98,103,.58)";
    ctx.lineWidth = 1;
    ctx.strokeRect(foil.x + .5, foil.y + .5, foil.w - 1, foil.h - 1);
  }

  function eraseMark(ctx, mark) {
    const x1 = ticketRect.x + mark.x1 * ticketRect.w;
    const y1 = ticketRect.y + mark.y1 * ticketRect.h;
    const x2 = ticketRect.x + mark.x2 * ticketRect.w;
    const y2 = ticketRect.y + mark.y2 * ticketRect.h;
    const r = mark.r * ticketRect.w;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,.92)";
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const random = Math.sin(mark.seed * 9999) * .5 + .5;
    ctx.fillStyle = "rgba(0,0,0,.78)";
    for (let i = 0; i < 3; i++) {
      const t = (i + random) / 3.4;
      const x = x1 + (x2 - x1) * t + Math.sin(mark.seed * 71 + i) * r * .72;
      const y = y1 + (y2 - y1) * t + Math.cos(mark.seed * 53 + i) * r * .55;
      ctx.beginPath();
      ctx.arc(x, y, r * (.11 + random * .13), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function redrawCoating() {
    const ctx = contexts[1];
    ctx.clearRect(0, 0, width, height);
    if (!mode) return;
    paintSilver(ctx);
    marks.forEach((mark) => eraseMark(ctx, mark));
  }

  function updateGrid(mark) {
    const x1 = mark.x1;
    const y1 = mark.y1;
    const x2 = mark.x2;
    const y2 = mark.y2;
    slots.forEach((slot, slotIndex) => {
      const grid = grids[slotIndex];
      const sx = (slot.x - ticketRect.x) / ticketRect.w;
      const sy = (slot.y - ticketRect.y) / ticketRect.h;
      const sw = slot.w / ticketRect.w;
      const sh = slot.h / ticketRect.h;
      const steps = Math.max(2, Math.ceil(Math.hypot((x2 - x1) / sw, (y2 - y1) / sh) * 20));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        const gx = (px - sx) / sw * 18;
        const gy = (py - sy) / sh * 18;
        const gr = mark.r / sw * 18;
        const minX = Math.max(0, Math.floor(gx - gr));
        const maxX = Math.min(17, Math.ceil(gx + gr));
        const minY = Math.max(0, Math.floor(gy - gr));
        const maxY = Math.min(17, Math.ceil(gy + gr));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          if ((x + .5 - gx) ** 2 + (y + .5 - gy) ** 2 <= gr ** 2) grid[y * 18 + x] = 1;
        }
      }
    });
  }

  function applyScratch(mark, point) {
    if (!mark) return;
    marks.push(mark);
    eraseMark(contexts[1], mark);
    updateGrid(mark);
    if (point) {
      for (let i = 0; i < 4; i++) particles.push({
        x: point.x + (Math.random() - .5) * 12,
        y: point.y + (Math.random() - .5) * 10,
        vx: (Math.random() - .5) * 85,
        vy: -30 - Math.random() * 65,
        life: .45 + Math.random() * .35,
        spin: Math.random() * 6,
        size: 1.5 + Math.random() * 3.5
      });
      if (particles.length > 160) particles.splice(0, particles.length - 160);
    }
  }

  function coverage() {
    const slotCoverage = grids.map((grid) => grid.reduce((sum, value) => sum + value, 0) / grid.length);
    return { slotCoverage, overall: slotCoverage.reduce((sum, value) => sum + value, 0) / Math.max(1, slotCoverage.length) };
  }

  function reveal(index) { revealedAt[index] = performance.now(); }

  function clearCoating() {
    contexts[1].clearRect(0, 0, width, height);
    slots.forEach((_, index) => { if (!revealedAt[index]) revealedAt[index] = performance.now() + index * 60; });
  }

  function celebrate(big = false) {
    const centerX = ticketRect.x + ticketRect.w / 2;
    const centerY = ticketRect.y + ticketRect.h * .58;
    const count = big ? 92 : 52;
    winGlowUntil = performance.now() + (big ? 2200 : 1450);
    const colors = ["#f3c54d", "#df4f3f", "#3f79b8", "#36a36f", "#f6e8b2"];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * (.12 + Math.random() * .76);
      const speed = (big ? 145 : 105) + Math.random() * (big ? 180 : 120);
      const kind = i % 4 === 0 ? "coin" : i % 7 === 0 ? "spark" : "confetti";
      const life = 1.05 + Math.random() * (big ? 1.55 : 1.05);
      particles.push({
        kind,
        x: centerX + (Math.random() - .5) * ticketRect.w * .24,
        y: centerY + (Math.random() - .5) * ticketRect.h * .08,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        life,
        maxLife: life,
        spin: Math.random() * 6,
        size: kind === "coin" ? 4 + Math.random() * 4 : 2.5 + Math.random() * 4,
        color: colors[i % colors.length]
      });
    }
  }

  function drawEffects(now) {
    const ctx = contexts[2];
    const dt = Math.min(.04, (now - lastFrame) / 1000);
    lastFrame = now;
    ctx.clearRect(0, 0, width, height);
    if (now < winGlowUntil) {
      const remaining = Math.max(0, (winGlowUntil - now) / 1500);
      const cx = ticketRect.x + ticketRect.w / 2;
      const cy = ticketRect.y + ticketRect.h * .58;
      const radius = ticketRect.w * .55;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glow.addColorStop(0, `rgba(255,226,116,${Math.min(.46, remaining * .34)})`);
      glow.addColorStop(.42, `rgba(246,177,45,${Math.min(.22, remaining * .16)})`);
      glow.addColorStop(1, "rgba(246,177,45,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glow;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
    }
    particles = particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.vy += (p.kind ? 250 : 180) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 9;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.globalAlpha = p.maxLife ? Math.min(1, p.life / Math.min(.45, p.maxLife)) : Math.min(1, p.life * 2.2);
      if (p.kind === "coin") {
        ctx.fillStyle = "#f4c648";
        ctx.strokeStyle = "#8f5315";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, Math.max(1.3, p.size * Math.abs(Math.cos(p.spin)) * .38), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === "confetti") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * .35, p.size * 2, p.size * .7);
      } else if (p.kind === "spark") {
        ctx.strokeStyle = "#fff2a6";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0);
        ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.life > .35 ? "#e7eaeb" : "#90989c";
        ctx.fillRect(-p.size, -p.size * .25, p.size * 2.2, p.size * .5);
      }
      ctx.restore();
      return true;
    });
  }

  function frame(now) {
    drawBase(now);
    drawEffects(now);
    animationId = requestAnimationFrame(frame);
  }

  function drawCharmScatter(canvas, icons) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(canvas.clientWidth || 0, rect.width || 0);
    const h = Math.max(canvas.clientHeight || 0, rect.height || 0);
    if (w < 8 || h < 8 || !icons?.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const rand = mulberry32(hashSeed(icons.map((icon) => icon.id).join("|")));
    const stamps = icons.slice(0, 9);
    const laid = stamps.map((icon) => {
      const size = Math.min(w, h) * (0.58 + rand() * 0.5);
      return {
        icon,
        size,
        x: w * (0.18 + rand() * 0.78),
        y: h * (0.08 + rand() * 0.84),
        rot: (rand() - 0.5) * 1.25,
        alpha: 0.88 + rand() * 0.12
      };
    }).sort((a, b) => b.size - a.size);
    for (const stamp of laid) {
      const frameData = frameMaps[stamp.icon.group]?.get(stamp.icon.id);
      const image = charmImages[stamp.icon.group];
      if (!frameData || !image) continue;
      ctx.save();
      ctx.translate(stamp.x, stamp.y);
      ctx.rotate(stamp.rot);
      ctx.globalAlpha = stamp.alpha;
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      drawContained(ctx, image, frameData, {
        x: -stamp.size / 2,
        y: -stamp.size / 2,
        w: stamp.size,
        h: stamp.size
      }, 1.08);
      ctx.restore();
    }
  }

  function drawIconPreview(canvas, icon, discovered) {
    const css = Math.max(canvas.clientWidth || 0, canvas.clientHeight || 0, canvas.getBoundingClientRect().width || 0, 24);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(css * dpr));
    canvas.height = Math.max(1, Math.round(css * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);
    if (!discovered) {
      ctx.fillStyle = "rgba(80,69,55,.18)";
      ctx.beginPath();
      ctx.arc(css / 2, css / 2, css * .28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(63,48,39,.55)";
      ctx.font = `900 ${Math.max(12, css * .28)}px ${localeFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", css / 2, css / 2);
      return;
    }
    const frameData = frameMaps[icon.group]?.get(icon.id);
    if (!frameData) return;
    const pad = Math.max(2, css * .06);
    drawContained(ctx, charmImages[icon.group], frameData, {
      x: pad, y: pad, w: css - pad * 2, h: css - pad * 2
    });
  }

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  animationId = requestAnimationFrame(frame);

  return {
    setTicket, applyScratch, coverage, reveal, clearCoating, celebrate, drawIconPreview, drawCharmScatter,
    getTicketRect: () => ticketRect,
    getSlots: () => slots,
    destroy() { observer.disconnect(); cancelAnimationFrame(animationId); }
  };
}
