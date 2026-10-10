import { SAVE_KEY, starterState, uid, fishById, TANKS, LIGHTS, sceneForTank, makeStarterFry, RARITIES } from './data.js'
import { boxedRecord, ensureFishIdentity, GROW_LARGE_MS, seedFromId } from './look.js'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function cleanFish(raw, index) {
  if (!fishById(raw?.species)) return null
  const species = raw.species
  const fish = {
    id: typeof raw?.id === 'string' ? raw.id : uid('f'),
    species,
    x: clamp(Number(raw?.x) || 0.2 + (index % 4) * 0.18, 0.06, 0.94),
    y: clamp(Number(raw?.y) || 0.5, 0.12, 0.88),
    vx: Number.isFinite(Number(raw?.vx)) ? Number(raw.vx) : 0.05,
    vy: Number.isFinite(Number(raw?.vy)) ? Number(raw.vy) : 0,
    nextBubble: Number(raw?.nextBubble) || Date.now() + 20000 + index * 4000,
    happyUntil: Number(raw?.happyUntil) || 0,
    entering: false,
    bornAt: Number(raw?.bornAt) || 0,
    growBonusMs: Math.max(0, Number(raw?.growBonusMs) || 0),
    grownMs: Number.isFinite(Number(raw?.grownMs)) ? Math.max(0, Number(raw.grownMs)) : undefined,
    lookSeed: Number.isFinite(Number(raw?.lookSeed)) ? Number(raw.lookSeed) >>> 0 : 0,
    mystery: Boolean(raw?.mystery),
    quality: raw?.quality || 'common',
    satedUntil: Number(raw?.satedUntil) || 0,
  }
  return ensureFishIdentity(fish, index)
}

function cleanBoxed(raw) {
  if (typeof raw === 'string') {
    if (!fishById(raw)) return null
    return {
      species: raw,
      lookSeed: seedFromId(raw),
      bornAt: Date.now() - GROW_LARGE_MS,
      growBonusMs: 0,
      grownMs: GROW_LARGE_MS,
      mystery: false,
      quality: 'common',
    }
  }
  if (raw && fishById(raw.species)) return boxedRecord(ensureFishIdentity({
    species: raw.species,
    lookSeed: raw.lookSeed,
    bornAt: raw.bornAt,
    growBonusMs: raw.growBonusMs,
    grownMs: raw.grownMs,
    mystery: raw.mystery,
    quality: raw.quality,
    id: raw.species,
  }))
  return null
}

function cleanStock(raw) {
  const quality = RARITIES.includes(raw?.quality) ? raw.quality : 'common'
  if (raw?.sealed || !fishById(raw?.species)) {
    if (!raw || (!raw.sealed && !RARITIES.includes(raw.quality))) return null
    return {
      sealed: true,
      quality,
      mystery: true,
      lookSeed: Number.isFinite(Number(raw.lookSeed)) ? Number(raw.lookSeed) >>> 0 : undefined,
      bornAt: Number(raw.bornAt) || Date.now(),
      growBonusMs: 0,
      grownMs: 0,
    }
  }
  return cleanBoxed(raw)
}

export function sanitize(raw) {
  const base = starterState()
  if (!raw || typeof raw !== 'object') return base
  const wanted = Number(raw.tank) || 0
  const tank = TANKS.some((t) => t.id === wanted) ? wanted : 0
  const cap = TANKS.find((t) => t.id === tank) || TANKS[0]
  const fish = asArray(raw.fish).map(cleanFish).filter(Boolean).slice(0, cap.fish)
  const ownedTanks = [...new Set([0, ...asArray(raw.ownedTanks).map(Number), tank])]
    .filter((id) => TANKS.some((t) => t.id === id))
    .sort((a, b) => a - b)
  const placed = sceneForTank(tank)
  const boxed = asArray(raw.boxed).map(cleanBoxed).filter(Boolean)
  const pack = asArray(raw.pack).map(cleanStock).filter(Boolean)
  const albumFish = [...new Set(asArray(raw.albumFish).filter((id) => fishById(id)))]
  const albumTanks = [...new Set([...ownedTanks, ...asArray(raw.albumTanks).map(Number)])]
    .filter((id) => TANKS.some((t) => t.id === id))
  const ownedLights = [...new Set(asArray(raw.ownedLights).filter((id) => LIGHTS.some((l) => l.id === id)))]
  const light = ownedLights.includes(raw.light) ? raw.light : (ownedLights[0] || '')
  if (!fish.length) fish.push(cleanFish(makeStarterFry(), 0))
  return {
    v: 1,
    coins: Math.max(0, Number(raw.coins) || 0),
    xp: Math.max(0, Number(raw.xp) || 0),
    tank,
    ownedTanks,
    fish,
    boxed,
    placed,
    pack,
    albumFish,
    albumTanks,
    ownedLights,
    light,
    chest: raw.chest && Number.isFinite(Number(raw.chest.x))
      ? {
        id: typeof raw.chest.id === 'string' ? raw.chest.id : 'c-1',
        x: clamp(Number(raw.chest.x), 0.08, 0.92),
        y: clamp(Number(raw.chest.y) || 0.86, 0.74, 0.93),
        tier: raw.chest.tier === 'rare' ? 'rare' : 'common',
        from: fishById(raw.chest.from) ? raw.chest.from : '',
        born: Number(raw.chest.born) || Date.now(),
      }
      : null,
    chestReadyAt: Number(raw.chestReadyAt) || 0,
    feedUntil: Number(raw.feedUntil) || 0,
    feedReadyAt: Number(raw.feedReadyAt) || 0,
    lastTick: Number(raw.lastTick) || Date.now(),
    lastSave: Number(raw.lastSave) || Date.now(),
    guide: raw.guide !== false && fish.length === 1 && tank === 0,
    starTide: Boolean(raw.starTide),
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return starterState()
    return sanitize(JSON.parse(raw))
  } catch {
    return starterState()
  }
}

function snapFish(fish) {
  return {
    id: fish.id,
    species: fish.species,
    x: fish.x,
    y: fish.y,
    vx: fish.vx,
    vy: fish.vy,
    nextBubble: fish.nextBubble,
    happyUntil: fish.happyUntil,
    bornAt: fish.bornAt,
    growBonusMs: fish.growBonusMs,
    grownMs: fish.grownMs,
    lookSeed: fish.lookSeed,
    mystery: Boolean(fish.mystery),
    quality: fish.quality || 'common',
    satedUntil: fish.satedUntil || 0,
  }
}

export function snapshotState(state) {
  const snap = sanitize(state)
  return {
    v: 1,
    coins: snap.coins,
    xp: snap.xp,
    tank: snap.tank,
    ownedTanks: snap.ownedTanks,
    fish: snap.fish.map(snapFish),
    boxed: snap.boxed,
    pack: snap.pack,
    albumFish: snap.albumFish,
    albumTanks: snap.albumTanks,
    ownedLights: snap.ownedLights,
    light: snap.light,
    chest: snap.chest,
    chestReadyAt: snap.chestReadyAt,
    feedUntil: snap.feedUntil,
    feedReadyAt: snap.feedReadyAt,
    lastTick: snap.lastTick,
    lastSave: snap.lastSave,
    guide: snap.guide,
    starTide: snap.starTide,
  }
}

let cloudWriter = null
let skipCloud = false

export function setCloudWriter(fn) {
  cloudWriter = typeof fn === 'function' ? fn : null
}

export function setSkipCloud(on) {
  skipCloud = Boolean(on)
}

let skipSave = false

export function setSkipSave(on) {
  skipSave = Boolean(on)
}

export function persistState(state) {
  if (skipSave) return
  try {
    const snap = snapshotState(state)
    snap.lastSave = Date.now()
    snap.lastTick = Date.now()
    state.lastSave = snap.lastSave
    state.lastTick = snap.lastTick
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap))
    if (!skipCloud) void Promise.resolve(cloudWriter?.(snap)).catch(() => {})
  } catch {
    /* quota / private mode */
  }
}

export function resetState() {
  try { localStorage.removeItem('jiumao-idle-tank-tour') } catch { /* ignore */ }
  const next = starterState()
  persistState(next)
  return next
}

export function muteKey() {
  return 'jiumao-idle-tank-mute'
}
