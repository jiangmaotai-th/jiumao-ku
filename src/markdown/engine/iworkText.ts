import JSZip from 'jszip'
import SnappyJS from 'snappyjs'
import { t } from '../../i18n'

/** Decompress an .iwa Snappy chunk stream (type 0 + 24-bit LE length). */
export function decompressIwa(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  let o = 0
  while (o + 4 <= raw.length) {
    const type = raw[o]
    const len = raw[o + 1] | (raw[o + 2] << 8) | (raw[o + 3] << 16)
    o += 4
    if (len < 0 || o + len > raw.length) break
    const chunk = raw.subarray(o, o + len)
    o += len
    if (type === 0) {
      try {
        const dec = SnappyJS.uncompress(chunk)
        parts.push(dec instanceof Uint8Array ? dec : new Uint8Array(dec as ArrayBuffer))
      } catch {
        // skip bad chunk
      }
    } else if (type === 1) {
      parts.push(chunk)
    }
  }
  const total = parts.reduce((n, a) => n + a.length, 0)
  const merged = new Uint8Array(total)
  let p = 0
  for (const a of parts) {
    merged.set(a, p)
    p += a.length
  }
  return merged
}

function readVarint(buf: Uint8Array, i: number): [number, number] {
  let x = 0
  let s = 0
  while (i < buf.length) {
    const b = buf[i++]
    x |= (b & 0x7f) << s
    if ((b & 0x80) === 0) break
    s += 7
    if (s > 35) break
  }
  return [x >>> 0, i]
}

function controlRatio(s: string): number {
  if (!s.length) return 1
  let ctrl = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c < 9 || (c > 13 && c < 32)) ctrl++
  }
  return ctrl / s.length
}

function looksLikeCleanText(s: string): boolean {
  if (s.length < 1) return false
  if (controlRatio(s) > 0.05) return false
  return /[\u4e00-\u9fff\u3040-\u30ffA-Za-z0-9]/.test(s)
}

/**
 * Walk protobuf wire and collect UTF-8 strings.
 * Recurses into nested length-delimited messages (needed for Numbers DataList cells).
 */
export function extractProtobufStrings(buf: Uint8Array, depth = 0): string[] {
  if (depth > 8 || buf.length === 0) return []
  const strings: string[] = []
  let i = 0
  const decoder = new TextDecoder('utf-8', { fatal: true })
  while (i < buf.length) {
    try {
      const start = i
      const [tag, ni] = readVarint(buf, i)
      if (ni === i) {
        i++
        continue
      }
      i = ni
      const wt = tag & 7
      const fn = tag >>> 3
      if (fn === 0 || fn > 5000) {
        i = start + 1
        continue
      }
      if (wt === 0) {
        ;[, i] = readVarint(buf, i)
      } else if (wt === 1) {
        i += 8
      } else if (wt === 5) {
        i += 4
      } else if (wt === 2) {
        const [len, nj] = readVarint(buf, i)
        i = nj
        if (len < 0 || i + len > buf.length || len > 2_000_000) {
          i = start + 1
          continue
        }
        const slice = buf.subarray(i, i + len)
        i += len

        let decoded: string | null = null
        try {
          decoded = decoder.decode(slice)
        } catch {
          decoded = null
        }

        if (decoded && looksLikeCleanText(decoded)) {
          strings.push(decoded)
        } else if (len >= 2) {
          strings.push(...extractProtobufStrings(slice, depth + 1))
        }
      } else {
        i = start + 1
      }
    } catch {
      i++
    }
  }
  return strings
}

const META_OR_STYLE = new Set([
  'default',
  'blank',
  'line',
  'zh',
  'zh_cn',
  'zh_tw',
  'zh-hans',
  'zh-hant',
  'en',
  'en_us',
  'ja',
  'ja_jp',
  'iso-a4',
  'letter',
  'none',
  'normal',
  'body',
  'title',
  'heading',
  'decimal',
  'rr',
  'rwrr',
  'wrqrqr',
  'gregorian',
  'latn',
  'nan',
])

const LOCALE_NOISE = new Set([
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '上午',
  '下午',
  '日',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '第一季度',
  '第二季度',
  '第三季度',
  '第四季度',
  '1季度',
  '2季度',
  '3季度',
  '4季度',
  '公元前',
  '公元',
])

function isLocaleNoise(t: string): boolean {
  if (LOCALE_NOISE.has(t)) return true
  if (/^[A-Z]{3}$/.test(t)) return true
  if (/^(XAF|XCD|XCG|XOF|XPF|FCFA|CFPF|Cg\.)$/i.test(t)) return true
  if (/^y[/年]/.test(t)) return true
  if (/^Application\//i.test(t)) return true
  if (/^\d{1,2}$/.test(t)) return true
  if (/^\d+\.\d+$/.test(t)) return true
  return false
}

const KEYNOTE_PLACEHOLDER = new Set([
  '文本',
  '标题',
  '副标题',
  'transition',
  'none',
  'statement',
  'presentation subtitle',
  'slide subtitle',
  '正文级别 1',
  '正文级别 2',
  '正文级别 3',
  '正文级别 4',
  '正文级别 5',
  '幻灯片项目符号文本',
])

function isDocumentText(s: string, kind: 'cell' | 'body' | 'sheet' | 'slide'): boolean {
  const t = s.replace(/\u2028|\u2029/g, '\n').trim()
  if (!t) return false
  if (META_OR_STYLE.has(t.toLowerCase())) return false
  if (KEYNOTE_PLACEHOLDER.has(t.toLowerCase()) || KEYNOTE_PLACEHOLDER.has(t)) return false
  if (isLocaleNoise(t)) return false
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(t)) return false
  if (/^[A-Z][A-Za-z0-9]+(Segment|Identifier|Archive|Storage|Bucket)/.test(t)) return false
  if (/^[A-Za-z]+\/[A-Za-z_]+$/.test(t) && t.length < 40) return false
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return false
  if (controlRatio(t) > 0.08) return false
  // Theme layout / accessibility blurbs
  if (/背景下的?.{0,12}水母/.test(t)) return false
  if (/^标题[、与]/.test(t) && t.length <= 40) return false
  if (/^照片\s*-/.test(t)) return false
  if (/^正文级别\s*\d/.test(t)) return false
  if (t.includes('正文级别 1') && t.includes('正文级别 5')) return false

  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  const kana = (t.match(/[\u3040-\u30ff]/g) ?? []).length

  if (kind === 'sheet') {
    return /^工作表\s*\d+$/i.test(t) || /^Sheet\s*\d+$/i.test(t)
  }
  if (kind === 'cell' || kind === 'slide') {
    if (cjk >= 1 && t.length <= 500) return true
    if (kana >= 1 && t.length <= 500) return true
    if (/^\d{1,12}$/.test(t)) return true
    if (/^[A-Za-z][A-Za-z0-9 ._%/-]{1,80}$/.test(t) && t.length >= 2) return true
    // Real slide lorem / paragraphs
    if (kind === 'slide' && t.length >= 20 && /[A-Za-z]{3,}/.test(t)) return true
    return false
  }
  // body (Pages prose)
  if (t.length < 8) return false
  if (cjk >= 4) return true
  if (t.length >= 24 && /[A-Za-z]{3,}/.test(t) && /\s/.test(t)) return true
  if (t.length >= 12 && kana >= 2) return true
  return false
}

/** Real Keynote slides only — TemplateSlide_* are theme masters with placeholders. */
function isRealKeynoteSlide(name: string): boolean {
  return /(^|\/)Slide(\.iwa|-\d+)/i.test(name) && !/TemplateSlide/i.test(name)
}

/**
 * Extract readable body text from modern iWork packages (.pages/.numbers/.key).
 */
export async function extractIworkDocumentText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir && /\.iwa$/i.test(n))
    .filter((n) => !/TemplateSlide/i.test(n))
    .sort((a, b) => {
      const rank = (n: string) => {
        if (/Tables\/DataList/i.test(n)) return 0
        if (isRealKeynoteSlide(n)) return 1
        if (/Document\.iwa$/i.test(n)) return 2
        if (/Sheet|Table|Header|Footer|Section/i.test(n)) return 3
        if (/Stylesheet|Theme|Metadata|ViewState|Calculation/i.test(n)) return 9
        return 5
      }
      return rank(a) - rank(b) || a.localeCompare(b)
    })

  const sheetNames: string[] = []
  const cells: string[] = []
  const slides: string[] = []
  const body: string[] = []
  const seen = new Set<string>()

  for (const name of names) {
    if (/Stylesheet|Theme|ViewState|CalculationEngine|AnnotationAuthor|Metadata\.iwa/i.test(name)) {
      continue
    }
    const raw = await zip.file(name)!.async('uint8array')
    const dec = decompressIwa(raw)
    if (!dec.length) continue

    const fromDataList = /Tables\/DataList/i.test(name)
    const fromDocument = /Document\.iwa$/i.test(name)
    const fromSlide = isRealKeynoteSlide(name)
    const slideBits: string[] = []

    for (const s of extractProtobufStrings(dec)) {
      const norm = s.replace(/\u2028|\u2029/g, '\n').replace(/\r\n/g, '\n').trim()
      if (!norm) continue

      if (/^工作表\s*\d+$/i.test(norm) || /^Sheet\s*\d+$/i.test(norm)) {
        if (!isDocumentText(norm, 'sheet') || seen.has(norm)) continue
        seen.add(norm)
        sheetNames.push(norm)
        continue
      }

      if (fromDataList) {
        if (!isDocumentText(norm, 'cell') || seen.has(norm)) continue
        seen.add(norm)
        cells.push(norm)
        continue
      }

      if (fromSlide) {
        if (!isDocumentText(norm, 'slide')) continue
        if (!slideBits.includes(norm)) slideBits.push(norm)
        continue
      }

      if (fromDocument || /Section|Header|Footer/i.test(name)) {
        if (!isDocumentText(norm, 'body') || seen.has(norm)) continue
        seen.add(norm)
        body.push(norm)
      }
    }

    if (fromSlide && slideBits.length) {
      slides.push(slideBits.join('\n'))
    }
  }

  const parts: string[] = []
  if (sheetNames.length) parts.push(sheetNames.join(' · '))
  if (cells.length) parts.push(cells.join('\n'))
  if (slides.length) {
    parts.push(
      slides.map((s, i) => `## ${t('markdown.slideLabel', { n: i + 1 })}\n\n${s}`).join('\n\n'),
    )
  }
  if (body.length) {
    const kept = body.filter((s, idx) => {
      if (s.length >= 40) return true
      return !body.some((other, j) => j !== idx && other.length > s.length && other.includes(s))
    })
    parts.push(kept.join('\n\n'))
  }

  return parts
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
