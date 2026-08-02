import {
  STOREFRONTS,
  STOREFRONT_MAP,
  QUICK_COUNTRY_CODES,
} from './countries.mjs'
import {
  getGame,
  loadGames,
  loadPrices,
  saveMeta,
  savePrices,
  upsertGame,
  loadMeta,
} from './db.mjs'
import { ensureFx, toCny } from './fx.mjs'
import {
  discoverNsuids,
  fetchPricesForCountry,
  nsuidForRegion,
  searchAllRegions,
} from './nintendo.mjs'
import { HOT_TOP10, SEED_GAMES } from './seeds.mjs'

const refreshLocks = new Set()
const refreshProgress = new Map()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function isRefreshing() {
  return refreshLocks.size > 0
}

export function isRefreshingGame(gameId) {
  return refreshLocks.has(String(gameId))
}

export function refreshState(gameId) {
  return refreshProgress.get(String(gameId)) || null
}

export function ensureSeedMeta(seed) {
  const existing = getGame(seed.gameId)
  const game = upsertGame({
    gameId: seed.gameId,
    name: seed.name,
    nameZh: seed.nameZh || '',
    publisher: seed.publisher || 'Nintendo',
    // Seed icons are curated (JP CDN); always refresh so stale EU 404s get replaced.
    icon: seed.icon || existing?.icon || '',
    summary: existing?.summary || '',
    nsuids: { ...(existing?.nsuids || {}), ...(seed.nsuids || {}) },
    platforms: ['Nintendo Switch'],
    category: '游戏',
    updatedAt: new Date().toISOString(),
  })
  return game
}

export async function ensureGameFromSearch(hit) {
  const nsuids = { ...(hit.nsuids || {}) }
  let gameId = String(
    nsuids.na || nsuids.eu || nsuids.jp || hit.gameId,
  )

  const matched = loadGames().items.find((g) => {
    const ids = [
      g.gameId,
      g.nsuids?.na,
      g.nsuids?.eu,
      g.nsuids?.jp,
      g.nsuids?.hk,
      g.nsuids?.kr,
    ]
      .filter(Boolean)
      .map(String)
    return ids.some(
      (id) =>
        id === gameId ||
        id === String(nsuids.na || '') ||
        id === String(nsuids.eu || '') ||
        id === String(nsuids.jp || ''),
    )
  })
  if (matched) gameId = String(matched.gameId)

  const preferIcon = (...urls) => {
    const list = urls.filter(Boolean)
    return (
      list.find((u) => String(u).includes('img-eshop.cdn.nintendo.net')) ||
      list.find((u) => String(u).includes('image_url_sq') || String(u).includes('/SQ_')) ||
      list[0] ||
      ''
    )
  }
  const icon = preferIcon(hit.icon, matched?.icon)

  // Keep curated Chinese title for known seeds
  const nameZh =
    matched?.nameZh ||
    (hit.source === 'jp' || /[\u3040-\u30ff\u4e00-\u9fff]/.test(hit.name)
      ? hit.name
      : '')

  return upsertGame({
    gameId,
    name: matched?.name || hit.nameEn || hit.name,
    nameZh,
    publisher: hit.publisher || matched?.publisher || '',
    icon,
    summary: hit.summary || matched?.summary || '',
    nsuids: { ...(matched?.nsuids || {}), ...nsuids },
    productKeys: [
      ...new Set([
        ...(matched?.productKeys || []),
        ...(hit.productKeys || []),
      ]),
    ],
    platforms: ['Nintendo Switch'],
    category: '游戏',
    updatedAt: new Date().toISOString(),
  })
}

async function scrapePrices(game, storefronts) {
  const fx = await ensureFx()
  let nsuids = { ...(game.nsuids || {}) }
  nsuids = await discoverNsuids(nsuids)

  // If we discovered NA and current gameId is EU-only, keep gameId stable.
  const rows = []
  for (const sf of storefronts) {
    const nsuid = nsuidForRegion(nsuids, sf.region)
    if (!nsuid) continue
    try {
      const map = await fetchPricesForCountry(sf.code.toUpperCase(), [nsuid])
      const hit = map.get(String(nsuid))
      if (!hit) continue
      const cny = toCny(hit.amount, hit.currency, fx)
      if (cny == null) continue
      rows.push({
        country: sf.code,
        region: sf.region,
        nsuid: String(nsuid),
        amount: hit.amount,
        currency: hit.currency,
        priceFormatted: hit.formatted,
        cny,
        onSale: hit.onSale,
      })
    } catch (e) {
      console.warn('price', game.gameId, sf.code, e.message)
    }
    await sleep(Number(process.env.SWITCH_DELAY_MS || 180))
  }

  rows.sort((a, b) => a.cny - b.cny)

  // Prefer NA as canonical gameId when available
  let gameId = String(game.gameId)
  if (nsuids.na && !getGame(nsuids.na) && gameId === nsuids.eu) {
    gameId = String(nsuids.na)
  }

  upsertGame({
    ...game,
    gameId,
    nsuids,
    updatedAt: new Date().toISOString(),
  })

  const doc = {
    gameId,
    updatedAt: new Date().toISOString(),
    nsuids,
    rows,
  }
  savePrices(gameId, doc)
  // Also save under original id if remapped
  if (String(game.gameId) !== gameId) {
    savePrices(game.gameId, doc)
  }
  return doc
}

export async function refreshGamePrices(gameId, { force = false, storefronts = STOREFRONTS } = {}) {
  const id = String(gameId)
  if (refreshLocks.has(id)) {
    return loadPrices(id)
  }
  const existing = loadPrices(id)
  if (
    !force &&
    existing.updatedAt &&
    Date.now() - new Date(existing.updatedAt).getTime() < 2 * 60 * 60 * 1000 &&
    existing.rows?.length
  ) {
    return existing
  }

  refreshLocks.add(id)
  refreshProgress.set(id, { startedAt: new Date().toISOString(), phase: 'fetch' })
  saveMeta({ ...loadMeta(), refreshing: id })
  try {
    let game = getGame(id)
    if (!game) {
      const seed = SEED_GAMES.find((s) => s.gameId === id)
      if (seed) game = ensureSeedMeta(seed)
    }
    if (!game) throw new Error('game_not_found')
    const doc = await scrapePrices(game, storefronts)
    saveMeta({
      ...loadMeta(),
      lastRefreshAt: new Date().toISOString(),
      refreshing: null,
    })
    return doc
  } finally {
    refreshLocks.delete(id)
    refreshProgress.delete(id)
    const meta = loadMeta()
    if (meta.refreshing === id) {
      saveMeta({ ...meta, refreshing: null })
    }
  }
}

export function quickStorefronts() {
  return STOREFRONTS.filter((s) => QUICK_COUNTRY_CODES.includes(s.code))
}

export function rankedRows(priceDoc) {
  const rows = (priceDoc.rows || [])
    .filter((r) => typeof r.cny === 'number')
    .slice()
    .sort((a, b) => a.cny - b.cny)
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    isLowest: i === 0,
    totalRegions: rows.length,
    regionName: STOREFRONT_MAP[r.country]?.name || r.country.toUpperCase(),
    flag: STOREFRONT_MAP[r.country]?.flag || '',
  }))
}

export function priceForCountry(priceDoc, country) {
  const code = String(country || '').toLowerCase()
  if (!code) return null
  const all = rankedRows(priceDoc)
  return all.find((r) => r.country === code) || null
}

export function homeHighlights(limit = 10) {
  return HOT_TOP10.slice(0, limit).map((seed) => {
    const game = getGame(seed.gameId) || ensureSeedMeta(seed)
    const prices = loadPrices(game.gameId)
    const ranked = rankedRows(prices)
    const best = ranked[0] || null
    const us = ranked.find((r) => r.country === 'us') || null
    let savePct = null
    if (best && us && us.cny > 0) {
      savePct = Math.max(0, Math.round((1 - best.cny / us.cny) * 100))
    }
    return {
      gameId: game.gameId,
      name: game.nameZh || game.name,
      nameEn: game.name,
      icon: game.icon,
      best,
      us,
      savePct,
      pending: !best,
      regions: ranked.length,
    }
  })
}

let hotFillRunning = false
export async function ensureHotPricesQuick() {
  if (hotFillRunning) return
  hotFillRunning = true
  try {
    for (const seed of HOT_TOP10) {
      ensureSeedMeta(seed)
      const prices = loadPrices(seed.gameId)
      if (prices.rows?.length) continue
      if (isRefreshing()) break
      try {
        await refreshGamePrices(seed.gameId, {
          force: true,
          storefronts: quickStorefronts(),
        })
      } catch (e) {
        console.warn('hot fill', seed.gameId, e.message)
      }
    }
  } finally {
    hotFillRunning = false
  }
}

export async function refreshSeeds({ force = false, limit } = {}) {
  const list = SEED_GAMES.slice(0, limit || SEED_GAMES.length)
  for (const seed of list) {
    ensureSeedMeta(seed)
    try {
      await refreshGamePrices(seed.gameId, {
        force,
        storefronts: STOREFRONTS,
      })
    } catch (e) {
      console.warn('seed refresh', seed.gameId, e.message)
    }
  }
}

export async function searchGames(q) {
  const remote = await searchAllRegions(q, { rows: 24, discoverTop: 12 })
  const mapped = []
  for (const hit of remote) {
    mapped.push(await ensureGameFromSearch(hit))
  }
  return mapped
}
