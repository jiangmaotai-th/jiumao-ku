import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://www.kimi.ai/help/membership/membership-pricing'

/**
 * Official help page (kimi.ai) lists USD monthly + annual effective monthly.
 * Andante CNY ladder retired; current ladder: Moderato / Allegretto / Allegro / Vivace.
 */
export async function scrapeKimi() {
  const html = await fetchText(URL)
  const text = htmlToText(html)
  for (const name of ['Moderato', 'Allegretto', 'Allegro', 'Vivace']) {
    if (!pageHas(text, name)) {
      throw new Error(`kimi_page_missing_plan_name_${name}`)
    }
  }

  // Monthly list prices on help page
  const needMonthly = [19, 39, 99, 199]
  const found = new Set(findUsdAmounts(text).map((x) => x.amount))
  for (const n of needMonthly) {
    if (![...found].some((a) => Math.abs(a - n) < 0.02)) {
      throw new Error(`kimi_missing_monthly_${n}`)
    }
  }

  // Annual effective monthly + annual totals from official table
  const yearlyMonthly = { moderato: 15, allegretto: 31, allegro: 79, vivace: 159 }
  const yearlyTotal = { moderato: 180, allegretto: 372, allegro: 948, vivace: 1908 }

  return {
    productIds: ['kimi'],
    source: 'scrape:kimi-help',
    url: URL,
    plans: {
      moderato_monthly: planBase(19, 'USD', '$19.00', 'Moderato 月付'),
      moderato_yearly: planBase(
        yearlyMonthly.moderato,
        'USD',
        `$${Number(yearlyMonthly.moderato).toFixed(2)}`,
        `Moderato 年付折合月价（年付 $${yearlyTotal.moderato}）`,
      ),
      allegretto_monthly: planBase(39, 'USD', '$39.00', 'Allegretto 月付'),
      allegretto_yearly: planBase(
        yearlyMonthly.allegretto,
        'USD',
        `$${Number(yearlyMonthly.allegretto).toFixed(2)}`,
        `Allegretto 年付折合月价（年付 $${yearlyTotal.allegretto}）`,
      ),
      allegro_monthly: planBase(99, 'USD', '$99.00', 'Allegro 月付'),
      allegro_yearly: planBase(
        yearlyMonthly.allegro,
        'USD',
        `$${Number(yearlyMonthly.allegro).toFixed(2)}`,
        `Allegro 年付折合月价（年付 $${yearlyTotal.allegro}）`,
      ),
      vivace_monthly: planBase(199, 'USD', '$199.00', 'Vivace 月付'),
      vivace_yearly: planBase(
        yearlyMonthly.vivace,
        'USD',
        `$${Number(yearlyMonthly.vivace).toFixed(2)}`,
        `Vivace 年付折合月价（年付 $${yearlyTotal.vivace.toLocaleString('en-US')}）`,
      ),
    },
  }
}
