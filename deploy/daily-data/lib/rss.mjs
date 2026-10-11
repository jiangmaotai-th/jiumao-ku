const UA = 'maotaiworks-daily/1.0 (+https://maotaiworks.com)'

export async function fetchText(url, { timeout = 20000, headers = {}, accept } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: accept || 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
        ...headers,
      },
    })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchBuffer(url, timeout = 60000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function tagText(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
    if (match) return decode(match[1])
  }
  return ''
}

function linkFrom(block) {
  const wrapped = block.match(/<link\b[^>]*>\s*(https?:\/\/[^<\s]+)\s*<\/link>/i)
  if (wrapped) return wrapped[1].trim()
  const hrefs = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((match) => {
    const attrs = match[1] || ''
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    const rel = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    return { href, rel }
  }).filter((item) => /^https?:\/\//i.test(item.href))
  const alternate = hrefs.find((item) => /alternate/i.test(item.rel))
  if (alternate) return alternate.href
  if (hrefs[0]) return hrefs[0].href
  const id = tagText(block, ['id'])
  if (/^https?:\/\//i.test(id)) return id
  return ''
}

/** Parse RSS 2.0 or Atom into {title, url, date, snippet}. */
export function parseFeed(xml) {
  const source = String(xml || '')
  const chunks = [...source.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2])
  const items = []
  for (const block of chunks) {
    const title = tagText(block, ['title'])
    let url = linkFrom(block)
    if (/^http:\/\/arxiv\.org\//i.test(url)) url = url.replace(/^http:/i, 'https:')
    const date = tagText(block, ['pubDate', 'published', 'updated', 'dc:date', 'date'])
    const snippet = tagText(block, ['description', 'summary', 'content', 'content:encoded'])
    if (!title || !/^https?:\/\//i.test(url)) continue
    items.push({ title, url, date, snippet })
  }
  return items
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key)) parsed.searchParams.delete(key)
    }
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/$/, '')
    return parsed.href
  } catch {
    return ''
  }
}
