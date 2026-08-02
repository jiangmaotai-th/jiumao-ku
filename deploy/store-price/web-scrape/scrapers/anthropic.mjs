import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://www.anthropic.com/pricing'

export async function scrapeAnthropic() {
  let html
  try {
    html = await fetchText(URL)
  } catch {
    html = await fetchText('https://claude.ai/pricing')
  }
  const text = htmlToText(html)
  const amounts = new Set(findUsdAmounts(text).map((x) => x.amount))
  const has20 = [...amounts].some((a) => Math.abs(a - 20) < 0.02)

  if (!has20 && !pageHas(text, 'Pro')) {
    throw new Error('anthropic_pricing_unrecognized')
  }

  return {
    productIds: ['claude'],
    source: 'scrape:anthropic-pricing',
    url: URL,
    plans: {
      pro_monthly: {
        ...planBase(20, 'USD', '$20.00'),
        locals: {
          in: {
            amount: 1999,
            currency: 'INR',
            priceFormatted: '₹1,999',
            tag: 'premium',
            since: '2026-07-14',
            note: '印度网页卢比本地价，含税后通常≥美区',
          },
        },
      },
      max_monthly: planBase(100, 'USD', '$100.00'),
      max_20x_monthly: planBase(200, 'USD', '$200.00'),
    },
  }
}
