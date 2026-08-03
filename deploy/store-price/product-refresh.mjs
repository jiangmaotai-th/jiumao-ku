import { STOREFRONTS, STOREFRONT_MAP } from './countries.mjs'
import {
  AI_PRODUCTS,
  HOT_PRODUCTS,
  PRODUCT_MAP,
  QUICK_COUNTRY_CODES,
  getProduct,
  isHotBadgeProduct,
  resolveProductIcon,
} from './catalog.mjs'
import {
  ensureDir,
  getApp,
  loadChannelPrices,
  loadMeta,
  loadPrices,
  saveChannelPrices,
  saveMeta,
  upsertApp,
  touchContentUpdatedAt,
} from './db.mjs'
import { appendHistory, priceTrendFromHistory } from './history.mjs'
import { ensureFx } from './fx.mjs'
import { lookupApp } from './itunes.mjs'
import {
  pickDefaultPlan,
  pickDefaultPlanForCountry,
  plansForCountry,
  priceForCountry,
  rankedPrices,
  refreshAppPrices,
  quickStorefronts,
  isRefreshing,
  isRefreshingTrack,
  inferBillingPeriod,
  enrichPlansWithBilling,
} from './refresh.mjs'
import { buildDesktopPriceDoc, buildWebPriceDoc } from './web-prices.mjs'
import { scrapeAndUpdateWebPrices } from './web-scrape/index.mjs'

function matchPlanHints(planName, hints = []) {
  const n = String(planName || '').toLowerCase()
  if (!hints.length) return true
  return hints.some((h) => n.includes(String(h).toLowerCase()))
}

/** Filter App Store price doc to plans matching product hints. */
export function filterAppStoreForProduct(product, priceDoc) {
  const hints = product?.channels?.appstore?.planHints || []
  if (!priceDoc?.plans?.length) {
    return { ...priceDoc, plans: [], byPlan: {}, productId: product.productId, channel: 'appstore' }
  }
  let plans = priceDoc.plans.filter((p) => matchPlanHints(p.name, hints))
  // Fallback: if hints too strict, keep subscription-like plans
  if (!plans.length) {
    plans = priceDoc.plans.filter((p) =>
      /plus|pro|premium|max|go|advanced|订阅|monthly|年|月/.test(
        String(p.name || '').toLowerCase(),
      ),
    )
  }
  if (!plans.length) plans = priceDoc.plans.slice(0, 8)
  const byPlan = {}
  for (const p of plans) {
    if (priceDoc.byPlan?.[p.planId]) byPlan[p.planId] = priceDoc.byPlan[p.planId]
  }
  return {
    productId: product.productId,
    channel: 'appstore',
    trackId: product.channels.appstore?.trackId,
    updatedAt: priceDoc.updatedAt,
    plans,
    byPlan,
  }
}

export async function ensureProductAppMeta(product) {
  const trackId = product?.channels?.appstore?.trackId
  if (!trackId) return null
  let app = getApp(trackId)
  if (app?.icon && app?.name) {
    if (!product.icon) product.icon = app.icon
    return app
  }
  try {
    const meta = await lookupApp(trackId, 'us')
    if (meta) {
      app = upsertApp({
        ...meta,
        category: product.category,
        seeded: true,
        updatedAt: new Date().toISOString(),
      })
      product.icon = app.icon
      return app
    }
  } catch (e) {
    console.warn('product meta', product.productId, e.message)
  }
  return app
}

export async function refreshProductChannel(
  productId,
  channel,
  { force = false, storefronts } = {},
) {
  const product = getProduct(productId)
  if (!product) throw new Error('product_not_found')
  ensureDir()
  await ensureFx()

  if (channel === 'web') {
    const doc = await buildWebPriceDoc(productId)
    saveChannelPrices(productId, 'web', doc)
    for (const plan of doc.plans || []) {
      const rows = Object.values(doc.byPlan[plan.planId] || {})
      appendHistory(productId, 'web', plan.planId, rows)
    }
    return doc
  }

  if (channel === 'desktop') {
    const doc = await buildDesktopPriceDoc(productId, product)
    saveChannelPrices(productId, 'desktop', doc)
    for (const plan of doc.plans || []) {
      const rows = Object.values(doc.byPlan[plan.planId] || {})
      appendHistory(productId, 'desktop', plan.planId, rows)
    }
    return doc
  }

  if (channel === 'appstore') {
    const trackId = product.channels?.appstore?.trackId
    if (!trackId) {
      const empty = {
        productId,
        channel: 'appstore',
        updatedAt: null,
        plans: [],
        byPlan: {},
        note: '无 App Store 订阅',
      }
      saveChannelPrices(productId, 'appstore', empty)
      return empty
    }
    await ensureProductAppMeta(product)
    const sf = storefronts || (force ? STOREFRONTS : quickStorefronts())
    await refreshAppPrices(trackId, { force: true, storefronts: sf }).catch((e) => {
      if (String(e.message).includes('refresh_busy')) throw e
      console.warn('appstore refresh', productId, e.message)
    })
    const raw = loadPrices(trackId)
    const doc = filterAppStoreForProduct(product, raw)
    saveChannelPrices(productId, 'appstore', doc)
    for (const plan of doc.plans || []) {
      const rows = Object.values(doc.byPlan[plan.planId] || {})
      appendHistory(productId, 'appstore', plan.planId, rows)
    }
    return doc
  }

  throw new Error(`unknown_channel_${channel}`)
}

export async function refreshProductAll(productId, { force = false } = {}) {
  const product = getProduct(productId)
  if (!product) throw new Error('product_not_found')
  const channels = ['appstore', 'web', 'desktop']
  const out = {}
  for (const ch of channels) {
    try {
      out[ch] = await refreshProductChannel(productId, ch, { force })
    } catch (e) {
      out[ch] = { error: String(e.message || e) }
    }
  }
  return out
}

export function getChannelDoc(productId, channel) {
  const cached = loadChannelPrices(productId, channel)
  if (cached.updatedAt && cached.plans?.length) return cached
  return cached
}

export async function ensureChannelDoc(productId, channel) {
  let doc = loadChannelPrices(productId, channel)
  if (doc.updatedAt && (doc.plans?.length || doc.note)) return doc
  try {
    doc = await refreshProductChannel(productId, channel, { force: true })
  } catch (e) {
    console.warn('ensure channel', productId, channel, e.message)
  }
  return loadChannelPrices(productId, channel)
}

export function decorateRows(priceDoc, planId) {
  const plan = (priceDoc.plans || []).find((p) => p.planId === planId)
  const billing = inferBillingPeriod(planId, plan?.name)
  const all = rankedPrices(priceDoc, planId).map((r) => ({
    ...r,
    regionName: STOREFRONT_MAP[r.country]?.name || r.country.toUpperCase(),
    flag: STOREFRONT_MAP[r.country]?.flag || '',
  }))
  const rows = all.slice(0, 10)
  return { all, rows, billing }
}

export const enrichPlans = enrichPlansWithBilling

/** Cross-channel advice: store PPP vs web unified Stripe. */
export function buildChannelAdvice(productId, planIdHint) {
  const asDoc = loadChannelPrices(productId, 'appstore')
  const webDoc = loadChannelPrices(productId, 'web')
  const asPlan =
    (planIdHint && asDoc.byPlan?.[planIdHint] && planIdHint) ||
    pickDefaultPlan(asDoc)
  const webPlan =
    (planIdHint && webDoc.planMeta?.[planIdHint] && planIdHint) ||
    pickDefaultPlan(webDoc)
  const asRanked = asPlan ? rankedPrices(asDoc, asPlan) : []
  const asBest = asRanked[0]
  const webBase = webPlan ? webDoc.planMeta?.[webPlan]?.base : null
  const webPremium = (webDoc.planMeta?.[webPlan]?.anomalies || []).filter(
    (a) => a.vsBase === 'premium',
  )

  if (!asBest && !webBase) return null

  const asSf = asBest ? STOREFRONT_MAP[asBest.country] : null
  const parts = []
  if (asBest && webBase) {
    const save = webBase.cny > 0 ? Math.round((1 - asBest.cny / webBase.cny) * 100) : 0
    if (asBest.cny < webBase.cny * 0.8) {
      parts.push(
        `想省钱请走 App Store 内购：目前最低约 ¥${asBest.cny.toFixed(2)}（${asSf?.flag || ''} ${asSf?.name || asBest.country.toUpperCase()}），比网页全球价约 ¥${webBase.cny.toFixed(2)} 低约 ${save}%`,
      )
    } else {
      parts.push(
        `App Store 最低约 ¥${asBest.cny.toFixed(2)}，网页全球约 ¥${webBase.cny.toFixed(2)}，两者接近`,
      )
    }
  } else if (asBest) {
    parts.push(
      `App Store 低价区约 ¥${asBest.cny.toFixed(2)}（${asSf?.name || asBest.country}）`,
    )
  } else if (webBase) {
    parts.push(
      `网页/桌面多为全球统一价约 ¥${webBase.cny.toFixed(2)}（${webBase.priceFormatted}），无商店那种骨折低价区`,
    )
  }
  for (const a of webPremium.slice(0, 2)) {
    parts.push(
      `⚠️ ${a.flag || ''} ${a.regionName}网页本地价 ${a.priceFormatted}（≈¥${a.cny.toFixed(2)}）比美区更贵，别在该区走网页订阅图便宜`,
    )
  }
  return {
    summary: parts.join('。') + (parts.length ? '。' : ''),
    appstoreBest: asBest
      ? {
          cny: asBest.cny,
          country: asBest.country,
          regionName: asSf?.name,
          flag: asSf?.flag,
          priceFormatted: asBest.priceFormatted,
        }
      : null,
    webBase: webBase || null,
    webPremiums: webPremium,
  }
}

export function productCardSummary(product) {
  // Home "best deal" prefers App Store PPP. Web/desktop unified base is NOT a regional deal.
  const asDoc = loadChannelPrices(product.productId, 'appstore')
  const asPlan = pickDefaultPlan(asDoc)
  const asBest = asPlan ? rankedPrices(asDoc, asPlan)[0] : null

  const webDoc = loadChannelPrices(product.productId, 'web')
  const webPlan = pickDefaultPlan(webDoc)
  const webBase = webPlan ? webDoc.planMeta?.[webPlan]?.base : null

  let best = null
  let bestChannel = null
  let bestPlan = null
  let bestPlanName = null
  if (asBest) {
    const sf = STOREFRONT_MAP[asBest.country]
    best = {
      ...asBest,
      regionName: sf?.name || asBest.country.toUpperCase(),
      flag: sf?.flag || '',
    }
    bestChannel = 'appstore'
    bestPlan = asPlan
    bestPlanName =
      asDoc.plans?.find((p) => p.planId === asPlan)?.name || asPlan || null
  } else if (webBase) {
    best = {
      country: 'us',
      amount: webBase.amount,
      currency: webBase.currency,
      priceFormatted: webBase.priceFormatted,
      cny: webBase.cny,
      regionName: '全球网页价',
      flag: '🌐',
    }
    bestChannel = 'web'
    bestPlan = webPlan
    bestPlanName =
      webDoc.plans?.find((p) => p.planId === webPlan)?.name || webPlan || null
  }

  const advice = buildChannelAdvice(product.productId, bestPlan)

  let trend = { direction: null, pct: null, delta: null }
  if (bestChannel && bestPlan) {
    const country =
      bestChannel === 'appstore' && best?.country ? best.country : ''
    trend = priceTrendFromHistory(product.productId, bestChannel, bestPlan, {
      country,
    })
  }

  const updatedAt =
    (bestChannel === 'appstore' ? asDoc.updatedAt : null) ||
    webDoc.updatedAt ||
    asDoc.updatedAt ||
    null

  return {
    productId: product.productId,
    name: product.nameZh || product.name,
    nameEn: product.name,
    category: product.category,
    vendor: product.vendor,
    icon: resolveProductIcon(product, (tid) => getApp(tid)?.icon || ''),
    hasFreeTier: Boolean(product.hasFreeTier),
    isHot: isHotBadgeProduct(product.productId),
    changeNote: product.changeNote || null,
    statusNote: product.statusNote || null,
    planStructure: product.planStructure || null,
    channels: {
      appstore: Boolean(product.channels?.appstore?.trackId),
      web: Boolean(product.channels?.web),
      desktop: product.channels?.desktop?.store && product.channels.desktop.store !== 'none',
    },
    best,
    bestChannel,
    bestPlan,
    bestPlanName,
    trend: {
      direction: trend.direction,
      pct: trend.pct,
      delta: trend.delta,
    },
    updatedAt,
    tip: advice?.summary || null,
    pending: !best,
  }
}

export function homeAiHighlights() {
  return HOT_PRODUCTS.map((id) => {
    const product = getProduct(id)
    if (!product) return null
    return productCardSummary(product)
  }).filter(Boolean)
}

/**
 * Public stamp for homepage / store title.
 * Prefer the newest of contentUpdatedAt (deploy/content), lastRefreshAt, and card prices.
 */
export function homeUpdatedAt(cards) {
  const meta = loadMeta()
  let latest = null
  for (const t of [meta.contentUpdatedAt, meta.lastRefreshAt]) {
    if (t && (!latest || t > latest)) latest = t
  }
  for (const c of cards || []) {
    if (c?.updatedAt && (!latest || c.updatedAt > latest)) latest = c.updatedAt
  }
  return latest
}

let hotFill = false
export function ensureHotAiPricesQuick() {
  if (hotFill || isRefreshing()) return false
  hotFill = true
  ;(async () => {
    try {
      for (const id of HOT_PRODUCTS) {
        const product = getProduct(id)
        if (!product) continue
        // Always rebuild web/desktop from curated file (schema may change).
        await refreshProductChannel(id, 'web', { force: true }).catch(() => null)
        await refreshProductChannel(id, 'desktop', { force: true }).catch(() => null)
        if (product.channels?.appstore?.trackId) {
          while (isRefreshing()) {
            await new Promise((r) => setTimeout(r, 1200))
          }
          const existing = loadChannelPrices(id, 'appstore')
          if (!existing.plans?.length) {
            await refreshProductChannel(id, 'appstore', {
              force: true,
              storefronts: quickStorefronts(),
            }).catch((e) => console.warn('hot ai as', id, e.message))
          }
        }
      }
    } finally {
      hotFill = false
    }
  })()
  return true
}

export async function refreshAiSeeds({ force = false, limit } = {}) {
  const list = AI_PRODUCTS.slice(0, limit || AI_PRODUCTS.length)
  const results = []
  saveMeta({ ...loadMeta(), refreshing: new Date().toISOString() })

  // 先跑官网抓取，成功则写回 web-prices.json；失败保留旧数据
  let scrapeLog = null
  try {
    scrapeLog = await scrapeAndUpdateWebPrices()
    console.log(
      '[refreshAiSeeds] web-scrape updated',
      scrapeLog.updatedProducts?.length || 0,
      'products',
    )
  } catch (e) {
    console.warn('[refreshAiSeeds] web-scrape failed', e.message)
  }

  for (const product of list) {
    try {
      await refreshProductChannel(product.productId, 'web', { force })
      await refreshProductChannel(product.productId, 'desktop', { force })
      if (product.channels?.appstore?.trackId && (force || HOT_PRODUCTS.includes(product.productId))) {
        await refreshProductChannel(product.productId, 'appstore', {
          force,
          storefronts: force ? STOREFRONTS : quickStorefronts(),
        })
      }
      results.push({ productId: product.productId, ok: true })
    } catch (e) {
      results.push({ productId: product.productId, ok: false, error: String(e.message || e) })
    }
  }
  saveMeta({
    ...loadMeta(),
    refreshing: null,
    lastRefreshAt: new Date().toISOString(),
    contentUpdatedAt: new Date().toISOString(),
    contentUpdatedReason: 'refresh-seeds',
    lastWebScrapeAt: scrapeLog?.finishedAt || null,
    lastWebScrapeUpdated: scrapeLog?.updatedProducts || [],
  })
  return results
}

export {
  pickDefaultPlan,
  pickDefaultPlanForCountry,
  plansForCountry,
  priceForCountry,
  rankedPrices,
  isRefreshingTrack,
  QUICK_COUNTRY_CODES,
  AI_PRODUCTS,
  getProduct,
}
