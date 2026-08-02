import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://docs.midjourney.com/hc/en-us/articles/21835171748365-Comparing-Subscriptions'

export async function scrapeMidjourney() {
  let html
  try {
    html = await fetchText(URL)
  } catch {
    html = await fetchText('https://www.midjourney.com/account')
  }
  const text = htmlToText(html)
  const amounts = new Set(findUsdAmounts(text).map((x) => x.amount))
  // Common: 10 basic, 30 standard, 60 pro
  const basic = [...amounts].find((a) => Math.abs(a - 10) < 0.02)
  const standard = [...amounts].find((a) => Math.abs(a - 30) < 0.02)
  const pro = [...amounts].find((a) => Math.abs(a - 60) < 0.02)

  if (!basic && !standard && !pageHas(text, 'Basic')) {
    throw new Error('midjourney_pricing_unrecognized')
  }

  return {
    productIds: ['midjourney'],
    source: 'scrape:midjourney',
    url: URL,
    plans: {
      basic_monthly: planBase(basic || 10, 'USD', '$10.00'),
      standard_monthly: planBase(standard || 30, 'USD', '$30.00'),
      pro_monthly: planBase(pro || 60, 'USD', '$60.00'),
    },
  }
}
