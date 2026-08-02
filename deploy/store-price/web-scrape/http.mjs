const UA =
  'Mozilla/5.0 (compatible; maotaiworks-store/1.0; +https://maotaiworks.com/store/)'

/** @param {string} url */
export async function fetchText(url, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`http_${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}
