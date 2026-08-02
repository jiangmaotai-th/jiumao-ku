import { STOREFRONT_MAP } from './countries.mjs'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'HUF'])

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

/** Infer ISO currency from the formatted price string. */
export function detectCurrency(formatted, fallback) {
  const s = String(formatted || '')
  if (/USD/i.test(s)) return 'USD'
  if (/EUR/i.test(s) || s.includes('€')) return 'EUR'
  if (/GBP/i.test(s) || s.includes('£')) return 'GBP'
  if (/A\$|AUD/i.test(s)) return 'AUD'
  if (/C\$|CAD/i.test(s)) return 'CAD'
  if (/NZ\$|NZD/i.test(s)) return 'NZD'
  if (/HK\$|HKD/i.test(s)) return 'HKD'
  if (/S\$|SGD/i.test(s)) return 'SGD'
  if (/MX\$|MXN/i.test(s)) return 'MXN'
  if (/R\$|BRL/i.test(s)) return 'BRL'
  if (s.includes('₺') || /TRY/i.test(s)) return 'TRY'
  if (s.includes('₱') || /PHP/i.test(s)) return 'PHP'
  if (s.includes('₹') || /INR/i.test(s)) return 'INR'
  if (s.includes('₩') || /KRW/i.test(s)) return 'KRW'
  if (s.includes('₦') || /NGN/i.test(s)) return 'NGN'
  if (s.includes('₫') || /đ/i.test(s) || /VND/i.test(s)) return 'VND'
  if (/Rp\.?|IDR/i.test(s)) return 'IDR'
  if (s.includes('₽') || /RUB/i.test(s)) return 'RUB'
  if (s.includes('฿') || /THB/i.test(s)) return 'THB'
  if (/NT\$|TWD/i.test(s)) return 'TWD'
  if (s.includes('¥') || s.includes('￥') || /JPY|CNY/i.test(s)) {
    if (/CNY|RMB|元/i.test(s)) return 'CNY'
    if (fallback === 'CNY') return 'CNY'
    if (fallback === 'JPY') return 'JPY'
    return fallback || 'JPY'
  }
  if (s.includes('$')) return fallback === 'USD' || !fallback ? 'USD' : fallback
  return fallback || 'USD'
}

/** Parse localized App Store price strings into a number. */
export function parsePriceAmount(formatted, currency = 'USD') {
  if (!formatted) return null
  let s = String(formatted).trim()
  let mult = 1
  if (/ribu/i.test(s)) {
    mult = 1000
    s = s.replace(/ribu/ig, '')
  }
  if (/juta/i.test(s)) {
    mult = 1_000_000
    s = s.replace(/juta/ig, '')
  }

  s = s.replace(/[^\d,.\-]/g, '').trim()
  if (!s) return null

  // Dot-as-thousands (VN/ID style): 499.000 or 4.999.000
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  } else if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2 && !ZERO_DECIMAL.has(currency)) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes('.')) {
    const parts = s.split('.')
    // 999.99 vs 3.000 (thousands for zero-decimal currencies)
    if (
      ZERO_DECIMAL.has(currency) &&
      parts.length === 2 &&
      parts[1].length === 3 &&
      !parts[1].includes('.')
    ) {
      s = parts.join('')
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n * mult
}

function extractPairs(html) {
  const pairs = []
  const re =
    /class="text-pair[^"]*"[^>]*>\s*<span>([^<]+)<\/span>\s*<span>([^<]+)<\/span>/g
  let m
  while ((m = re.exec(html))) {
    pairs.push({ name: m[1].trim(), priceFormatted: m[2].trim() })
  }
  if (pairs.length) return pairs

  const idx = html.indexOf('In-App Purchases')
  if (idx < 0) return pairs
  const chunk = html.slice(idx, idx + 12000)
  const re2 = /<span>([^<]{2,80})<\/span>\s*<span>([^<]{1,40})<\/span>/g
  while ((m = re2.exec(chunk))) {
    const name = m[1].trim()
    const priceFormatted = m[2].trim()
    if (/\d/.test(priceFormatted)) {
      pairs.push({ name, priceFormatted })
    }
  }
  return pairs
}

export async function scrapeIaps(trackId, country) {
  const url = `https://apps.apple.com/${country}/app/id${trackId}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`scrape_${country}_${res.status}`)
  const html = await res.text()
  const sf = STOREFRONT_MAP[country]
  const fallbackCurrency = sf?.currency || 'USD'
  const raw = extractPairs(html)
  const seen = new Map()
  const offers = []
  for (const row of raw) {
    const currency = detectCurrency(row.priceFormatted, fallbackCurrency)
    const amount = parsePriceAmount(row.priceFormatted, currency)
    if (amount == null || amount <= 0) continue
    const base = slugify(row.name) || 'plan'
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    const planId = count === 0 ? base : `${base}-${count + 1}`
    const label =
      count === 0
        ? row.name
        : count === 1
          ? `${row.name} 年度`
          : `${row.name} #${count + 1}`
    offers.push({
      planId,
      name: label,
      amount,
      priceFormatted: row.priceFormatted,
      currency,
      country,
    })
  }
  return offers
}

export async function scrapeAllStorefronts(trackId, storefronts, { delayMs = 700, onProgress } = {}) {
  const byPlan = {}
  const planMeta = new Map()

  for (const sf of storefronts) {
    try {
      const offers = await scrapeIaps(trackId, sf.code)
      for (const o of offers) {
        if (!planMeta.has(o.planId)) {
          planMeta.set(o.planId, { planId: o.planId, name: o.name })
        }
        if (!byPlan[o.planId]) byPlan[o.planId] = {}
        byPlan[o.planId][sf.code] = {
          country: sf.code,
          amount: o.amount,
          currency: o.currency,
          priceFormatted: o.priceFormatted,
        }
      }
      onProgress?.({ country: sf.code, ok: true, count: offers.length })
    } catch (err) {
      onProgress?.({ country: sf.code, ok: false, error: String(err?.message || err) })
    }
    await sleep(delayMs)
  }

  return {
    plans: [...planMeta.values()],
    byPlan,
  }
}
