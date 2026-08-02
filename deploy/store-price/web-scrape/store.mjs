import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AI_PRODUCTS } from '../catalog.mjs'
import { PLAN_EXPANSIONS } from '../plan-expansions.mjs'
import { getOfficial, officialPlans } from '../official-web-prices.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadSheetPatchIds() {
  try {
    const p = path.join(__dirname, '..', 'sheet', 'price-patches.json')
    if (!fs.existsSync(p)) return new Set()
    return new Set(Object.keys(JSON.parse(fs.readFileSync(p, 'utf8'))))
  } catch {
    return new Set()
  }
}

const BUNDLE_PATH = path.join(__dirname, '..', 'web-prices.json')
const LOG_PATH = path.join(
  process.env.STORE_DATA_DIR || '/var/lib/maotaiworks/store',
  'web-scrape-log.json',
)

function isPlanKey(k) {
  return k && !String(k).startsWith('_')
}

export function loadWebPricesBundle() {
  const j = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'))
  return j
}

export function saveWebPricesBundle(doc) {
  const tmp = `${BUNDLE_PATH}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n')
  fs.renameSync(tmp, BUNDLE_PATH)
}

export function writeScrapeLog(log) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true })
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n')
  } catch (e) {
    console.warn('web-scrape log write failed', e.message)
  }
}

export function setProductStatus(bundle, productId, patch) {
  if (!bundle._meta) bundle._meta = {}
  if (!bundle._meta.byProduct) bundle._meta.byProduct = {}
  const prev = bundle._meta.byProduct[productId] || {}
  bundle._meta.byProduct[productId] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Seed missing priced products from official-web-prices (never wipe existing plans).
 * @returns {string[]} newly seeded product ids
 */
export function ensureOfficialSeed(bundle) {
  const seeded = []
  for (const product of AI_PRODUCTS) {
    const id = product.productId
    const official = getOfficial(id)
    if (!official) {
      setProductStatus(bundle, id, { status: 'missing', note: 'not_in_official_table' })
      continue
    }
    if (official.status === 'missing') {
      if (bundle[id] && Object.keys(bundle[id]).some((k) => isPlanKey(k))) {
        bundle[id] = {}
        seeded.push(id)
      }
      setProductStatus(bundle, id, {
        status: 'missing',
        note: official.note || 'missing',
        pricingUrl: official.pricingUrl,
      })
      continue
    }
    const existing = bundle[id]
    const plans = officialPlans(id)
    if (!plans) {
      setProductStatus(bundle, id, { status: 'missing', pricingUrl: official.pricingUrl })
      continue
    }
    const hasPlans =
      existing &&
      typeof existing === 'object' &&
      Object.keys(existing).some((k) => isPlanKey(k) && existing[k]?.base)
    if (hasPlans) {
      // Curated multi-tier / sheet patches: replace with official set (keep locals).
      // Other products: only add missing plan keys (never wipe scrape amounts).
      const sheetPatched = loadSheetPatchIds()
      const curated = Boolean(PLAN_EXPANSIONS[id]) || sheetPatched.has(id)
      let touched = 0
      const merged = curated ? {} : { ...existing }
      // Sheet marked missing → clear plans
      if (curated && official.status === 'missing') {
        bundle[id] = {}
        seeded.push(id)
        setProductStatus(bundle, id, {
          status: 'missing',
          note: official.note || 'missing',
          pricingUrl: official.pricingUrl,
        })
        continue
      }
      for (const [planId, plan] of Object.entries(plans)) {
        if (!isPlanKey(planId)) continue
        const prev = existing[planId]
        const locals =
          prev?.locals && Object.keys(prev.locals).length
            ? prev.locals
            : plan.locals || {}
        if (curated) {
          merged[planId] = { ...plan, locals }
          touched += 1
        } else if (!prev?.base) {
          merged[planId] = { ...plan, locals }
          touched += 1
        }
      }
      if (touched) {
        bundle[id] = merged
        seeded.push(id)
      }
      setProductStatus(bundle, id, {
        status: bundle._meta?.byProduct?.[id]?.status || 'seeded',
        pricingUrl: official.pricingUrl,
        source: bundle._meta?.byProduct?.[id]?.source || 'curated',
      })
      continue
    }
    bundle[id] = { ...plans }
    setProductStatus(bundle, id, {
      status: 'seeded',
      pricingUrl: official.pricingUrl,
      source: 'official-web-prices',
    })
    seeded.push(id)
  }
  return seeded
}

/**
 * Apply scraper result onto bundle in-place.
 * Respects keep/keepUnmatched — never deletes curated on failure.
 * @returns {string[]} updated product ids
 */
export function applyScrapeResult(bundle, result) {
  const updated = []
  if (!result) return updated

  const status = result.status || (result.source?.startsWith('fallback') ? 'fallback' : 'live')
  const now = new Date().toISOString()

  if (result.keep && !result.plans && !result.byProduct) {
    for (const productId of result.productIds || []) {
      setProductStatus(bundle, productId, {
        status,
        source: result.source,
        pricingUrl: result.url,
        lastError: result.error || null,
        lastConfirmedAt: bundle._meta?.byProduct?.[productId]?.lastConfirmedAt || null,
      })
    }
    return updated
  }

  if (result.byProduct) {
    for (const [productId, plans] of Object.entries(result.byProduct)) {
      if (!plans) continue
      bundle[productId] = { ...plans }
      updated.push(productId)
      setProductStatus(bundle, productId, {
        status,
        source: result.source,
        pricingUrl: result.url,
        lastConfirmedAt: now,
        lastError: null,
      })
    }
    return updated
  }

  if (result.plans && result.productIds?.length) {
    for (const productId of result.productIds) {
      const prev = bundle[productId] || {}
      const next = { ...result.plans }
      if (result.keepUnmatched) {
        for (const [planId, oldPlan] of Object.entries(prev)) {
          if (!isPlanKey(planId)) continue
          if (!next[planId]) next[planId] = oldPlan
        }
      }
      for (const [planId, plan] of Object.entries(next)) {
        if (!isPlanKey(planId)) continue
        const oldLocals = prev[planId]?.locals
        if (oldLocals && (!plan.locals || !Object.keys(plan.locals).length)) {
          plan.locals = oldLocals
        }
      }
      bundle[productId] = next
      updated.push(productId)
      setProductStatus(bundle, productId, {
        status: result.partial ? 'confirmed' : status,
        source: result.source,
        pricingUrl: result.url,
        lastConfirmedAt: now,
        lastError: null,
        partial: !!result.partial,
      })
    }
  }
  return updated
}

export function summarizeStatuses(bundle) {
  const by = bundle._meta?.byProduct || {}
  const counts = { live: 0, confirmed: 0, fallback: 0, stale: 0, missing: 0, seeded: 0, other: 0 }
  for (const product of AI_PRODUCTS) {
    const st = by[product.productId]?.status || 'other'
    if (counts[st] != null) counts[st] += 1
    else counts.other += 1
  }
  return counts
}
