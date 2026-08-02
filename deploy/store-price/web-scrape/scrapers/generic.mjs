import { fetchText } from '../http.mjs'
import { amountsForCurrency, htmlToText } from '../parse.mjs'

function planEntries(curatedPlans) {
  return Object.entries(curatedPlans || {}).filter(
    ([k, v]) => !k.startsWith('_') && v?.base,
  )
}

/**
 * Confirm curated plan amounts still appear on the pricing page.
 * Does not invent new plan tiers.
 * On failure returns status stale/missing with keep:true (caller must not wipe).
 */
export async function scrapeGenericConfirm(productId, pricingUrl, curatedPlans) {
  const entries = planEntries(curatedPlans)
  if (!pricingUrl) {
    return {
      productIds: [productId],
      source: 'generic:no-url',
      status: entries.length ? 'stale' : 'missing',
      keep: true,
      plans: null,
      error: 'generic_missing_url',
    }
  }
  if (!entries.length) {
    return {
      productIds: [productId],
      source: 'generic:no-plans',
      status: 'missing',
      keep: true,
      plans: null,
      error: 'generic_missing_plans',
    }
  }

  let html
  try {
    html = await fetchText(pricingUrl)
  } catch (e) {
    return {
      productIds: [productId],
      source: 'generic:fetch-fail',
      url: pricingUrl,
      status: 'stale',
      keep: true,
      plans: null,
      error: String(e.message || e),
    }
  }

  const text = htmlToText(html)
  const plans = {}
  let matched = 0
  for (const [planId, planObj] of entries) {
    const base = planObj.base
    const amount = Number(base.amount)
    const found = amountsForCurrency(text, base.currency)
    const ok = found.some((a) => Math.abs(a.amount - amount) < 0.051)
    if (ok) {
      plans[planId] = {
        base: { ...base },
        locals: planObj.locals || {},
      }
      matched += 1
    }
  }

  if (!matched) {
    return {
      productIds: [productId],
      source: 'generic:no-match',
      url: pricingUrl,
      status: 'stale',
      keep: true,
      plans: null,
      partial: true,
      error: 'generic_no_amount_match',
    }
  }

  const partial = matched < entries.length
  return {
    productIds: [productId],
    source: 'scrape:generic-confirm',
    url: pricingUrl,
    status: partial ? 'confirmed' : 'confirmed',
    partial,
    plans,
    // Only write matched plans; merge layer keeps unmatched locals/old tiers
    keepUnmatched: true,
  }
}
