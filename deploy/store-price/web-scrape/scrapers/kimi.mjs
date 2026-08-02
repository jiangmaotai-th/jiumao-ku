import { fetchText } from '../http.mjs'
import { findCnyAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://www.kimi.com/zh-cn/help/membership/membership-pricing'

/**
 * Official help page lists monthly list prices.
 * Yearly promo rates (折合月价) kept as known-good when page omits them.
 */
export async function scrapeKimi() {
  const html = await fetchText(URL)
  const text = htmlToText(html)
  if (!pageHas(text, 'Andante') || !pageHas(text, 'Moderato')) {
    throw new Error('kimi_page_missing_plan_names')
  }

  // Expect list prices 49 / 99 / 199 / 699 for monthly tiers
  const need = [49, 99, 199, 699]
  const found = new Set(findCnyAmounts(text).map((x) => x.amount))
  for (const n of need) {
    if (![...found].some((a) => Math.abs(a - n) < 0.02)) {
      throw new Error(`kimi_missing_monthly_${n}`)
    }
  }

  // Yearly effective monthly (from official checkout UI; help page may omit)
  const yearlyMonthly = { andante: 39, moderato: 79, allegretto: 159, allegro: 559 }
  const yearlyTotal = { andante: 468, moderato: 948, allegretto: 1908, allegro: 6708 }

  return {
    productIds: ['kimi'],
    source: 'scrape:kimi-help',
    url: URL,
    plans: {
      andante_monthly: planBase(49, 'CNY', '¥49/月'),
      andante_yearly: planBase(
        yearlyMonthly.andante,
        'CNY',
        `¥${yearlyMonthly.andante}/月`,
        `连续包年折合月价（年付 ¥${yearlyTotal.andante}）`,
      ),
      moderato_monthly: planBase(99, 'CNY', '¥99/月'),
      moderato_yearly: planBase(
        yearlyMonthly.moderato,
        'CNY',
        `¥${yearlyMonthly.moderato}/月`,
        `连续包年折合月价（年付 ¥${yearlyTotal.moderato}）`,
      ),
      allegretto_monthly: planBase(199, 'CNY', '¥199/月'),
      allegretto_yearly: planBase(
        yearlyMonthly.allegretto,
        'CNY',
        `¥${yearlyMonthly.allegretto}/月`,
        `连续包年折合月价（年付 ¥${yearlyTotal.allegretto.toLocaleString('en-US')}）`,
      ),
      allegro_monthly: planBase(699, 'CNY', '¥699/月'),
      allegro_yearly: planBase(
        yearlyMonthly.allegro,
        'CNY',
        `¥${yearlyMonthly.allegro}/月`,
        `连续包年折合月价（年付 ¥${yearlyTotal.allegro.toLocaleString('en-US')}）`,
      ),
    },
  }
}
