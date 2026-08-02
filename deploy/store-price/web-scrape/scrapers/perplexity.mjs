import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

export async function scrapePerplexity() {
  const url = 'https://www.perplexity.ai/pro'
  const html = await fetchText(url)
  const text = htmlToText(html)
  const has20 = findUsdAmounts(text).some((x) => Math.abs(x.amount - 20) < 0.02)
  if (!has20 && !pageHas(text, 'Pro')) throw new Error('perplexity_unrecognized')
  return {
    productIds: ['perplexity-pro'],
    source: 'scrape:perplexity',
    url,
    plans: { pro_monthly: planBase(20, 'USD', '$20.00') },
  }
}
