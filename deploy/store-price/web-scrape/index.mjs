#!/usr/bin/env node
/**
 * Nightly / on-demand official web price scrape.
 * 1) Seed missing products from official-web-prices.mjs
 * 2) Dedicated scrapers (live / fallback)
 * 3) Generic confirm for remaining curated products
 * Never deletes curated data on failure (stale/missing keep old plans).
 *
 * Usage:
 *   node web-scrape/index.mjs
 *   node web-scrape/index.mjs --only=kimi,openai
 */
import { AI_PRODUCTS } from '../catalog.mjs'
import { getOfficial } from '../official-web-prices.mjs'
import { DEDICATED, buildGenericJobs, dedicatedProductIds } from './registry.mjs'
import {
  applyScrapeResult,
  ensureOfficialSeed,
  loadWebPricesBundle,
  saveWebPricesBundle,
  setProductStatus,
  summarizeStatuses,
  writeScrapeLog,
} from './store.mjs'

function parseOnly(argv) {
  const arg = argv.find((a) => a.startsWith('--only='))
  if (!arg) return null
  return new Set(
    arg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

function toOnlySet(only) {
  if (!only) return null
  if (only instanceof Set) return only
  if (Array.isArray(only)) return new Set(only)
  if (typeof only === 'string') {
    return new Set(
      only
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  }
  return null
}

function statusFromSource(source) {
  if (!source) return 'live'
  if (String(source).startsWith('fallback')) return 'fallback'
  if (String(source).startsWith('static')) return 'fallback'
  if (String(source).includes('generic')) return 'confirmed'
  return 'live'
}

export async function scrapeAndUpdateWebPrices({ only = null } = {}) {
  const bundle = loadWebPricesBundle()
  const startedAt = new Date().toISOString()
  const results = []
  const updatedProducts = new Set()
  const touched = new Set()
  const onlySet = toOnlySet(only)

  const seeded = ensureOfficialSeed(bundle)
  if (seeded.length) {
    seeded.forEach((id) => updatedProducts.add(id))
    results.push({
      id: 'seed',
      ok: true,
      products: seeded,
      source: 'official-web-prices',
      status: 'seeded',
    })
    console.log('[web-scrape] seeded', seeded.length, 'products')
  }

  const dedicated = DEDICATED.filter((j) => !onlySet || onlySet.has(j.id))
  for (const job of dedicated) {
    const entry = {
      id: job.id,
      ok: false,
      products: [],
      error: null,
      source: null,
      status: null,
    }
    try {
      const result = await job.run()
      if (!result.status) {
        result.status = statusFromSource(result.source)
      }
      const ids = applyScrapeResult(bundle, result)
      ids.forEach((id) => {
        updatedProducts.add(id)
        touched.add(id)
      })
      entry.ok = true
      entry.products = ids
      entry.source = result.source
      entry.url = result.url
      entry.status = result.status
      console.log('[web-scrape] OK', job.id, '→', ids.join(', ') || '(none)', entry.status)
    } catch (e) {
      entry.error = String(e.message || e)
      entry.status = 'stale'
      console.warn('[web-scrape] FAIL', job.id, entry.error)
    }
    results.push(entry)
  }

  if (!onlySet || onlySet.has('generic')) {
    const skip = dedicatedProductIds()
    const generics = buildGenericJobs(bundle, { skip, onlySet })
    for (const job of generics) {
      const entry = {
        id: job.id,
        ok: false,
        products: [],
        error: null,
        source: null,
        status: null,
      }
      try {
        const result = await job.run()
        const ids = applyScrapeResult(bundle, result)
        ids.forEach((id) => {
          updatedProducts.add(id)
          touched.add(id)
        })
        entry.ok = result.status !== 'stale' && result.status !== 'missing'
        entry.products = result.productIds || ids
        entry.source = result.source
        entry.status = result.status
        entry.partial = result.partial
        entry.error = result.error || null
        if (entry.ok) console.log('[web-scrape] OK', job.id, entry.status)
        else console.warn('[web-scrape] STALE', job.id, entry.error || entry.status)
      } catch (e) {
        entry.error = String(e.message || e)
        entry.status = 'stale'
        setProductStatus(bundle, job.productId, {
          status: 'stale',
          lastError: entry.error,
        })
        console.warn('[web-scrape] FAIL', job.id, entry.error)
      }
      results.push(entry)
    }
  }

  // Ensure every catalog product has a status row
  for (const product of AI_PRODUCTS) {
    const id = product.productId
    if (onlySet && !onlySet.has(id) && !onlySet.has('generic')) continue
    const st = bundle._meta?.byProduct?.[id]
    if (st?.status) continue
    const official = getOfficial(id)
    setProductStatus(bundle, id, {
      status: official?.status === 'missing' ? 'missing' : 'missing',
      note: official?.note || 'no_status',
      pricingUrl: official?.pricingUrl || null,
    })
  }

  bundle._meta = {
    ...(bundle._meta || {}),
    note:
      '网页/桌面定价：优先官网抓取；其次官方公开价入库 + 定价页确认。失败标 stale/missing，保留旧价。切勿填入 App Store PPP。',
    updated: new Date().toISOString().slice(0, 10),
    lastScrapeAt: startedAt,
    statusCounts: summarizeStatuses(bundle),
  }

  // Always save: seed + status meta matter even when no plan amounts changed
  saveWebPricesBundle(bundle)

  const log = {
    startedAt,
    finishedAt: new Date().toISOString(),
    updatedProducts: [...updatedProducts],
    statusCounts: bundle._meta.statusCounts,
    results,
  }
  writeScrapeLog(log)
  return log
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('web-scrape/index.mjs') ||
    process.argv[1].endsWith('web-scrape\\index.mjs'))

if (isMain) {
  const only = parseOnly(process.argv.slice(2))
  scrapeAndUpdateWebPrices({ only })
    .then((log) => {
      console.log(
        JSON.stringify(
          {
            updated: log.updatedProducts.length,
            statusCounts: log.statusCounts,
            ok: log.results.filter((r) => r.ok).length,
            fail: log.results.filter((r) => !r.ok).length,
          },
          null,
          2,
        ),
      )
      process.exit(0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
