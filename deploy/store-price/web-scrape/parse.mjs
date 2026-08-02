/** Strip tags for coarse text matching. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find USD monthly-ish prices in page text.
 * @returns {{ amount: number, raw: string }[]}
 */
export function findUsdAmounts(text) {
  const out = []
  const re = /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g
  let m
  while ((m = re.exec(text))) {
    const amount = Number(m[1])
    if (amount > 0 && amount < 10000) out.push({ amount, raw: m[0] })
  }
  return out
}

/** Find CNY prices like ¥49 / ￥49 / 49元 */
export function findCnyAmounts(text) {
  const out = []
  const re = /(?:¥|￥)\s*([0-9]+(?:\.[0-9]{1,2})?)|([0-9]+(?:\.[0-9]{1,2})?)\s*元/g
  let m
  while ((m = re.exec(text))) {
    const amount = Number(m[1] || m[2])
    if (amount > 0 && amount < 100000) out.push({ amount, raw: m[0] })
  }
  return out
}

/** Find EUR prices like €14.99 */
export function findEurAmounts(text) {
  const out = []
  const re = /€\s*([0-9]+(?:\.[0-9]{1,2})?)/g
  let m
  while ((m = re.exec(text))) {
    const amount = Number(m[1])
    if (amount > 0 && amount < 10000) out.push({ amount, raw: m[0] })
  }
  return out
}

export function amountsForCurrency(text, currency) {
  const cur = String(currency || '').toUpperCase()
  if (cur === 'CNY') return findCnyAmounts(text)
  if (cur === 'EUR') return findEurAmounts(text)
  return findUsdAmounts(text)
}

export function planBase(amount, currency, priceFormatted, label) {
  const base = {
    amount,
    currency,
    priceFormatted:
      priceFormatted ||
      (currency === 'CNY'
        ? `¥${amount}`
        : currency === 'EUR'
          ? `€${Number(amount).toFixed(2)}`
          : `$${Number(amount).toFixed(2)}`),
  }
  if (label) base.label = label
  return { base, locals: {} }
}

/** True if page mentions needle (case-insensitive). */
export function pageHas(text, needle) {
  return String(text).toLowerCase().includes(String(needle).toLowerCase())
}
