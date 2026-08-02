/**
 * Nintendo eShop helpers: multi-region search (EU + JP + NA discovery) + price API.
 */
import { REGION_PROBE } from './countries.mjs'

const PRICE_URL = 'https://api.ec.nintendo.com/v1/price'
const EU_SEARCH = 'https://searching.nintendo-europe.com/en/select'
const JP_SEARCH = 'https://search.nintendo.jp/nintendo_soft/search.json'
const JP_ICON = 'https://img-eshop.cdn.nintendo.net/i'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/pokemon/g, 'pokémon')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract 5-letter JP icode from EU product codes like HACPAAACA → AAACA */
export function productKeyFromEuCodes(codes = []) {
  const keys = new Set()
  for (const raw of codes || []) {
    const c = String(raw || '').toUpperCase()
    if (!c) continue
    keys.add(c)
    const m = /^HAC[PMY]?([A-Z0-9]{5})/.exec(c)
    if (m) keys.add(m[1])
    if (c.length >= 5) keys.add(c.slice(-5))
  }
  return [...keys]
}

export function productKeyFromJpIcode(icode) {
  const c = String(icode || '').toUpperCase()
  if (!c) return []
  return [c, `HACP${c}`, `HACM${c}`]
}

export async function searchEurope(query, rows = 24) {
  const q = String(query || '').trim()
  if (!q) return []
  const url = new URL(EU_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('fq', 'type:GAME AND system_type:nintendoswitch*')
  url.searchParams.set('rows', String(rows))
  url.searchParams.set('wt', 'json')
  url.searchParams.set(
    'fl',
    'title,nsuid_txt,image_url,image_url_sq_s,publisher,excerpt,product_code_txt,product_code_ss',
  )
  const res = await fetch(url, {
    headers: { 'User-Agent': 'maotaiworks-switch/1.0' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`eu_search_${res.status}`)
  const data = await res.json()
  const docs = data?.response?.docs || []
  return docs
    .map((d) => {
      const nsuids = (d.nsuid_txt || [])
        .map(String)
        .filter((id) => id.startsWith('7001'))
      const eu = nsuids[0]
      if (!eu) return null
      const codes = [...(d.product_code_txt || []), ...(d.product_code_ss || [])]
      const icon = d.image_url_sq_s || d.image_url || ''
      return {
        gameId: eu,
        name: d.title || eu,
        publisher: d.publisher || '',
        icon,
        summary: d.excerpt || '',
        nsuids: { eu },
        productKeys: productKeyFromEuCodes(codes),
        source: 'eu',
      }
    })
    .filter(Boolean)
}

export async function searchJapan(query, rows = 24) {
  const q = String(query || '').trim()
  if (!q) return []
  const url = new URL(JP_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('opt_sshow', '1')
  url.searchParams.set('opt_pagesize', String(rows))
  url.searchParams.set('opt_hard', '1_HAC')
  const res = await fetch(url, {
    headers: { 'User-Agent': 'maotaiworks-switch/1.0' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`jp_search_${res.status}`)
  const data = await res.json()
  const items = data?.result?.items || []
  return items
    .map((it) => {
      const nsuid = String(it.nsuid || it.id || '')
      if (!nsuid.startsWith('7001')) return null
      // Skip unreleased / not on sale accessories noise when possible
      const situ = it.ssitu || ''
      if (situ && situ !== 'onsale' && situ !== 'sales_termination') {
        /* still allow; some classics marked oddly */
      }
      const iurl = it.iurl ? String(it.iurl) : ''
      const icon = iurl ? `${JP_ICON}/${iurl}.jpg` : ''
      return {
        gameId: nsuid,
        name: it.title || nsuid,
        publisher: it.maker || '',
        icon,
        summary: it.text || '',
        nsuids: { jp: nsuid },
        productKeys: productKeyFromJpIcode(it.icode),
        source: 'jp',
      }
    })
    .filter(Boolean)
}

/**
 * Resolve NA cover from US store product page when we know the NA nsuid.
 */
export async function fetchUsIcon(naNsuid) {
  const id = String(naNsuid || '')
  if (!id.startsWith('700')) return ''
  try {
    // US store pages embed assets.nintendo.com URLs containing the nsuid.
    const url = `https://www.nintendo.com/us/search/?q=${encodeURIComponent(id)}&p=1&cat=gws`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'maotaiworks-switch/1.0' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!res.ok) return ''
    const html = await res.text()
    const re = new RegExp(
      `https://assets\\.nintendo\\.com/image/upload/[^"\\s]+${id}[^"\\s]*`,
      'g',
    )
    const m = html.match(re)
    if (m?.[0]) return m[0].replace(/\\u002F/g, '/')
  } catch {
    /* ignore */
  }
  return ''
}

function shareProductKey(aKeys = [], bKeys = []) {
  const set = new Set(aKeys.map((k) => String(k).toUpperCase()))
  return bKeys.some((k) => set.has(String(k).toUpperCase()))
}

function nsuidProximity(aNsuids = {}, bNsuids = {}, maxDist = 5n) {
  const as = Object.values(aNsuids).map((x) => BigInt(String(x)))
  const bs = Object.values(bNsuids).map((x) => BigInt(String(x)))
  for (const x of as) {
    for (const y of bs) {
      const d = x > y ? x - y : y - x
      if (d <= maxDist) return true
    }
  }
  return false
}

function mergeHit(into, extra) {
  into.nsuids = { ...extra.nsuids, ...into.nsuids }
  into.productKeys = [
    ...new Set([...(into.productKeys || []), ...(extra.productKeys || [])]),
  ]
  if ((!into.icon || into.icon.includes('packshots')) && extra.icon) {
    into.icon = extra.icon
  }
  // Prefer JP CDN / square art
  if (extra.icon?.includes('img-eshop.cdn.nintendo.net')) into.icon = extra.icon
  if (extra.source === 'eu' && extra.name) {
    into.nameEn = extra.name
    if (!into.name || into.source === 'jp') {
      /* keep JP display name if Chinese/JP query context — caller may override */
    }
  }
  if (extra.publisher && !into.publisher) into.publisher = extra.publisher
  if (extra.summary && !into.summary) into.summary = extra.summary
  into.sources = [...new Set([...(into.sources || [into.source]), extra.source])]
  // Prefer NA as gameId when known
  if (into.nsuids.na) into.gameId = String(into.nsuids.na)
  else if (into.nsuids.eu) into.gameId = String(into.nsuids.eu)
  else if (into.nsuids.jp) into.gameId = String(into.nsuids.jp)
  return into
}

/**
 * Parallel multi-region search: Europe + Japan, merge by product code / NSUID proximity.
 * Then attach NA/HK/KR NSUIDs via price-API discovery for top results.
 */
export async function searchAllRegions(query, { rows = 20, discoverTop = 12 } = {}) {
  const q = String(query || '').trim()
  if (!q) return []

  const [euRes, jpRes] = await Promise.allSettled([
    searchEurope(q, rows),
    searchJapan(q, rows),
  ])
  const eu = euRes.status === 'fulfilled' ? euRes.value : []
  const jp = jpRes.status === 'fulfilled' ? jpRes.value : []
  if (euRes.status === 'rejected') console.warn('eu search', euRes.reason?.message)
  if (jpRes.status === 'rejected') console.warn('jp search', jpRes.reason?.message)

  const merged = []
  for (const hit of [...eu, ...jp]) {
    const item = {
      ...hit,
      nameEn: hit.source === 'eu' ? hit.name : '',
      sources: [hit.source],
    }
    const idx = merged.findIndex(
      (m) =>
        shareProductKey(m.productKeys, item.productKeys) ||
        nsuidProximity(m.nsuids, item.nsuids) ||
        (normalizeTitle(m.nameEn || m.name) &&
          normalizeTitle(m.nameEn || m.name) === normalizeTitle(item.nameEn || item.name)),
    )
    if (idx >= 0) mergeHit(merged[idx], item)
    else merged.push(item)
  }

  // Discover missing region NSUIDs (NA/HK/KR/JP) for top hits — parallel per game.
  const top = merged.slice(0, discoverTop)
  await Promise.all(
    top.map(async (hit) => {
      try {
        hit.nsuids = await discoverNsuids(hit.nsuids || {})
        if (hit.nsuids.na) hit.gameId = String(hit.nsuids.na)
        if (!hit.icon && hit.nsuids.na) {
          const usIcon = await fetchUsIcon(hit.nsuids.na)
          if (usIcon) hit.icon = usIcon
        }
      } catch (e) {
        console.warn('discover search', hit.gameId, e.message)
      }
    }),
  )

  return merged
}

/**
 * Fetch prices for many NSUIDs in one country (max ~50).
 */
export async function fetchPricesForCountry(countryCode, nsuidList) {
  const ids = [...new Set(nsuidList.map(String))].filter(Boolean)
  const out = new Map()
  if (!ids.length) return out
  const country = String(countryCode).toUpperCase()

  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    const url = `${PRICE_URL}?country=${encodeURIComponent(country)}&lang=en&ids=${chunk.join(',')}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'maotaiworks-switch/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`price_${country}_${res.status}`)
    const data = await res.json()
    for (const p of data.prices || []) {
      if (!p || p.sales_status === 'not_found') continue
      const deal = p.discount_price || p.regular_price
      if (!deal?.raw_value || !deal.currency) continue
      const amount = Number(deal.raw_value)
      if (!Number.isFinite(amount)) continue
      out.set(String(p.title_id), {
        amount,
        currency: deal.currency,
        formatted: deal.amount || `${deal.currency} ${deal.raw_value}`,
        onSale: Boolean(p.discount_price),
        salesStatus: p.sales_status,
      })
    }
    if (i + 40 < ids.length) await sleep(120)
  }
  return out
}

/** Build candidate NSUIDs around known ones (±window). */
export function candidateNsuids(nsuids, window = 3) {
  const bases = Object.values(nsuids || {})
    .map((x) => BigInt(String(x)))
    .filter((n) => n > 0n)
  const set = new Set()
  for (const base of bases) {
    for (let d = -window; d <= window; d++) {
      const n = base + BigInt(d)
      if (n > 0n) set.add(String(n))
    }
  }
  return [...set]
}

/**
 * Discover region→nsuid map by probing representative countries in parallel.
 */
export async function discoverNsuids(nsuids = {}) {
  const next = { ...nsuids }
  const candidates = candidateNsuids(next, 3)
  if (!candidates.length) return next

  const anchors = Object.values(next)
    .map((x) => BigInt(String(x)))
    .filter((n) => n > 0n)

  function pickClosest(foundIds) {
    if (!foundIds.length) return null
    if (!anchors.length) return foundIds[0]
    let best = foundIds[0]
    let bestDist = null
    for (const id of foundIds) {
      const n = BigInt(id)
      const dist = anchors.reduce((m, a) => {
        const d = n > a ? n - a : a - n
        return d < m ? d : m
      }, 10n ** 18n)
      if (bestDist == null || dist < bestDist) {
        bestDist = dist
        best = id
      }
    }
    return best
  }

  const jobs = Object.entries(REGION_PROBE).map(async ([region, country]) => {
    if (next[region]) return
    try {
      const map = await fetchPricesForCountry(country, candidates)
      const picked = pickClosest([...map.keys()])
      if (picked) next[region] = picked
    } catch (e) {
      console.warn('discover', region, e.message)
    }
  })
  await Promise.all(jobs)
  return next
}

export function nsuidForRegion(nsuids, region) {
  if (!nsuids) return null
  if (nsuids[region]) return String(nsuids[region])
  for (const key of ['na', 'eu', 'jp', 'hk', 'kr']) {
    if (nsuids[key]) return String(nsuids[key])
  }
  return null
}
