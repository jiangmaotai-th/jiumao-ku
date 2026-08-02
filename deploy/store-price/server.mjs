#!/usr/bin/env node
/**
 * AI 订阅低价区查询器 API — maotaiworks.com/store/
 * Listens on 127.0.0.1:3192
 */
import http from 'node:http'
import { STOREFRONTS, STOREFRONT_MAP } from './countries.mjs'
import {
  AI_PRODUCTS,
  CATEGORIES,
  HOT_PRODUCTS,
  getProduct,
  isHotBadgeProduct,
  listCategories,
  resolveProductIcon,
} from './catalog.mjs'
import {
  DATA_DIR,
  ensureDir,
  getApp,
  loadFx,
  loadMeta,
  loadPrices,
  loadChannelPrices,
  upsertApp,
} from './db.mjs'
import { ensureFx } from './fx.mjs'
import { loadHistory } from './history.mjs'
import { lookupApp, searchAppsMulti } from './itunes.mjs'
import {
  ensureHotPricesQuick,
  homeHighlights,
  isRefreshing,
  isRefreshingTrack,
  pickDefaultPlan,
  pickDefaultPlanForCountry,
  plansForCountry,
  priceForCountry,
  rankedPrices,
  refreshAppPrices,
  refreshSeeds,
  refreshState,
  ensureAppMeta,
  quickStorefronts,
  planSummaries,
} from './refresh.mjs'
import {
  buildChannelAdvice,
  decorateRows,
  ensureHotAiPricesQuick,
  ensureProductAppMeta,
  filterAppStoreForProduct,
  enrichPlans,
  homeAiHighlights,
  homeUpdatedAt,
  refreshAiSeeds,
  refreshProductAll,
  refreshProductChannel,
} from './product-refresh.mjs'
import { scrapeAndUpdateWebPrices } from './web-scrape/index.mjs'
import { SEED_APPS } from './seeds.mjs'

const PORT = Number(process.env.PORT || 3192)
/** Prevent GET /products/:id from re-kicking the same channel fill in a loop. */
const bgFillOnce = new Set()

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
  }))
}

function channelAvailability(product) {
  return {
    appstore: Boolean(product.channels?.appstore?.trackId),
    web: Boolean(product.channels?.web),
    desktop: Boolean(
      product.channels?.desktop && product.channels.desktop.store !== 'none',
    ),
  }
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let pathname = url.pathname
  if (pathname.startsWith('/api/store')) pathname = pathname.slice('/api/store'.length) || '/'
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
        mode: 'ai-subscriptions',
        dataDir: DATA_DIR,
        refreshing: isRefreshing(),
        products: AI_PRODUCTS.length,
        meta: loadMeta(),
      })
      return
    }

    if (req.method === 'GET' && pathname === '/home') {
      await ensureFx().catch(() => null)
      for (const id of HOT_PRODUCTS) {
        const product = getProduct(id)
        if (product) await ensureProductAppMeta(product).catch(() => null)
      }
      ensureHotAiPricesQuick()
      // Also nudge legacy hot scrape for AS-bound apps
      ensureHotPricesQuick()
      const cards = homeAiHighlights()
      sendJson(res, 200, {
        cards,
        updatedAt: homeUpdatedAt(cards),
        categories: listCategories(),
        storefronts: storefrontPayload(),
        mode: 'ai',
      })
      return
    }

    if (req.method === 'GET' && pathname === '/categories') {
      sendJson(res, 200, { categories: listCategories() })
      return
    }

    if (req.method === 'GET' && pathname === '/products') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      const category = (url.searchParams.get('category') || '').trim()
      let items = AI_PRODUCTS.slice()
      if (category && category !== 'all') {
        items = items.filter((p) => p.category === category)
      }
      if (q) {
        items = items.filter((p) => {
          const hay = `${p.name} ${p.nameZh} ${p.vendor} ${p.productId}`.toLowerCase()
          return hay.includes(q)
        })
      }
      const mapped = []
      for (const raw of items) {
        const p = getProduct(raw.productId) || raw
        await ensureProductAppMeta(p).catch(() => null)
        const as = loadChannelPrices(p.productId, 'appstore')
        const web = loadChannelPrices(p.productId, 'web')
        mapped.push({
          productId: p.productId,
          name: p.nameZh || p.name,
          nameEn: p.name,
          vendor: p.vendor,
          category: p.category,
          icon: resolveProductIcon(p, (tid) => getApp(tid)?.icon || ''),
          hasFreeTier: Boolean(p.hasFreeTier),
          isHot: isHotBadgeProduct(p.productId),
          changeNote: p.changeNote || null,
          statusNote: p.statusNote || null,
          planStructure: p.planStructure || null,
          channels: channelAvailability(p),
          planCount:
            (as.plans?.length || 0) + (web.plans?.length || 0),
        })
      }
      sendJson(res, 200, {
        items: mapped,
        categories: listCategories(),
        source: 'catalog',
      })
      return
    }

    let params = match(pathname, '/products/:productId')
    if (req.method === 'GET' && params) {
      const product = getProduct(params.productId)
      if (!product) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }
      await ensureProductAppMeta(product).catch(() => null)
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      const avail = channelAvailability(product)
      // Kick background fills at most once per product+channel until data appears.
      for (const ch of ['web', 'desktop', 'appstore']) {
        const doc = loadChannelPrices(product.productId, ch)
        const key = `${product.productId}:${ch}`
        if (!doc.updatedAt && !bgFillOnce.has(key)) {
          bgFillOnce.add(key)
          refreshProductChannel(product.productId, ch, {
            force: true,
            storefronts: quickStorefronts(),
          })
            .catch((e) => console.warn('bg', product.productId, ch, e.message))
            .finally(() => {
              // Allow retry later if still empty after this attempt.
              const next = loadChannelPrices(product.productId, ch)
              if (next.updatedAt || next.plans?.length) return
              setTimeout(() => bgFillOnce.delete(key), 60_000)
            })
        }
      }
      const channelDocs = {}
      for (const ch of ['appstore', 'web', 'desktop']) {
        const doc = loadChannelPrices(product.productId, ch)
        channelDocs[ch] = {
          updatedAt: doc.updatedAt,
          planCount: doc.plans?.length || 0,
          note: doc.note || null,
          defaultPlanId: pickDefaultPlan(doc),
          available: avail[ch] || (doc.plans?.length > 0),
        }
      }
      sendJson(res, 200, {
        product: {
          productId: product.productId,
          name: product.nameZh || product.name,
          nameEn: product.name,
          vendor: product.vendor,
          category: product.category,
          icon: resolveProductIcon(product, (tid) => getApp(tid)?.icon || ''),
          hasFreeTier: Boolean(product.hasFreeTier),
          isHot: isHotBadgeProduct(product.productId),
          changeNote: product.changeNote || null,
          statusNote: product.statusNote || null,
          planStructure: product.planStructure || null,
          personalPlans: product.personalPlans || null,
          teamPlans: product.teamPlans || null,
          freeTrial: product.freeTrial || null,
          sheetUpdated: product.sheetUpdated || null,
          channels: product.channels,
          availability: avail,
        },
        channelDocs,
        country: country || null,
        storefronts: storefrontPayload(),
        categories: listCategories(),
        refreshing: isRefreshing(),
      })
      return
    }

    params = match(pathname, '/products/:productId/prices')
    if (req.method === 'GET' && params) {
      const product = getProduct(params.productId)
      if (!product) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }
      const channel = (url.searchParams.get('channel') || 'web').trim()
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      let doc = loadChannelPrices(product.productId, channel)
      // Web/desktop must be unified Stripe schema — rebuild stale App Store PPP caches.
      const webStale =
        (channel === 'web' || channel === 'desktop') &&
        doc.pricingModel !== 'unified'
      if (!doc.updatedAt || webStale) {
        if (channel === 'web' || channel === 'desktop') {
          try {
            doc = await refreshProductChannel(product.productId, channel, {
              force: true,
            })
          } catch {
            doc = loadChannelPrices(product.productId, channel)
          }
        } else {
          refreshProductChannel(product.productId, channel, {
            force: true,
            storefronts: quickStorefronts(),
          }).catch(() => null)
          doc = loadChannelPrices(product.productId, channel)
        }
      }
      // Live filter appstore from track scrape if channel file empty but track has data
      if (
        channel === 'appstore' &&
        !doc.plans?.length &&
        product.channels?.appstore?.trackId
      ) {
        const raw = loadPrices(product.channels.appstore.trackId)
        if (raw.plans?.length) {
          doc = filterAppStoreForProduct(product, raw)
          // don't await save
        }
      }
      let planId =
        url.searchParams.get('plan') ||
        (country && doc.pricingModel !== 'unified'
          ? pickDefaultPlanForCountry(doc, country)
          : pickDefaultPlan(doc))
      // Channel switch often leaves App Store plan ids on web/desktop — fall back.
      const planExists =
        Boolean(planId) &&
        (Boolean(doc.planMeta?.[planId]) ||
          Boolean(doc.byPlan?.[planId]) ||
          (doc.plans || []).some((p) => p.planId === planId))
      if (planId && !planExists) {
        planId =
          country && doc.pricingModel !== 'unified'
            ? pickDefaultPlanForCountry(doc, country)
            : pickDefaultPlan(doc)
      }
      const advice = buildChannelAdvice(product.productId, planId)
      if (!planId) {
        sendJson(res, 200, {
          channel,
          pricingModel: doc.pricingModel || 'regional',
          planId: null,
          plans: doc.plans || [],
          rows: [],
          selected: null,
          updatedAt: doc.updatedAt,
          note: doc.note || null,
          advice,
          topN: 10,
        })
        return
      }

      // Web / desktop: unified Stripe pricing — not App Store PPP top-10.
      if (doc.pricingModel === 'unified' || channel === 'web' || channel === 'desktop') {
        const meta = doc.planMeta?.[planId] || {}
        const selected =
          country && doc.byPlan?.[planId]?.[country]
            ? {
                ...doc.byPlan[planId][country],
                regionName:
                  STOREFRONT_MAP[country]?.name || country.toUpperCase(),
                flag: STOREFRONT_MAP[country]?.flag || '',
              }
            : null
        sendJson(res, 200, {
          channel,
          pricingModel: 'unified',
          planId,
          planName: doc.plans.find((p) => p.planId === planId)?.name,
          plans: doc.plans || [],
          base: meta.base || null,
          anomalies: meta.anomalies || [],
          warning: meta.warning || doc.note || null,
          rows: [],
          selected,
          country: country || null,
          updatedAt: doc.updatedAt,
          note: doc.note || null,
          advice,
          topN: 0,
          order: 'unified_base',
        })
        return
      }

      const { rows, billing } = decorateRows(doc, planId)
      const selected = country ? priceForCountry(doc, planId, country) : null
      const planName = doc.plans.find((p) => p.planId === planId)?.name
      const planList = enrichPlans(
        country ? plansForCountry(doc, country) : doc.plans || [],
      )
      sendJson(res, 200, {
        channel,
        pricingModel: 'regional',
        planId,
        planName,
        billingPeriod: billing?.period || null,
        billingLabel: billing?.label || null,
        billingMonths: billing?.months ?? null,
        plans: planList,
        rows,
        selected,
        country: country || null,
        updatedAt: doc.updatedAt,
        note: doc.note || null,
        advice,
        maxCny: rows.length ? rows[rows.length - 1].cny : null,
        minCny: rows.length ? rows[0].cny : null,
        topN: 10,
        order:
          billing?.period && billing.period !== 'month'
            ? 'monthly_cny_asc'
            : 'cny_asc_lowest_first',
      })
      return
    }

    params = match(pathname, '/products/:productId/history')
    if (req.method === 'GET' && params) {
      const product = getProduct(params.productId)
      if (!product) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }
      const channel = (url.searchParams.get('channel') || 'web').trim()
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      const days = Number(url.searchParams.get('days') || 90)
      const doc = loadChannelPrices(product.productId, channel)
      const planId =
        url.searchParams.get('plan') || pickDefaultPlan(doc) || 'plus_monthly'
      const points = loadHistory(product.productId, channel, planId, {
        days,
        country,
      })
      sendJson(res, 200, {
        channel,
        planId,
        country: country || null,
        days,
        mode: country ? 'country' : 'lowest',
        points,
      })
      return
    }

    params = match(pathname, '/products/:productId/refresh')
    if (req.method === 'POST' && params) {
      const product = getProduct(params.productId)
      if (!product) {
        sendJson(res, 404, { error: 'not_found' })
        return
      }
      const channel = url.searchParams.get('channel')
      const full = url.searchParams.get('full') === '1'
      if (isRefreshing() && channel === 'appstore') {
        sendJson(res, 202, {
          ok: true,
          started: false,
          busy: true,
          message: '其他任务进行中',
        })
        return
      }
      if (channel) {
        refreshProductChannel(product.productId, channel, {
          force: true,
          storefronts: full ? STOREFRONTS : quickStorefronts(),
        }).catch((e) => console.error('refresh ch', e.message))
      } else {
        refreshProductAll(product.productId, { force: true }).catch((e) =>
          console.error('refresh all', e.message),
        )
      }
      sendJson(res, 202, { ok: true, started: true })
      return
    }

    if (req.method === 'POST' && pathname === '/refresh-seeds') {
      const limit = url.searchParams.get('limit')
      const force = url.searchParams.get('force') === '1'
      refreshAiSeeds({
        force,
        limit: limit ? Number(limit) : 40,
      }).catch((e) => console.error('ai seed refresh', e))
      // Also refresh AS seeds in background (legacy)
      refreshSeeds({
        force,
        limit: limit ? Number(limit) : 15,
      }).catch(() => null)
      sendJson(res, 202, { ok: true, started: true, mode: 'ai' })
      return
    }

    // 仅跑官网网页价抓取（写 web-prices.json），不强制重爬 App Store
    if (req.method === 'POST' && pathname === '/scrape-web') {
      ;(async () => {
        try {
          const log = await scrapeAndUpdateWebPrices()
          for (const id of log.updatedProducts || []) {
            await refreshProductChannel(id, 'web', { force: true }).catch(() => null)
            await refreshProductChannel(id, 'desktop', { force: true }).catch(() => null)
          }
          console.log('[scrape-web] done', log.updatedProducts?.length)
        } catch (e) {
          console.error('scrape-web', e)
        }
      })()
      sendJson(res, 202, { ok: true, started: true, mode: 'web-scrape' })
      return
    }

    // —— Legacy /apps routes (App Store trackId) kept for compatibility ——
    if (req.method === 'GET' && pathname === '/apps') {
      const q = (url.searchParams.get('q') || '').trim()
      let items = AI_PRODUCTS.map((p) => ({
        trackId: p.channels?.appstore?.trackId || 0,
        productId: p.productId,
        name: p.nameZh || p.name,
        artist: p.vendor,
        icon: resolveProductIcon(p, (tid) => getApp(tid)?.icon || ''),
        summary: '',
        category: p.category,
        platforms: ['AI'],
        planCount: 0,
      }))
      if (q) {
        const needle = q.toLowerCase()
        items = items.filter(
          (a) =>
            a.name.toLowerCase().includes(needle) ||
            a.artist.toLowerCase().includes(needle) ||
            a.productId.includes(needle),
        )
        if (!items.length) {
          const remote = await searchAppsMulti(q, 30).catch(() => [])
          items = remote.map((r) => ({
            trackId: r.trackId,
            name: r.name,
            artist: r.artist,
            icon: r.icon,
            summary: r.summary,
            category: r.category,
            platforms: r.platforms || ['iOS'],
            planCount: 0,
          }))
        }
      }
      sendJson(res, 200, {
        items,
        categories: CATEGORIES.map((c) => c.name),
        source: 'ai-catalog',
      })
      return
    }

    params = match(pathname, '/apps/:trackId')
    if (req.method === 'GET' && params) {
      const trackId = Number(params.trackId)
      const product = AI_PRODUCTS.find(
        (p) => p.channels?.appstore?.trackId === trackId,
      )
      if (product) {
        // Redirect-style payload pointing frontend to product id
        sendJson(res, 200, {
          app: {
            trackId,
            name: product.nameZh || product.name,
            artist: product.vendor,
            icon: resolveProductIcon(product, (tid) => getApp(tid)?.icon || ''),
            summary: '',
            category: product.category,
            platforms: ['AI'],
            productId: product.productId,
          },
          plans: loadChannelPrices(product.productId, 'appstore').plans || [],
          defaultPlanId: pickDefaultPlan(
            loadChannelPrices(product.productId, 'appstore'),
          ),
          productId: product.productId,
          storefronts: storefrontPayload(),
          updatedAt: loadChannelPrices(product.productId, 'appstore').updatedAt,
          refreshing: isRefreshingTrack(trackId),
        })
        return
      }
      let app = getApp(trackId)
      if (!app) {
        const seed = SEED_APPS.find((s) => s.trackId === trackId)
        app = await ensureAppMeta(trackId, seed?.category)
      }
      const prices = loadPrices(trackId)
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      sendJson(res, 200, {
        app,
        plans: country ? plansForCountry(prices, country) : prices.plans || [],
        planSummaries: planSummaries(prices),
        defaultPlanId: country
          ? pickDefaultPlanForCountry(prices, country)
          : pickDefaultPlan(prices),
        country: country || null,
        storefronts: storefrontPayload(),
        updatedAt: prices.updatedAt,
        refreshing: isRefreshingTrack(trackId),
        refresh: refreshState(trackId),
      })
      return
    }

    params = match(pathname, '/apps/:trackId/prices')
    if (req.method === 'GET' && params) {
      const trackId = Number(params.trackId)
      const prices = loadPrices(trackId)
      const country = (url.searchParams.get('country') || '').trim().toLowerCase()
      const planId =
        url.searchParams.get('plan') ||
        (country
          ? pickDefaultPlanForCountry(prices, country)
          : pickDefaultPlan(prices))
      const allRows = planId
        ? rankedPrices(prices, planId).map((r) => ({
            ...r,
            regionName: STOREFRONT_MAP[r.country]?.name || r.country.toUpperCase(),
            flag: STOREFRONT_MAP[r.country]?.flag || '',
          }))
        : []
      const rows = allRows.slice(0, 10)
      sendJson(res, 200, {
        planId,
        planName: prices.plans.find((p) => p.planId === planId)?.name,
        rows,
        selected: country ? priceForCountry(prices, planId, country) : null,
        country: country || null,
        updatedAt: prices.updatedAt,
        maxCny: rows.length ? rows[rows.length - 1].cny : null,
        minCny: rows.length ? rows[0].cny : null,
        topN: 10,
      })
      return
    }

    params = match(pathname, '/apps/:trackId/refresh')
    if (req.method === 'POST' && params) {
      const trackId = Number(params.trackId)
      const full = url.searchParams.get('full') === '1'
      if (isRefreshing()) {
        sendJson(res, 202, { ok: true, started: false, busy: true })
        return
      }
      refreshAppPrices(trackId, {
        force: true,
        storefronts: full ? STOREFRONTS : quickStorefronts(),
      }).catch((e) => console.error('refresh', trackId, e.message))
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

const server = http.createServer((req, res) => {
  handle(req, res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ai-store-price listening on 127.0.0.1:${PORT} data=${DATA_DIR} products=${AI_PRODUCTS.length}`)
})
