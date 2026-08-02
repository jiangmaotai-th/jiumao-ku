import { loadFx, saveFx } from './db.mjs'

const FX_TTL_MS = 12 * 60 * 60 * 1000

/** rates[currency] = CNY per 1 unit of currency */
export async function ensureFx(force = false) {
  const current = loadFx()
  if (
    !force &&
    current.updatedAt &&
    Date.now() - new Date(current.updatedAt).getTime() < FX_TTL_MS &&
    current.rates?.USD
  ) {
    return current
  }

  const url = 'https://api.frankfurter.app/latest?from=EUR'
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`fx_http_${res.status}`)
  const data = await res.json()
  const eurTo = data.rates || {}
  const eurCny = eurTo.CNY
  if (!eurCny) throw new Error('fx_missing_cny')

  const rates = { EUR: eurCny, CNY: 1 }
  for (const [code, perEur] of Object.entries(eurTo)) {
    if (code === 'CNY') continue
    rates[code] = eurCny / perEur
  }

  try {
    const r2 = await fetch('https://open.er-api.com/v6/latest/CNY', {
      signal: AbortSignal.timeout(15000),
    })
    if (r2.ok) {
      const j = await r2.json()
      if (j?.rates) {
        for (const [code, perCny] of Object.entries(j.rates)) {
          if (typeof perCny === 'number' && perCny > 0) {
            rates[code] = 1 / perCny
          }
        }
        rates.CNY = 1
      }
    }
  } catch {
    /* keep frankfurter subset */
  }

  const doc = {
    updatedAt: new Date().toISOString(),
    base: 'CNY',
    rates,
  }
  saveFx(doc)
  return doc
}

export function toCny(amount, currency, fxDoc) {
  if (amount == null || Number.isNaN(amount)) return null
  if (currency === 'CNY') return amount
  const rate = fxDoc?.rates?.[currency]
  if (!rate) return null
  return amount * rate
}
