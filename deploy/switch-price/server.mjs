#!/usr/bin/env node
/**
 * Nintendo Switch eShop price API for maotaiworks.com/switch/
 * Listens on 127.0.0.1:3193
 */
import http from 'node:http'
import { STOREFRONTS, STOREFRONT_MAP } from './countries.mjs'
import { HOT_TOP10, SEED_GAMES } from './seeds.mjs'
import {
  DATA_DIR,
  ensureDir,
  getGame,
  loadFx,
  loadGames,
  loadMeta,
  loadPrices,
} from './db.mjs'
import { ensureFx } from './fx.mjs'
import {
  ensureHotPricesQuick,
  ensureSeedMeta,
  homeHighlights,
  isRefreshing,
  isRefreshingGame,
  priceForCountry,
  quickStorefronts,
  rankedRows,
  refreshGamePrices,
  refreshSeeds,
  refreshState,
  searchGames,
  backfillMissingIcons,
} from './refresh.mjs'

const PORT = Number(process.env.PORT || 3193)

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(data)
}

function match(pathname, pattern) {
  const pp = pattern.split('/').filter(Boolean)
  const ap = pathname.split('/').filter(Boolean)
  if (pp.length !== ap.length) return null
  const params = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i])
    else if (pp[i] !== ap[i]) return null
  }
  return params
}

function storefrontPayload() {
  return STOREFRONTS.map((s) => ({
    code: s.code,
    name: s.name,
    flag: s.flag,
    currency: s.currency,
    region: s.region,
  }))
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let pathname = url.pathname
  if (pathname.startsWith('/api/switch')) pathname = pathname.slice('/api/switch'.length) || '/'
  if (!pathname.startsWith('/')) pathname = `/${pathname}`

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  try {
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        dataDir: DATA_DIR,
        refreshing: isRefreshing(),
        meta: loadMeta(),
      })
      return
    }

    if (req.method === 'GET' && pathname === '/home') {
      await ensureFx().catch(() => null)
      for (const seed of HOT_TOP10) ensureSeedMeta(seed)
      ensureHotPricesQuick()
      sendJson(res, 200, {
        cards: homeHighlights(10),
        storefronts: storefrontPayload(),
      })
      return
    }

    if (req.method === 'GET' && pathname === '/games') {
      const q = (url.searchParams.get('q') || '').trim()
      let items = loadGames().items

      if (q) {
        const remote = await searchGames(q).catch((e) => {
          console.warn('search', e.message)
          return []
        })
        items = remote.length
          ? remote
          : loadGames().items.filter((a) => {
              const hay = `${a.name || ''} ${a.nameZh || ''} ${a.publisher || ''}`.toLowerCase()
              return hay.includes(q.toLowerCase())
            })
      }

      items = items.map((g) => {
        const prices = loadPrices(g.gameId)
        return {
          gameId: g.gameId,
          name: g.nameZh || g.name,
          nameEn: g.name,
          publisher: g.publisher,
          icon: g.icon,
          summary: g.summary,
          category: g.category || '游戏',
          platforms: g.platforms || ['Nintendo Switch'],
          regions: prices.rows?.length || 0,
        }
      })

      sendJson(res, 200, { items, source: q ? 'eshop' : 'local' })
      return
    }

    let params = match(pathname, '/games/:gameId')
    if (req.method === 'GET' && params) {
      const gameId = String(params.gameId)
      let game = getGame(gameId)
      if (!game) {
        const seed = SEED_GAMES.find((s) => s.gameId === gameId)
        if (seed) game = ensureSeedMeta(seed)
      }
      if (!game) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }
      const prices = loadPrices(game.gameId)
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      if (!prices.rows?.length && !isRefreshing()) {
        refreshGamePrices(game.gameId, {
          force: true,
          storefronts: quickStorefronts(),
        }).catch((e) => console.error('bg refresh', game.gameId, e.message))
      }
      sendJson(res, 200, {
        game: {
          gameId: game.gameId,
          name: game.nameZh || game.name,
          nameEn: game.name,
          publisher: game.publisher,
          icon: game.icon,
          summary: game.summary,
          category: game.category || '游戏',
          platforms: game.platforms || ['Nintendo Switch'],
          nsuids: game.nsuids || prices.nsuids || {},
        },
        country: country || null,
        storefronts: storefrontPayload(),
        updatedAt: prices.updatedAt,
        refreshing: isRefreshingGame(game.gameId),
        refresh: refreshState(game.gameId),
        regionCount: prices.rows?.length || 0,
      })
      return
    }

    params = match(pathname, '/games/:gameId/prices')
    if (req.method === 'GET' && params) {
      const gameId = String(params.gameId)
      let prices = loadPrices(gameId)
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      if (!prices.rows?.length && !isRefreshing()) {
        refreshGamePrices(gameId, {
          force: true,
          storefronts: quickStorefronts(),
        }).catch((e) => console.error('bg price refresh', gameId, e.message))
      }
      const allRows = rankedRows(prices)
      const rows = allRows.slice(0, 10)
      const selected = country ? priceForCountry(prices, country) : null
      sendJson(res, 200, {
        rows,
        selected,
        country: country || null,
        updatedAt: prices.updatedAt,
        refreshing: isRefreshingGame(gameId),
        maxCny: rows.length ? rows[rows.length - 1].cny : null,
        minCny: rows.length ? rows[0].cny : null,
        topN: 10,
        order: 'cny_asc_lowest_first',
        storefronts: STOREFRONT_MAP,
      })
      return
    }

    params = match(pathname, '/games/:gameId/refresh')
    if (req.method === 'POST' && params) {
      const gameId = String(params.gameId)
      const previous = loadPrices(gameId)
      const full = url.searchParams.get('full') === '1'
      if (isRefreshing()) {
        sendJson(res, 202, {
          ok: true,
          started: false,
          busy: true,
          refreshingThis: isRefreshingGame(gameId),
          previousUpdatedAt: previous.updatedAt,
          message: isRefreshingGame(gameId)
            ? '正在获取此游戏'
            : '其他任务进行中，请稍候自动继续',
        })
        return
      }
      refreshGamePrices(gameId, {
        force: true,
        storefronts: full ? STOREFRONTS : quickStorefronts(),
      }).catch((e) => console.error('refresh', gameId, e.message))
      sendJson(res, 202, {
        ok: true,
        started: true,
        busy: false,
        refreshingThis: true,
        previousUpdatedAt: previous.updatedAt,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/refresh-seeds') {
      const limit = url.searchParams.get('limit')
      const force = url.searchParams.get('force') === '1'
      refreshSeeds({
        force,
        limit: limit ? Number(limit) : undefined,
      }).catch((e) => console.error('seed refresh', e))
      sendJson(res, 202, { ok: true, started: true })
      return
    }

    if (req.method === 'GET' && pathname === '/storefronts') {
      sendJson(res, 200, { storefronts: storefrontPayload() })
      return
    }

    if (req.method === 'GET' && pathname === '/fx') {
      sendJson(res, 200, loadFx())
      return
    }

    sendJson(res, 404, { error: 'not_found', path: pathname })
  } catch (err) {
    console.error(err)
    sendJson(res, 500, { error: String(err.message || err) })
  }
}

ensureDir()
ensureFx().catch((e) => console.warn('fx warmup', e.message))

for (const seed of SEED_GAMES) {
  try {
    ensureSeedMeta(seed)
  } catch (e) {
    console.warn('seed meta', seed.gameId, e.message)
  }
}

const server = http.createServer((req, res) => {
  handle(req, res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`switch-price listening on 127.0.0.1:${PORT} data=${DATA_DIR}`)
  backfillMissingIcons()
    .then((n) => {
      if (n) console.log(`backfilled ${n} missing game icons`)
    })
    .catch((e) => console.warn('icon backfill', e.message))
})
