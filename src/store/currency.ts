import type { Locale } from '../i18n/types'

/** Display currency for each UI language (language → that market’s money). */
export const LOCALE_CURRENCY: Record<Locale, string> = {
  'zh-CN': 'CNY',
  'zh-TW': 'TWD',
  en: 'USD',
  ja: 'JPY',
  ko: 'KRW',
  fr: 'EUR',
  de: 'EUR',
  es: 'EUR',
  hi: 'INR',
  th: 'THB',
  ru: 'RUB',
  pt: 'BRL',
}

export type FxRates = {
  updatedAt?: string
  base: string
  rates: Record<string, number>
}

/** FX doc: rates[C] = how many CNY for 1 unit of C. */
export function fromCny(
  cny: number,
  displayCurrency: string,
  rates: Record<string, number>,
): number | null {
  if (!Number.isFinite(cny)) return null
  if (displayCurrency === 'CNY') return cny
  const r = rates[displayCurrency]
  if (!r || r <= 0) return null
  return cny / r
}

export function formatMoney(
  cny: number | null | undefined,
  locale: Locale,
  rates: Record<string, number> | null | undefined,
): string {
  if (cny == null || Number.isNaN(cny)) return '—'
  const currency = LOCALE_CURRENCY[locale] || 'USD'
  const amount =
    rates && Object.keys(rates).length
      ? fromCny(cny, currency, rates)
      : currency === 'CNY'
        ? cny
        : null
  if (amount == null) {
    // Fallback while FX loading: show CNY with code
    return `¥${cny.toFixed(2)}`
  }
  try {
    const zeroDecimal = ['JPY', 'KRW'].includes(currency)
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
      minimumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function regionDisplayName(
  code: string | null | undefined,
  locale: Locale,
  fallback?: string | null,
): string {
  if (!code) return fallback || ''
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase())
    return name || fallback || code.toUpperCase()
  } catch {
    return fallback || code.toUpperCase()
  }
}
