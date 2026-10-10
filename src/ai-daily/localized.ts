import { getLocale } from '../i18n'
import { DEFAULT_LOCALE, LOCALE_TO_SLUG } from '../i18n/path'

/**
 * Fetch an AI data file in the site's current language (same getLocale() the
 * rest of the site uses: URL prefix > saved choice > browser language).
 * `/x/latest.json` is the Simplified Chinese original; other languages live in
 * `/x/latest.<slug>.json` (e.g. latest.en.json, latest.zh-tw.json). When a
 * translation is missing, broken, or stale (its date/updatedAt/item count
 * differ from the Chinese original) we fall back to the Chinese original.
 */
export async function fetchLocalizedJson(
  latestPath: string,
  parse: (raw: unknown) => void,
): Promise<{ raw: unknown; translated: boolean }> {
  const locale = getLocale()
  const bust = `?t=${Date.now()}`
  const get = async (url: string): Promise<unknown> => {
    const response = await fetch(url + bust, { cache: 'no-store' })
    if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
    return response.json()
  }
  const zhPromise = get(latestPath)
  if (locale !== DEFAULT_LOCALE) {
    const url = latestPath.replace(/\.json$/, `.${LOCALE_TO_SLUG[locale]}.json`)
    try {
      const [raw, zh] = await Promise.all([get(url), zhPromise])
      parse(raw) // throws on a malformed translation
      if (sameIssue(raw, zh)) return { raw, translated: true }
    } catch {
      /* fall back to Chinese */
    }
  }
  return { raw: await zhPromise, translated: locale === DEFAULT_LOCALE }
}

type IssueShape = { date?: unknown; updatedAt?: unknown; items?: unknown }

function sameIssue(a: unknown, b: unknown): boolean {
  const x = a as IssueShape
  const y = b as IssueShape
  return (
    x.date === y.date &&
    x.updatedAt === y.updatedAt &&
    Array.isArray(x.items) &&
    Array.isArray(y.items) &&
    x.items.length === y.items.length
  )
}
