const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

function platformsFrom(result) {
  const tags = []
  const devices = result.supportedDevices || []
  const joined = devices.join(' ').toLowerCase()
  if (joined.includes('iphone') || result.kind === 'software') tags.push('iOS')
  if (joined.includes('ipad')) tags.push('iPadOS')
  if (result.kind === 'mac-software' || joined.includes('mac')) tags.push('macOS')
  if (!tags.length && result.wrapperType === 'software') tags.push('iOS')
  return [...new Set(tags)]
}

export async function lookupApp(trackId, country = 'us') {
  const url = `https://itunes.apple.com/lookup?id=${trackId}&country=${country}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`itunes_${res.status}`)
  const data = await res.json()
  const r = data.results?.[0]
  if (!r) return null
  return {
    trackId: r.trackId,
    name: r.trackName,
    artist: r.artistName,
    bundleId: r.bundleId,
    icon: (r.artworkUrl512 || r.artworkUrl100 || '').replace('100x100bb', '256x256bb'),
    summary: r.description || '',
    category: r.primaryGenreName || '工具',
    platforms: platformsFrom(r),
    price: r.price,
    currency: r.currency,
    url: r.trackViewUrl,
  }
}

function mapSearchResult(r) {
  return {
    trackId: r.trackId,
    name: r.trackName,
    artist: r.artistName,
    icon: (r.artworkUrl512 || r.artworkUrl100 || '').replace(
      /100x100bb|60x60bb/,
      '256x256bb',
    ),
    summary: (r.description || '').slice(0, 280),
    category: r.primaryGenreName || '工具',
    platforms: platformsFrom(r),
    bundleId: r.bundleId,
    url: r.trackViewUrl,
  }
}

export async function searchApps(term, country = 'us', limit = 50) {
  const q = encodeURIComponent(term)
  const url = `https://itunes.apple.com/search?term=${q}&entity=software&country=${country}&limit=${limit}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`itunes_search_${res.status}`)
  const data = await res.json()
  return (data.results || []).map(mapSearchResult)
}

/** Search US + CN storefronts and dedupe; also supports numeric trackId lookup. */
export async function searchAppsMulti(term, limit = 50) {
  const q = String(term || '').trim()
  if (!q) return []

  if (/^\d{6,12}$/.test(q)) {
    const hit = await lookupApp(Number(q), 'us')
    if (hit) return [hit]
    const hitCn = await lookupApp(Number(q), 'cn')
    return hitCn ? [hitCn] : []
  }

  const [us, cn] = await Promise.all([
    searchApps(q, 'us', limit).catch(() => []),
    searchApps(q, 'cn', limit).catch(() => []),
  ])
  const seen = new Set()
  const out = []
  for (const item of [...us, ...cn]) {
    if (!item?.trackId || seen.has(item.trackId)) continue
    seen.add(item.trackId)
    out.push(item)
  }
  return out.slice(0, limit)
}
