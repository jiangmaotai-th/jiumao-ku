import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ensureDir } from './db.mjs'

function historyDir(productId, channel) {
  return path.join(DATA_DIR, 'history', String(productId), String(channel))
}

function historyPath(productId, channel, planId) {
  const safe = String(planId).replace(/[^a-zA-Z0-9._-]+/g, '_')
  return path.join(historyDir(productId, channel), `${safe}.jsonl`)
}

/** Append one snapshot row per country for a plan (dedupe same calendar day). */
export function appendHistory(productId, channel, planId, rows) {
  if (!productId || !channel || !planId || !rows?.length) return
  ensureDir()
  const dir = historyDir(productId, channel)
  fs.mkdirSync(dir, { recursive: true })
  const file = historyPath(productId, channel, planId)
  const day = new Date().toISOString().slice(0, 10)
  let existing = ''
  try {
    existing = fs.readFileSync(file, 'utf8')
  } catch {
    /* new file */
  }
  // Drop today's lines for these countries so re-refresh replaces the day
  const keep = existing
    .split('\n')
    .filter(Boolean)
    .filter((line) => {
      try {
        const o = JSON.parse(line)
        return o.t !== day
      } catch {
        return false
      }
    })
  for (const r of rows) {
    if (typeof r.cny !== 'number' || !(r.cny > 0)) continue
    keep.push(
      JSON.stringify({
        t: day,
        country: r.country,
        amount: r.amount,
        currency: r.currency,
        cny: r.cny,
      }),
    )
  }
  fs.writeFileSync(file, keep.join('\n') + (keep.length ? '\n' : ''))
}

/**
 * Load history points.
 * mode: 'lowest' → daily global min CNY; or specific country code.
 */
export function loadHistory(productId, channel, planId, { days = 90, country = '' } = {}) {
  const file = historyPath(productId, channel, planId)
  let lines = []
  try {
    lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  } catch {
    return []
  }
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const byDay = new Map()
  for (const line of lines) {
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (!o.t || o.t < sinceStr) continue
    if (country) {
      if (o.country !== country) continue
      byDay.set(o.t, { t: o.t, cny: o.cny, country: o.country })
    } else if (channel === 'web' || channel === 'desktop') {
      // Unified channels: prefer global USD base (us), never daily min of locals.
      const prev = byDay.get(o.t)
      if (o.country === 'us' || !prev) {
        byDay.set(o.t, { t: o.t, cny: o.cny, country: o.country })
      }
    } else {
      const prev = byDay.get(o.t)
      if (!prev || o.cny < prev.cny) {
        byDay.set(o.t, { t: o.t, cny: o.cny, country: o.country })
      }
    }
  }
  return [...byDay.values()].sort((a, b) => (a.t < b.t ? -1 : 1))
}

const FLAT_ABS = 0.5 // CNY
const FLAT_PCT = 0.005 // 0.5%

/**
 * Compare latest history point vs previous day.
 * @returns {{ direction: 'up'|'down'|'flat'|null, pct: number|null, delta: number|null, prevCny: number|null }}
 */
export function priceTrendFromHistory(productId, channel, planId, { country = '' } = {}) {
  if (!productId || !channel || !planId) {
    return { direction: null, pct: null, delta: null, prevCny: null }
  }
  const points = loadHistory(productId, channel, planId, { days: 30, country })
  if (points.length < 2) {
    return { direction: null, pct: null, delta: null, prevCny: null }
  }
  const prev = points[points.length - 2]
  const cur = points[points.length - 1]
  if (!(prev?.cny > 0) || !(cur?.cny > 0)) {
    return { direction: null, pct: null, delta: null, prevCny: null }
  }
  const delta = cur.cny - prev.cny
  const pct = delta / prev.cny
  let direction = 'flat'
  if (Math.abs(delta) >= FLAT_ABS && Math.abs(pct) >= FLAT_PCT) {
    direction = delta > 0 ? 'up' : 'down'
  }
  return {
    direction,
    pct,
    delta,
    prevCny: prev.cny,
    prevDay: prev.t,
    day: cur.t,
  }
}
