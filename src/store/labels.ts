import type { ChannelAdvice } from './api'

type T = (key: string, vars?: Record<string, string | number>) => string

const CATEGORY_KEYS: Record<string, string> = {
  chat: 'store.catChat',
  coding: 'store.catCoding',
  image: 'store.catImage',
  video: 'store.catVideo',
  audio: 'store.catAudio',
  writing: 'store.catWriting',
  research: 'store.catResearch',
  design: 'store.catDesign',
  edu: 'store.catEdu',
  health: 'store.catHealth',
  hardware: 'store.catHardware',
}

const BILLING_KEYS: Record<string, string> = {
  month: 'store.billMonth',
  monthly: 'store.billMonth',
  year: 'store.billYear',
  yearly: 'store.billYear',
  annual: 'store.billYear',
  week: 'store.billWeek',
  weekly: 'store.billWeek',
  quarter: 'store.billQuarter',
  quarterly: 'store.billQuarter',
}

/** True when text is predominantly CJK (API sheet/advice leftovers). */
export function looksCjk(text: string | null | undefined): boolean {
  if (!text) return false
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g)
  if (!cjk) return false
  const letters = text.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g)
  const letterCount = letters?.length || 0
  return cjk.length >= 2 && cjk.length >= letterCount * 0.25
}

export function categoryLabel(id: string | null | undefined, t: T, fallback?: string | null): string {
  if (!id) return fallback || ''
  const key = CATEGORY_KEYS[id]
  if (key) return t(key)
  return fallback || id
}

export function billingPeriodLabel(
  period: string | null | undefined,
  t: T,
  fallback?: string | null,
): string {
  if (!period) return fallback && !looksCjk(fallback) ? fallback : ''
  const key = BILLING_KEYS[period.toLowerCase()]
  if (key) return t(key)
  return fallback && !looksCjk(fallback) ? fallback : t('store.billOther')
}

export function localizeApiText(
  text: string | null | undefined,
  locale: string,
): string | null {
  if (!text) return null
  if (locale === 'zh-CN' || locale === 'zh-TW') return text
  if (looksCjk(text)) return null
  return text
}

export function formatChannelAdvice(
  advice: ChannelAdvice | null | undefined,
  t: T,
  money: (cny?: number | null) => string,
  region: (code?: string | null, fallback?: string | null) => string,
): string | null {
  if (!advice) return null
  const asBest = advice.appstoreBest
  const webBase = advice.webBase
  const parts: string[] = []

  if (asBest && webBase) {
    const save =
      webBase.cny > 0 ? Math.round((1 - asBest.cny / webBase.cny) * 100) : 0
    const vars = {
      appPrice: money(asBest.cny),
      webPrice: money(webBase.cny),
      flag: asBest.flag || '',
      region: region(asBest.country, asBest.regionName),
      save: String(Math.max(0, save)),
      listPrice: webBase.priceFormatted || '',
    }
    if (asBest.cny < webBase.cny * 0.8) {
      parts.push(t('store.advicePreferAppStore', vars))
    } else {
      parts.push(t('store.adviceSimilar', vars))
    }
  } else if (asBest) {
    parts.push(
      t('store.adviceAppStoreOnly', {
        appPrice: money(asBest.cny),
        flag: asBest.flag || '',
        region: region(asBest.country, asBest.regionName),
      }),
    )
  } else if (webBase) {
    parts.push(
      t('store.adviceWebOnly', {
        webPrice: money(webBase.cny),
        listPrice: webBase.priceFormatted || money(webBase.cny),
      }),
    )
  }

  for (const a of (advice.webPremiums || []).slice(0, 2)) {
    parts.push(
      t('store.adviceWebPremium', {
        flag: a.flag || '',
        region: region(a.country, a.regionName),
        listPrice: a.priceFormatted,
        equiv: money(a.cny),
      }),
    )
  }

  return parts.length ? parts.join(' ') : null
}
