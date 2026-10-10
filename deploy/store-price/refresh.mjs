import { STOREFRONTS } from './countries.mjs'
import { HOT_TOP10, QUICK_COUNTRY_CODES, SEED_APPS } from './seeds.mjs'
import {
  ensureDir,
  getApp,
  loadApps,
  loadMeta,
  loadPrices,
  saveMeta,
  savePrices,
  upsertApp,
} from './db.mjs'
import { ensureFx, toCny } from './fx.mjs'
import { lookupApp } from './itunes.mjs'
import { scrapeAllStorefronts } from './scrape.mjs'

const PRICE_TTL_MS = Number(process.env.PRICE_TTL_MS || 12 * 60 * 60 * 1000)
const SCRAPE_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS || 550)

let refreshLock = null // e.g. "app:123" | "hot:123" | "seeds"
let hotQuickRunning = false

export function isRefreshing() {
  return Boolean(refreshLock)
}

/** True only when this trackId is the one currently scraping. */
export function isRefreshingTrack(trackId) {
  const id = Number(trackId)
  if (!refreshLock) return false
  return (
    refreshLock === `app:${id}` ||
    refreshLock === `hot:${id}` ||
    refreshLock.endsWith(`:${id}`)
  )
}

export function refreshState(trackId) {
  const id = trackId != null ? Number(trackId) : null
  return {
    busy: Boolean(refreshLock),
    hotQueue: hotQuickRunning,
    lock: refreshLock,
    refreshingThis: id != null ? isRefreshingTrack(id) : false,
  }
}

export function quickStorefronts() {
  const set = new Set(QUICK_COUNTRY_CODES)
  return STOREFRONTS.filter((s) => set.has(s.code))
}

export async function ensureAppMeta(trackId, seedCategory) {
  const existing = getApp(trackId)
  if (existing?.name && existing?.icon) return existing
  const meta = await lookupApp(trackId, 'us')
  if (!meta) throw new Error(`app_not_found_${trackId}`)
  return upsertApp({
    ...meta,
    category: seedCategory || meta.category,
    summary: (meta.summary || '').slice(0, 400),
    seeded: true,
    updatedAt: new Date().toISOString(),
  })
}

function withCny(byPlan, fx) {
  const out = {}
  for (const [planId, countries] of Object.entries(byPlan)) {
    out[planId] = {}
    for (const [cc, row] of Object.entries(countries)) {
      out[planId][cc] = {
        ...row,
        cny: toCny(row.amount, row.currency, fx),
      }
    }
  }
  return out
}

async function scrapeAndSave(trackId, storefronts) {
  const id = Number(trackId)
  const seed = SEED_APPS.find((s) => s.trackId === id)
  await ensureAppMeta(id, seed?.category)
  const fx = await ensureFx()
  const scraped = await scrapeAllStorefronts(id, storefronts, {
    delayMs: SCRAPE_DELAY_MS,
  })
  const byPlan = withCny(scraped.byPlan, fx)
  const doc = {
    trackId: id,
    updatedAt: new Date().toISOString(),
    plans: scraped.plans,
    byPlan,
  }
  savePrices(id, doc)
  return doc
}

export async function refreshAppPrices(trackId, { force = false, storefronts = STOREFRONTS } = {}) {
  const id = Number(trackId)
  const existing = loadPrices(id)
  if (
    !force &&
    existing.updatedAt &&
    Date.now() - new Date(existing.updatedAt).getTime() < PRICE_TTL_MS &&
    existing.plans?.length
  ) {
    return { cached: true, doc: existing }
  }

  if (refreshLock) throw new Error('refresh_busy')
  refreshLock = `app:${id}`
  try {
    const doc = await scrapeAndSave(id, storefronts)
    return { cached: false, doc }
  } finally {
    refreshLock = null
  }
}

export async function refreshSeeds({ force = false, limit } = {}) {
  if (refreshLock) throw new Error('refresh_busy')
  ensureDir()
  refreshLock = 'seeds'
  saveMeta({ ...loadMeta(), refreshing: new Date().toISOString() })

  const list = typeof limit === 'number' ? SEED_APPS.slice(0, limit) : SEED_APPS
  const results = []
  try {
    await ensureFx(force)
    for (const seed of list) {
      try {
        const existing = loadPrices(seed.trackId)
        if (
          !force &&
          existing.updatedAt &&
          Date.now() - new Date(existing.updatedAt).getTime() < PRICE_TTL_MS &&
          existing.plans?.length
        ) {
          results.push({
            trackId: seed.trackId,
            ok: true,
            cached: true,
            plans: existing.plans.length,
          })
          continue
        }
        const doc = await scrapeAndSave(seed.trackId, STOREFRONTS)
        results.push({
          trackId: seed.trackId,
          ok: true,
          plans: doc.plans?.length || 0,
        })
      } catch (err) {
        results.push({
          trackId: seed.trackId,
          ok: false,
          error: String(err?.message || err),
        })
      }
    }
    saveMeta({
      lastRefreshAt: new Date().toISOString(),
      refreshing: null,
      lastResults: results,
    })
    return results
  } finally {
    refreshLock = null
  }
}

/**
 * Infer subscription billing period from plan id/name.
 * App Store often shows the same sticker ($200) for Pro monthly and Plus annual —
 * callers should rank/display by monthly equivalent.
 */
export function inferBillingPeriod(planId, name) {
  const s = `${planId || ''} ${name || ''}`.toLowerCase()
  if (/lifetime|买断|永久|one[\s-]?time/.test(s)) {
    return { period: 'lifetime', months: null, label: '买断' }
  }
  if (/一年|年度|年付|年卡|yearly|annual|_year(?:ly)?\b|\/year|\byear\b/.test(s)) {
    return { period: 'year', months: 12, label: '年付' }
  }
  if (/季付|季度|quarter|_quarter(?:ly)?\b/.test(s)) {
    return { period: 'quarter', months: 3, label: '季付' }
  }
  if (/周付|一周|weekly|_week(?:ly)?\b/.test(s)) {
    return { period: 'week', months: 7 / 30.437, label: '周付' }
  }
  return { period: 'month', months: 1, label: '月付' }
}

export function enrichPlansWithBilling(plans = []) {
  return (plans || []).map((p) => {
    const billing = inferBillingPeriod(p.planId, p.name)
    return {
      ...p,
      billingPeriod: billing.period,
      billingLabel: billing.label,
      billingMonths: billing.months,
    }
  })
}

export function rankedPrices(priceDoc, planId) {
  const plan = (priceDoc?.plans || []).find((p) => p.planId === planId)
  const billing = inferBillingPeriod(planId, plan?.name)
  const months =
    typeof billing.months === 'number' && billing.months > 0 ? billing.months : 1

  let rows = Object.values(priceDoc.byPlan?.[planId] || {})
    .filter((r) => typeof r.cny === 'number' && r.cny > 0)
    .map((r) => {
      const billCny = r.cny
      const monthlyCny = billCny / months
      return {
        ...r,
        billCny,
        monthlyCny,
        cny: monthlyCny,
        billingPeriod: billing.period,
        billingLabel: billing.label,
        billingMonths: billing.months,
      }
    })
  // Drop extreme outliers from bad locale parsing (e.g. missing thousand units)
  if (rows.length >= 5) {
    const sorted = [...rows].sort((a, b) => a.cny - b.cny)
    const median = sorted[Math.floor(sorted.length / 2)].cny
    rows = rows.filter((r) => r.cny >= median * 0.08 && r.cny <= median * 25)
  }
  rows.sort((a, b) => a.cny - b.cny)
  const lowest = rows[0]?.cny
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    isLowest: r.cny === lowest,
  }))
}

function planScore(name) {
  const n = String(name || '').toLowerCase()
  if (/coin|star|credit|宝石|金币|花币|badge/.test(n)) return 0
  // Prefer entry tiers over higher "Plus/Pro/Max" when name-scoring only.
  if (/\bmini\b|basic|starter|go\b|youth|青春|入门/.test(n)) return 14
  if (/premium|plus|pro|standard|monthly|subscription|订阅|verified|netflix|nitro/.test(n)) {
    return /年度|annual|year|week|一周|季付|quarter/.test(n) ? 8 : 12
  }
  if (/年度|annual|year/.test(n)) return 4
  return 3
}

function isPeriodPlan(plan) {
  const billing = inferBillingPeriod(plan?.planId, plan?.name)
  return billing.period !== 'month'
}

/**
 * Preferred default plan ids per product (first existing match wins).
 * ChatGPT defaults to Plus — most common paid tier — instead of cheapest Go.
 */
const PREFERRED_DEFAULT_PLANS = {
  chatgpt: ['chatgpt-plus', 'plus_monthly'],
}

function pickPreferredPlan(plans, productId) {
  const preferred = productId ? PREFERRED_DEFAULT_PLANS[productId] : null
  if (!preferred?.length || !plans?.length) return null
  const byId = new Map(plans.map((p) => [p.planId, p]))
  for (const id of preferred) {
    if (byId.has(id)) return id
  }
  // Fallback: monthly plan whose name looks like Plus (not Pro/Go).
  const plusNamed = plans.find((p) => {
    if (isPeriodPlan(p)) return false
    const n = String(p.name || p.planId || '').toLowerCase()
    return /\bplus\b/.test(n) && !/\bpro\b/.test(n) && !/\bgo\b/.test(n)
  })
  return plusNamed?.planId || null
}

/** Prefer product preferred tier, else cheapest monthly list price; else name heuristics. */
export function pickDefaultPlan(priceDoc, productIdHint) {
  if (!priceDoc?.plans?.length) return null
  const productId = productIdHint || priceDoc.productId || null
  const preferred = pickPreferredPlan(priceDoc.plans, productId)
  if (preferred) return preferred

  const meta = priceDoc.planMeta || {}
  const monthly = priceDoc.plans.filter((p) => !isPeriodPlan(p))
  const pool = monthly.length ? monthly : priceDoc.plans
  const priced = pool
    .map((p) => {
      const base = meta[p.planId]?.base
      const cny = typeof base?.cny === 'number' ? base.cny : null
      return { planId: p.planId, name: p.name, cny, score: planScore(p.name) }
    })
    .filter((x) => typeof x.cny === 'number' && x.cny > 0)
  if (priced.length) {
    priced.sort((a, b) => a.cny - b.cny || b.score - a.score)
    return priced[0].planId
  }
  const ranked = [...pool].sort((a, b) => planScore(b.name) - planScore(a.name))
  return ranked[0].planId
}

/** Plans that have a price row in the given storefront. */
export function plansForCountry(priceDoc, country) {
  const plans = priceDoc.plans || []
  if (!country) return plans
  return plans.filter((p) => priceDoc.byPlan?.[p.planId]?.[country])
}

export function pickDefaultPlanForCountry(priceDoc, country, productIdHint) {
  const plans = plansForCountry(priceDoc, country)
  if (!plans.length) return null
  const productId = productIdHint || priceDoc.productId || null
  const preferred = pickPreferredPlan(plans, productId)
  if (preferred) return preferred
  const ranked = [...plans].sort((a, b) => planScore(b.name) - planScore(a.name))
  return ranked[0].planId
}

/** One storefront's price + global rank for a plan. */
export function priceForCountry(priceDoc, planId, country) {
  if (!planId || !country) return null
  const row = priceDoc.byPlan?.[planId]?.[country]
  if (!row || typeof row.cny !== 'number') return null
  const all = rankedPrices(priceDoc, planId)
  const hit = all.find((r) => r.country === country)
  const sf = STOREFRONTS.find((s) => s.code === country)
  if (!hit) return null
  return {
    ...hit,
    totalRegions: all.length,
    regionName: sf?.name || country.toUpperCase(),
    flag: sf?.flag || '',
  }
}

/** Background: fill HOT_TOP10 with a smaller country set so home prices appear quickly. */
export function ensureHotPricesQuick() {
  if (hotQuickRunning || refreshLock) return false
  hotQuickRunning = true
  ;(async () => {
    try {
      await ensureFx()
      const storefronts = quickStorefronts()
      for (const seed of HOT_TOP10) {
        while (refreshLock) {
          await new Promise((r) => setTimeout(r, 1500))
        }
        const existing = loadPrices(seed.trackId)
        if (
          existing.plans?.length &&
          existing.updatedAt &&
          Date.now() - new Date(existing.updatedAt).getTime() < PRICE_TTL_MS
        ) {
          continue
        }
        refreshLock = `hot:${seed.trackId}`
        try {
          await scrapeAndSave(seed.trackId, storefronts)
          console.log('hot quick ok', seed.trackId, seed.slug)
        } catch (e) {
          console.warn('hot quick fail', seed.trackId, e.message)
        } finally {
          refreshLock = null
        }
      }
    } finally {
      hotQuickRunning = false
    }
  })()
  return true
}

/** Home row: fixed global top-10 popular apps, in popularity order. */
export function homeHighlights(max = 10) {
  const appsDoc = loadApps()
  const byId = Object.fromEntries(appsDoc.items.map((a) => [a.trackId, a]))
  const cards = []

  for (const seed of HOT_TOP10.slice(0, max)) {
    const app = byId[seed.trackId]
    if (!app) {
      cards.push({
        trackId: seed.trackId,
        name: seed.slug,
        icon: '',
        planId: null,
        planName: null,
        best: null,
        us: null,
        savePct: null,
        pending: true,
      })
      continue
    }

    const prices = loadPrices(app.trackId)
    const planId = pickDefaultPlan(prices)
    const ranked = planId ? rankedPrices(prices, planId) : []
    const best = ranked[0] || null
    const us = planId ? prices.byPlan[planId]?.us : null
    const savePct =
      best && us?.cny && best.cny
        ? Math.max(0, Math.round((1 - best.cny / us.cny) * 100))
        : null
    const sf = best ? STOREFRONTS.find((s) => s.code === best.country) : null

    cards.push({
      trackId: app.trackId,
      name: app.name,
      icon: app.icon,
      planId,
      planName: planId
        ? prices.plans.find((p) => p.planId === planId)?.name
        : null,
      best: best
        ? {
            ...best,
            regionName: sf?.name || best.country.toUpperCase(),
            flag: sf?.flag || '',
          }
        : null,
      us,
      savePct,
      pending: !best,
    })
  }

  return cards
}

export function planSummaries(priceDoc) {
  return (priceDoc.plans || []).map((p) => {
    const ranked = rankedPrices(priceDoc, p.planId)
    const best = ranked[0]
    return {
      planId: p.planId,
      name: p.name,
      minCny: best?.cny ?? null,
      bestCountry: best?.country ?? null,
      regions: ranked.length,
    }
  })
}
