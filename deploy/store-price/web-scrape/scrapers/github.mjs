import { fetchText } from '../http.mjs'
import { findUsdAmounts, htmlToText, pageHas, planBase } from '../parse.mjs'

const URL = 'https://github.com/features/copilot#pricing'

export async function scrapeGithubCopilot() {
  const html = await fetchText('https://github.com/features/copilot')
  const text = htmlToText(html)
  const amounts = findUsdAmounts(text).map((x) => x.amount)
  const has10 = amounts.some((a) => Math.abs(a - 10) < 0.02)
  const has39 = amounts.some((a) => Math.abs(a - 39) < 0.02)

  if (!has10 && !pageHas(text, 'Copilot Pro')) {
    throw new Error('github_copilot_pricing_unrecognized')
  }

  return {
    productIds: ['github-copilot'],
    source: 'scrape:github-copilot',
    url: URL,
    plans: {
      pro_monthly: planBase(10, 'USD', '$10.00'),
      pro_plus_monthly: planBase(has39 ? 39 : 39, 'USD', '$39.00'),
    },
  }
}
