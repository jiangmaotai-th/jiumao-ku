import { LOCALES, type Locale } from './types'

/** URL path slugs (lowercase) ↔ internal Locale ids */
export const LOCALE_TO_SLUG: Record<Locale, string> = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  hi: 'hi',
  th: 'th',
  ru: 'ru',
  pt: 'pt',
}

export const SLUG_TO_LOCALE: Record<string, Locale> = Object.fromEntries(
  (LOCALES as readonly Locale[]).map((locale) => [LOCALE_TO_SLUG[locale], locale]),
) as Record<string, Locale>

export const LOCALE_SLUGS = LOCALES.map((locale) => LOCALE_TO_SLUG[locale])

export const DEFAULT_LOCALE: Locale = 'zh-CN'
export const DEFAULT_LOCALE_SLUG = LOCALE_TO_SLUG[DEFAULT_LOCALE]

/** Paths that must never get a language prefix. */
const PASSTHROUGH_PREFIXES = [
  '/assets/',
  '/api/',
  '/downloads/',
  '/ffmpeg/',
  '/admin/',
  '/favicon',
  '/pdf.worker',
  '/robots.txt',
  '/sitemap',
  '/google',
  '/baidu_verify',
]

export function localeToSlug(locale: Locale): string {
  return LOCALE_TO_SLUG[locale]
}

export function slugToLocale(slug: string): Locale | null {
  return SLUG_TO_LOCALE[slug.toLowerCase()] ?? null
}

export function isLocaleSlug(value: string | undefined | null): boolean {
  return !!value && value.toLowerCase() in SLUG_TO_LOCALE
}

/** First path segment if it is a locale slug. */
export function parseLocaleFromPathname(pathname = typeof location !== 'undefined' ? location.pathname : '/'): Locale | null {
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment ? slugToLocale(segment) : null
}

/** Strip leading /{locale} from pathname; returns path starting with /. */
export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  if (!isLocaleSlug(parts[0])) {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
    return normalized || '/'
  }
  const rest = parts.slice(1)
  if (rest.length === 0) return '/'
  const joined = `/${rest.join('/')}`
  const hadTrailing = pathname.endsWith('/')
  return hadTrailing && !joined.endsWith('/') ? `${joined}/` : joined
}

function normalizeAppPath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function splitPathQueryHash(path: string): { pathname: string; search: string; hash: string } {
  const hashIdx = path.indexOf('#')
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : ''
  const withoutHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path
  const qIdx = withoutHash.indexOf('?')
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : ''
  const pathname = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash
  return { pathname, search, hash }
}

function looksLikeFile(pathname: string): boolean {
  const last = pathname.split('/').filter(Boolean).pop() || ''
  return /\.[a-z0-9]{2,8}$/i.test(last)
}

export function shouldLocalizePath(path: string): boolean {
  if (!path || /^(https?:|mailto:|tel:)/i.test(path)) return false
  if (path.startsWith('#')) return false
  const { pathname } = splitPathQueryHash(normalizeAppPath(path))
  return !PASSTHROUGH_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  )
}

/**
 * Prefix an internal site path with the locale slug.
 * `/image/` + en → `/en/image/`
 * `/` + ja → `/ja/`
 * External / assets / downloads left unchanged.
 */
export function withLocale(path: string, locale: Locale): string {
  if (!shouldLocalizePath(path)) return path
  const { pathname, search, hash } = splitPathQueryHash(normalizeAppPath(path))
  let stripped = stripLocalePrefix(pathname)
  const slug = localeToSlug(locale)

  if (stripped !== '/' && !stripped.endsWith('/') && !looksLikeFile(stripped)) {
    stripped = `${stripped}/`
  }

  if (stripped === '/') {
    return `/${slug}/${search}${hash}`
  }
  return `/${slug}${stripped}${search}${hash}`
}

/** Convenience: localize using current page locale (or provided). */
export function localizedHref(path: string, locale?: Locale): string {
  const loc =
    locale ??
    parseLocaleFromPathname(typeof location !== 'undefined' ? location.pathname : '/') ??
    DEFAULT_LOCALE
  return withLocale(path, loc)
}

/**
 * Rebuild current URL under a different locale, preserving stripped path + query + hash.
 */
export function urlForLocale(locale: Locale, currentPathname?: string, search?: string, hash?: string): string {
  const pathname = currentPathname ?? (typeof location !== 'undefined' ? location.pathname : '/')
  const q = search ?? (typeof location !== 'undefined' ? location.search : '')
  const h = hash ?? (typeof location !== 'undefined' ? location.hash : '')
  const stripped = stripLocalePrefix(pathname)
  return withLocale(`${stripped}${q}${h}`, locale)
}

/** Public pages that get locale HTML shells (no admin). */
export const LOCALIZED_APP_PATHS = [
  '/',
  '/moyee/',
  '/ebook/',
  '/image/',
  '/store/',
  '/switch/',
  '/legal/',
  '/markdown/',
  '/platform-crop/',
  '/video-mute/',
  '/scratch/',
  '/tank/',
  '/goose/',
] as const
