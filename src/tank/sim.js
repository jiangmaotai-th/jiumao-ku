import {
  FISH,
  TANKS,
  OFFLINE_CAP_MS,
  FEED_DURATION,
  FEED_COOLDOWN,
  FEED_MULT,
  BUBBLE_LIFE,
  TAP_YIELD_SEC,
  SATED_MS,
  CHEST_GAP_MS,
  CHEST_CHANCE,
  RATE_MULT,
  aquariumLevel,
  fishById,
  isCrustacean,
  lightById,
  packById,
  rollPackSpecies,
  rollChestFryPack,
  rollChestCoins,
  uid,
  XP_FISH,
  XP_TANK,
  XP_CHEST,
  XP_CHEST_RARE,
  tankById,
  sceneForTank,
} from './data.js'
import { boxedRecord, ensureFishIdentity, growthOf, newLookSeed, GROW_LARGE_MS } from './look.js'

export function clampSand(x, y) {
  return {
    x: Math.max(0.07, Math.min(0.93, Number(x) || 0.5)),
    y: Math.max(0.76, Math.min(0.91, Number(y) || 0.85)),
  }
}

export function uniqueTags(state) {
  return new Set(tankById(state.tank).tags || [])
}

export function speciesCount(state, species) {
  return state.fish.filter((f) => f.species === species).length
}

export function preferMet(fish, tags = uniqueTags(fish._state || {})) {
  const spec = fishById(fish.species)
  return Boolean(spec && tags.has(spec.prefer))
}

export function traitMult(fish, state, tags) {
  const spec = fishById(fish.species)
  if (!spec) return 1
  const same = speciesCount(state, fish.species)
  if (spec.trait === 'school') return same >= 3 ? 1.08 : 1
  if (spec.trait === 'solo') return same <= 1 ? 1.12 : 1
  if (spec.trait === 'explore') return 1 + 0.04 * tags.size
  return 1
}

export function fishYield(fish, state, { feed = true, now = Date.now() } = {}) {
  const spec = fishById(fish.species)
  if (!spec || fish.entering) return 0
  const tags = uniqueTags(state)
  let m = 1
  if (feed && now < state.feedUntil) m *= FEED_MULT
  if (tags.has(spec.prefer)) m *= 1.12
  m *= traitMult(fish, state, tags)
  m *= growthOf(fish, now).yieldMul
  return spec.rate * RATE_MULT * m
}

export function tankRate(state, opts) {
  return state.fish.reduce((sum, fish) => sum + fishYield(fish, state, opts), 0)
}

export function applySeconds(state, seconds, opts) {
  if (seconds <= 0) return 0
  const gained = tankRate(state, opts) * seconds
  state.coins += gained
  return gained
}

export function tickGrowth(state, from, now = Date.now()) {
  const start = Number(from) || now
  if (now <= start) return
  for (const fish of state.fish) {
    ensureFishIdentity(fish)
    if ((fish.grownMs || 0) >= GROW_LARGE_MS) continue
    const satedUntil = Number(fish.satedUntil) || 0
    const add = Math.max(0, Math.min(now, satedUntil) - start)
    if (add > 0) fish.grownMs = Math.min(GROW_LARGE_MS, (fish.grownMs || 0) + add)
  }
}

export function maybeStarTide(state) {
  if (state.starTide) return
  const kinds = new Set(state.albumFish).size
  if (aquariumLevel(state.xp) >= 10 && kinds >= 10) state.starTide = true
}

export function discoverFish(state, species) {
  if (state.albumFish.includes(species)) return false
  state.albumFish.push(species)
  state.xp += XP_FISH
  maybeStarTide(state)
  return true
}

export function discoverTank(state, tankId) {
  if (state.albumTanks.includes(tankId)) return false
  state.albumTanks.push(tankId)
  state.xp += XP_TANK
  maybeStarTide(state)
  return true
}

export function settleOffline(state, now = Date.now()) {
  const elapsed = Math.max(0, now - (state.lastTick || now))
  const capped = Math.min(OFFLINE_CAP_MS, elapsed)
  if (capped < 45_000) {
    tickGrowth(state, state.lastTick || now, now)
    state.lastTick = now
    return null
  }
  const seconds = capped / 1000
  tickGrowth(state, state.lastTick || now - capped, now)
  const contributors = state.fish
    .map((fish) => ({
      species: fish.species,
      name: fishById(fish.species)?.name || fish.species,
      amount: fishYield(fish, state, { feed: false, now }) * seconds,
    }))
    .sort((a, b) => b.amount - a.amount)
  const gained = applySeconds(state, seconds, { feed: false, now })
  state.lastTick = now
  if (gained < 0.05) return null
  return {
    ms: capped,
    gained,
    top: contributors[0] || null,
  }
}

export function canFeed(state, now = Date.now()) {
  return now >= (state.feedReadyAt || 0)
}

export function doFeed(state, now = Date.now()) {
  if (!canFeed(state, now)) return false
  state.feedUntil = now + FEED_DURATION * 1000
  state.feedReadyAt = now + FEED_COOLDOWN * 1000
  state.guide = false
  for (const fish of state.fish) {
    fish.nextBubble = Math.min(fish.nextBubble || now + 20000, now + 12000 + Math.random() * 8000)
    fish.satedUntil = now + SATED_MS
  }
  return true
}

export function feedRemain(state, now = Date.now()) {
  return Math.max(0, Math.ceil((state.feedUntil - now) / 1000))
}

export function cooldownRemain(state, now = Date.now()) {
  return Math.max(0, Math.ceil((state.feedReadyAt - now) / 1000))
}

export function tankCap(state) {
  return tankById(state.tank)
}

export function fishUnlocked(state, spec) {
  return aquariumLevel(state.xp) >= spec.unlock
}

export function shortGoal(state) {
  if (state.guide) return { id: 'feed', need: 1, have: 0 }
  if (state.fish.length < 2 && !(state.pack || []).length) return { id: 'buyFish', need: 2, have: state.fish.length }
  const owned = state.ownedTanks || [0]
  if (TANKS.length > 1 && owned.length < 2) return { id: 'tank', need: 1, have: 0 }
  const kinds = new Set(state.albumFish).size
  if (kinds < 3) return { id: 'kinds3', need: 3, have: kinds }
  if (TANKS.some((t) => t.id === 3) && !owned.includes(3)) return { id: 'mid', need: 1, have: 0 }
  if (kinds < 6) return { id: 'kinds6', need: 6, have: kinds }
  if (TANKS.some((t) => t.id === 2) && !owned.includes(2)) return { id: 'large', need: 1, have: 0 }
  if (kinds < 10) return { id: 'album', need: 10, have: kinds }
  if (aquariumLevel(state.xp) < 10) return { id: 'lv10', need: 10, have: aquariumLevel(state.xp) }
  return { id: 'done', need: 1, have: 1 }
}

export function rollSpecies(packId) {
  return rollPackSpecies(packId)
}

function spawnY(spec) {
  if (isCrustacean(spec)) return 0.84
  return spec?.layer === 'upper' ? 0.28 : spec?.layer === 'bottom' ? 0.78 : 0.52
}

function spawnFry(state, species, quality, { entering = true, x = 0.5 } = {}) {
  const spec = fishById(species)
  const y = spawnY(spec)
  return ensureFishIdentity({
    id: uid('f'),
    species,
    quality: quality || 'common',
    mystery: true,
    x,
    y,
    vx: spec?.face > 0 ? 0.05 : -0.05,
    vy: 0,
    nextBubble: Date.now() + 20000,
    happyUntil: 0,
    entering,
    bornAt: Date.now(),
    growBonusMs: 0,
    grownMs: 0,
    lookSeed: newLookSeed(),
    satedUntil: 0,
  })
}

export function stockPack(state, quality) {
  if (!state.pack) state.pack = []
  const rec = {
    sealed: true,
    quality: quality || 'common',
    mystery: true,
    lookSeed: newLookSeed(),
    bornAt: Date.now(),
    growBonusMs: 0,
    grownMs: 0,
  }
  state.pack.push(rec)
  return { ok: true, stock: true, quality: rec.quality, rec }
}

export function stockFry(state, species, quality) {
  const spec = fishById(species)
  if (!spec) return { ok: false, reason: 'missing' }
  if (!state.pack) state.pack = []
  const rec = {
    species,
    quality: quality || 'common',
    lookSeed: newLookSeed(),
    mystery: true,
    bornAt: Date.now(),
    growBonusMs: 0,
    grownMs: 0,
  }
  state.pack.push(rec)
  return { ok: true, stock: true, species, quality, rec }
}

export function grantFry(state, species, quality) {
  return stockFry(state, species, quality)
}

export function buyFryPack(state, packId) {
  const pack = packById(packId)
  if (!pack || pack.shop === false) return { ok: false, reason: 'missing' }
  if (aquariumLevel(state.xp) < pack.unlock) return { ok: false, reason: 'lock', need: pack.unlock }
  if (state.coins < pack.price) return { ok: false, reason: 'coins', need: pack.price - state.coins }
  state.coins -= pack.price
  return { ...stockPack(state, pack.id), pack: pack.id }
}

export function placeStock(state, index) {
  if (!state.pack) state.pack = []
  if (state.fish.length >= tankCap(state).fish) return { ok: false, reason: 'full' }
  const rec = state.pack[index]
  if (!rec) return { ok: false, reason: 'missing' }
  const quality = rec.quality || 'common'
  let species = rec.species
  if (rec.sealed || !fishById(species)) {
    species = rollSpecies(quality)
  }
  if (!species || !fishById(species)) return { ok: false, reason: 'missing' }
  state.pack.splice(index, 1)
  const fish = spawnFry(state, species, quality, { entering: true })
  fish.lookSeed = Number.isFinite(Number(rec.lookSeed)) ? Number(rec.lookSeed) >>> 0 : fish.lookSeed
  fish.bornAt = Number(rec.bornAt) || fish.bornAt
  fish.grownMs = 0
  fish.growBonusMs = 0
  fish.mystery = true
  state.fish.push(fish)
  return { ok: true, fish }
}

export function tickHatch(state, now = Date.now()) {
  const events = []
  for (const fish of state.fish) {
    if (!fish.mystery) continue
    if (!growthOf(fish, now).patterned) continue
    fish.mystery = false
    events.push({ fish, species: fish.species, first: discoverFish(state, fish.species), boxed: false })
  }
  for (const rec of state.boxed) {
    if (!rec?.mystery) continue
    if (!growthOf(rec, now).patterned) continue
    rec.mystery = false
    events.push({ species: rec.species, first: discoverFish(state, rec.species), boxed: true })
  }
  return events
}

export function isSated(fish, now = Date.now()) {
  return now < (Number(fish?.satedUntil) || 0)
}

export function tickChests(state, now = Date.now(), dt = 1) {
  if (state.chest) return null
  if (now < (state.chestReadyAt || 0)) return null
  const sated = state.fish.filter((f) => !f.entering && isSated(f, now))
  if (!sated.length) return null
  const p = CHEST_CHANCE * sated.length * Math.max(0.2, dt)
  if (Math.random() > p) return null
  const fish = sated[Math.floor(Math.random() * sated.length)]
  const rare = Math.random() < 0.18
  state.chest = {
    id: uid('c'),
    x: 0.10 + Math.random() * 0.80,
    y: 0.76 + Math.random() * 0.15,
    tier: rare ? 'rare' : 'common',
    from: fish.species,
    born: now,
  }
  return state.chest
}

export function openChest(state) {
  if (!state.chest) return { ok: false }
  const rare = state.chest.tier === 'rare'
  state.chest = null
  state.chestReadyAt = Date.now() + CHEST_GAP_MS
  const lv = aquariumLevel(state.xp)
  const jackpot = Math.random() < (rare ? 0.18 : 0.08)
  let coins = rollChestCoins(rare, lv)
  if (jackpot) coins = Math.round(coins * (rare ? 2.2 : 1.8))
  state.coins += coins
  state.xp = (Number(state.xp) || 0) + (rare ? XP_CHEST_RARE : XP_CHEST) + (jackpot ? 4 : 0)
  const packId = rollChestFryPack(rare ? 'rare' : 'common')
  const packId2 = Math.random() < (rare ? 0.22 : 0.08)
    ? rollChestFryPack(rare ? 'rare' : 'common')
    : null
  let fry = null
  if (packId) fry = stockPack(state, packId)
  if (packId2) stockPack(state, packId2)
  return { ok: true, coins, fry, rare, packId, packId2, jackpot }
}

export function buyFish(state, species) {
  return grantFry(state, species, 'common')
}

export function boxFish(state, fishId) {
  if (state.fish.length <= 1) return false
  const idx = state.fish.findIndex((f) => f.id === fishId)
  if (idx < 0) return false
  const [fish] = state.fish.splice(idx, 1)
  state.boxed.push(boxedRecord(fish))
  return true
}

export function releaseBoxed(state, index) {
  if (state.fish.length >= tankCap(state).fish) return { ok: false, reason: 'full' }
  const rec = state.boxed[index]
  const species = typeof rec === 'string' ? rec : rec?.species
  if (!species) return { ok: false, reason: 'missing' }
  const spec = fishById(species)
  state.boxed.splice(index, 1)
  const fish = ensureFishIdentity({
    id: uid('f'),
    species,
    x: 0.46 + Math.random() * 0.08,
    y: spawnY(spec),
    vx: 0.04,
    vy: 0,
    nextBubble: Date.now() + 20000,
    happyUntil: 0,
    entering: true,
    bornAt: typeof rec === 'object' ? rec.bornAt : Date.now() - 7 * 24 * 60 * 60 * 1000,
    growBonusMs: typeof rec === 'object' ? rec.growBonusMs : 0,
    grownMs: typeof rec === 'object' ? rec.grownMs : GROW_LARGE_MS,
    lookSeed: typeof rec === 'object' ? rec.lookSeed : newLookSeed(),
    mystery: typeof rec === 'object' ? Boolean(rec.mystery) : false,
    quality: typeof rec === 'object' ? rec.quality || 'common' : 'common',
  })
  state.fish.push(fish)
  return { ok: true, fish, first: false }
}

export function applyTankScene(state, tankId = state.tank) {
  const spec = tankById(tankId)
  state.tank = spec.id
  state.placed = sceneForTank(spec.id)
  for (const fish of state.fish) {
    fish.hideUntil = 0
    fish.seekDen = null
    fish.emerge = null
  }
  while (state.fish.length > spec.fish) {
    const extra = state.fish.pop()
    if (extra?.species) state.boxed.push(boxedRecord(extra))
  }
}

export function buyTank(state, tankId) {
  const spec = TANKS.find((t) => t.id === tankId)
  if (!spec) return { ok: false, reason: 'missing' }
  if (aquariumLevel(state.xp) < spec.unlock) return { ok: false, reason: 'lock', need: spec.unlock }
  if (!state.ownedTanks) state.ownedTanks = [0]
  if (state.ownedTanks.includes(spec.id)) {
    applyTankScene(state, spec.id)
    refreshHappy(state)
    return { ok: true, tank: spec, switched: true, first: false }
  }
  if (state.coins < spec.price) return { ok: false, reason: 'coins', need: spec.price - state.coins }
  state.coins -= spec.price
  state.ownedTanks.push(spec.id)
  const first = discoverTank(state, spec.id)
  applyTankScene(state, spec.id)
  refreshHappy(state)
  return { ok: true, tank: spec, switched: true, first }
}

export function buyLight(state, lightId) {
  const spec = lightById(lightId)
  if (!spec) return { ok: false, reason: 'missing' }
  if (aquariumLevel(state.xp) < spec.unlock) return { ok: false, reason: 'lock', need: spec.unlock }
  if (!state.ownedLights) state.ownedLights = []
  if (state.ownedLights.includes(spec.id)) {
    state.light = spec.id
    return { ok: true, light: spec, switched: true, first: false }
  }
  if (state.coins < spec.price) return { ok: false, reason: 'coins', need: spec.price - state.coins }
  state.coins -= spec.price
  state.ownedLights.push(spec.id)
  state.light = spec.id
  return { ok: true, light: spec, switched: true, first: true }
}

export function collectBubble(state, fish, now = Date.now()) {
  if (!fish?.bubble) return 0
  const value = fish.bubble.value
  state.coins += value
  fish.bubble = null
  fish.nextBubble = now + 22000 + Math.random() * 18000
  return value
}

function tapValue(fish, state, now) {
  const yieldNow = fishYield(fish, state, { now })
  return Math.max(0.1, Math.round(yieldNow * TAP_YIELD_SEC * 10) / 10)
}

export function spawnBubble(fish, state, now = Date.now()) {
  if (fish.entering || fish.bubble) return
  if (now < (fish.nextBubble || 0)) return
  const value = tapValue(fish, state, now)
  fish.bubble = {
    born: now,
    until: now + BUBBLE_LIFE * 1000,
    value,
  }
  fish.nextBubble = now + 22000 + Math.random() * 18000
}

export function pruneBubbles(state, now = Date.now()) {
  for (const fish of state.fish) {
    if (fish.bubble && now >= fish.bubble.until) {
      fish.bubble = null
      fish.nextBubble = now + 12000 + Math.random() * 16000
    }
  }
}

export function refreshHappy(state, now = Date.now()) {
  const tags = uniqueTags(state)
  for (const fish of state.fish) {
    const spec = fishById(fish.species)
    if (spec && tags.has(spec.prefer)) {
      if (!fish.happyUntil) fish.happyUntil = now + 2500
    } else {
      fish.happyUntil = 0
    }
  }
}

export { FISH }
