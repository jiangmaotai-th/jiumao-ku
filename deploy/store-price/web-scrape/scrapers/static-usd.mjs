import { planBase } from '../parse.mjs'

/**
 * Well-known public USD list prices (verified periodically by page fetch when URL works).
 * Used when marketing pages are JS-only; amounts are industry-standard published prices.
 */
export function staticUsdProduct(productId, planId, amount, url, label) {
  return {
    productIds: [productId],
    source: 'scrape:static-usd',
    url,
    plans: {
      [planId]: planBase(
        amount,
        'USD',
        `$${Number(amount).toFixed(2)}`,
        label || '全球统一标价（公开定价）',
      ),
    },
  }
}
