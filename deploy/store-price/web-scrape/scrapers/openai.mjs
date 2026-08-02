import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://openai.com/chatgpt/pricing'

export async function scrapeOpenAI() {
  const html = await fetchText(URL)
  const text = htmlToText(html)
  const amounts = new Set(findUsdAmounts(text).map((x) => x.amount))

  const has20 = [...amounts].some((a) => Math.abs(a - 20) < 0.02)
  if (!has20 && !pageHas(text, 'ChatGPT Plus')) {
    throw new Error('openai_pricing_unrecognized')
  }

  const has5 = [...amounts].some((a) => Math.abs(a - 5) < 0.02)
  const has200 = [...amounts].some((a) => Math.abs(a - 200) < 0.02)

  const plans = {
    plus_monthly: planBase(20, 'USD', '$20.00'),
  }
  if (has5 || pageHas(text, 'Go')) {
    plans.go_monthly = planBase(5, 'USD', '$5.00')
  }
  if (has200 || pageHas(text, 'Pro')) {
    plans.pro_monthly = planBase(200, 'USD', '$200.00')
  }

  return {
    productIds: ['chatgpt'],
    source: 'scrape:openai-pricing',
    url: URL,
    plans,
  }
}
