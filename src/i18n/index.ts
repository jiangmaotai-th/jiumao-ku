import { messages } from './locales'
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  type Locale,
  type Messages,
} from './types'
import {
  DEFAULT_LOCALE,
  localizedHref,
  parseLocaleFromPathname,
  urlForLocale,
} from './path'

export { LOCALES, LOCALE_NATIVE_NAMES, type Locale, type Messages }
export { messages }
export {
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_SLUG,
  LOCALE_SLUGS,
  LOCALE_TO_SLUG,
  LOCALIZED_APP_PATHS,
  SLUG_TO_LOCALE,
  isLocaleSlug,
  localeToSlug,
  localizedHref,
  parseLocaleFromPathname,
  shouldLocalizePath,
  slugToLocale,
  stripLocalePrefix,
  urlForLocale,
  withLocale,
} from './path'

export const LANG_STORAGE_KEY = 'mw_lang'

type Listener = (locale: Locale) => void

const listeners = new Set<Listener>()

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}

function detectFromNavigator(): Locale {
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
  return DEFAULT_LOCALE
}

/**
 * Locale detection: URL prefix > localStorage > navigator > zh-CN.
 */
export function detectLocale(): Locale {
  if (typeof location !== 'undefined') {
    const fromUrl = parseLocaleFromPathname(location.pathname)
    if (fromUrl) return fromUrl
  }

  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* ignore */
  }

  return detectFromNavigator()
}

let currentLocale: Locale = DEFAULT_LOCALE

export function getLocale(): Locale {
  return currentLocale
}

export function initLocale(preferred?: Locale): Locale {
  currentLocale = preferred && isLocale(preferred) ? preferred : detectLocale()
  try {
    localStorage.setItem(LANG_STORAGE_KEY, currentLocale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLocale
  }
  return currentLocale
}

/**
 * Persist locale and navigate to the equivalent path under the new language prefix.
 * Pass `{ navigate: false }` to update in place without changing the URL (rare).
 */
export function setLocale(
  locale: Locale,
  options?: { reload?: boolean; navigate?: boolean },
): void {
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
  // snapshot: listeners may (un)subscribe while being notified
  ;[...listeners].forEach((fn) => fn(locale))

  const shouldNavigate = options?.navigate !== false
  if (shouldNavigate && typeof location !== 'undefined') {
    const next = urlForLocale(locale)
    const current = `${location.pathname}${location.search}${location.hash}`
    if (next !== current) {
      location.assign(next)
      return
    }
  }

  if (options?.reload && typeof location !== 'undefined') {
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

  // Rewrite internal links that should carry the locale prefix.
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((el) => {
    const href = el.getAttribute('href')
    if (!href || el.dataset.i18nSkipLocale === 'true') return
    const next = localizedHref(href)
    if (next !== href) el.setAttribute('href', next)
  })
}
