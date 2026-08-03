import { messages } from './locales'
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  type Locale,
  type Messages,
} from './types'

export { LOCALES, LOCALE_NATIVE_NAMES, type Locale, type Messages }
export { messages }

export const LANG_STORAGE_KEY = 'mw_lang'

type Listener = (locale: Locale) => void

const listeners = new Set<Listener>()

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}

/**
 * Auto locale from the visitor’s browser language (navigator.languages), not IP.
 * Saved manual choice in localStorage wins. Unmatched languages fall back to English.
 */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* ignore */
  }

  const candidates = [
    ...(typeof navigator !== 'undefined' ? navigator.languages || [] : []),
    typeof navigator !== 'undefined' ? navigator.language : '',
  ].filter(Boolean)

  for (const raw of candidates) {
    const tag = raw.toLowerCase().replace('_', '-')
    if (tag.startsWith('zh')) {
      if (tag.includes('tw') || tag.includes('hk') || tag.includes('mo') || tag.includes('hant')) {
        return 'zh-TW'
      }
      return 'zh-CN'
    }
    if (tag.startsWith('ja')) return 'ja'
    if (tag.startsWith('ko')) return 'ko'
    if (tag.startsWith('fr')) return 'fr'
    if (tag.startsWith('de')) return 'de'
    if (tag.startsWith('es')) return 'es'
    if (tag.startsWith('hi')) return 'hi'
    if (tag.startsWith('th')) return 'th'
    if (tag.startsWith('ru')) return 'ru'
    if (tag.startsWith('pt')) return 'pt'
    if (tag.startsWith('en')) return 'en'
  }
  return 'en'
}

let currentLocale: Locale = 'en'

export function getLocale(): Locale {
  return currentLocale
}

export function initLocale(preferred?: Locale): Locale {
  currentLocale = preferred && isLocale(preferred) ? preferred : detectLocale()
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLocale
  }
  return currentLocale
}

export function setLocale(locale: Locale, options?: { reload?: boolean }): void {
  if (!isLocale(locale)) return
  currentLocale = locale
  try {
    localStorage.setItem(LANG_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
  listeners.forEach((fn) => fn(locale))
  if (options?.reload !== false && typeof location !== 'undefined') {
    location.reload()
  }
}

export function onLocaleChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function lookup(dict: Messages, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = dict
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Dot-path translator with {var} interpolation. Falls back to English, then key. */
export function t(path: string, vars?: Record<string, string | number>): string {
  const primary = lookup(messages[currentLocale], path)
  const fallback = lookup(messages.en, path)
  let text =
    typeof primary === 'string'
      ? primary
      : typeof fallback === 'string'
        ? fallback
        : path

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

export function tList(path: string): string[] {
  const primary = lookup(messages[currentLocale], path)
  const fallback = lookup(messages.en, path)
  if (Array.isArray(primary) && primary.every((x) => typeof x === 'string')) {
    return primary as string[]
  }
  if (Array.isArray(fallback) && fallback.every((x) => typeof x === 'string')) {
    return fallback as string[]
  }
  return []
}

export function applyDocumentMeta(): void {
  if (typeof document === 'undefined') return
  document.title = t('meta.title')
  const desc = document.querySelector('meta[name="description"]')
  if (desc) desc.setAttribute('content', t('meta.description'))
}

/** Fill elements marked with data-i18n="path" or data-i18n-aria / data-i18n-placeholder / data-i18n-title */
export function applyDomI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (!key) return
    el.textContent = t(key)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml
    if (!key) return
    el.innerHTML = t(key)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria
    if (!key) return
    el.setAttribute('aria-label', t(key))
  })
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder
    if (!key) return
    el.placeholder = t(key)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle
    if (!key) return
    el.title = t(key)
  })
}
