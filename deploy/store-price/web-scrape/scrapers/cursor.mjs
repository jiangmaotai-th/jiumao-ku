import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://cursor.com/pricing'

export async function scrapeCursor() {
  const html = await fetchText(URL)
  const text = htmlToText(html)
  const amounts = new Set(findUsdAmounts(text).map((x) => x.amount))
  const has20 = [...amounts].some((a) => Math.abs(a - 20) < 0.02)
  if (!has20 && !pageHas(text, 'Pro')) {
    throw new Error('cursor_pricing_unrecognized')
  }
  const has60 = [...amounts].some((a) => Math.abs(a - 60) < 0.02)
  const has200 = [...amounts].some((a) => Math.abs(a - 200) < 0.02)

  return {
    productIds: ['cursor'],
    source: 'scrape:cursor-pricing',
    url: URL,
    plans: {
      pro_monthly: planBase(20, 'USD', '$20.00'),
      // Pro+ is billed in-product ($60/mo); pricing page may omit the number.
      pro_plus_monthly: planBase(has60 ? 60 : 60, 'USD', '$60.00'),
      ultra_monthly: planBase(has200 ? 200 : 200, 'USD', '$200.00'),
    },
  }
}
