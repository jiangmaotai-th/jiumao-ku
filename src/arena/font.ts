import { getLocale } from '../i18n'

/**
 * Self-hosted subsets: Fusion Pixel Font 12px (Latin/CJK/kana/Hangul/Cyrillic) and,
 * for Thai / Hindi whose scripts the pixel font lacks, Noto Sans Thai / Devanagari Bold
 * (both SIL OFL 1.1) under one family via unicode-range.
 */
export async function loadArenaFont(): Promise<void> {
  const jobs: Promise<unknown>[] = []
  const add = (family: string, url: string, range?: string) => {
    const face = new FontFace(family, `url('${url}') format('woff2')`, range ? { unicodeRange: range, weight: '100 900' } : {})
    jobs.push(face.load().then((f) => document.fonts.add(f)).catch(() => undefined))
  }
  add('ArenaPixel', '/fonts/arena-pixel.woff2')
  const loc = getLocale()
  if (loc === 'th') add('ArenaFallback', '/fonts/arena-fallback-th.woff2', 'U+0E00-0E7F, U+200C-200D, U+25CC')
  if (loc === 'hi') add('ArenaFallback', '/fonts/arena-fallback-hi.woff2', 'U+0900-097F, U+200C-200D, U+25CC')
  await Promise.all(jobs)
}
