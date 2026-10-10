import JSZip from 'jszip'
import mammoth from 'mammoth'
import { extractPreviewPdf } from 'iwork-preview'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extensionOf, isImage, isMedia, isSupported } from '../formats'
import { extractIworkDocumentText } from './iworkText'
import { t } from '../../i18n'
import { ocrImageToText } from './ocr'

/** Stable public worker (avoids Vite-bundled worker / wrong .mjs MIME issues). */
function ensurePdfWorker() {
  if (typeof window === 'undefined') return
  const src = `${window.location.origin}/pdf.worker.min.mjs`
  if (GlobalWorkerOptions.workerSrc !== src) {
    GlobalWorkerOptions.workerSrc = src
  }
}

export interface ConvertResult {
  markdown: string
  warning?: string
}

async function readText(file: File): Promise<string> {
  return file.text()
}

function wrapAsMarkdown(title: string, body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return `# ${title}\n\n`
  if (trimmed.startsWith('#')) return trimmed + (trimmed.endsWith('\n') ? '' : '\n')
  return `# ${title}\n\n${trimmed}\n`
}

function isZipContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

function isOleContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  )
}

/** Best-effort UTF-16LE text recovery from legacy Word .doc binaries. */
function extractOleDocText(buffer: ArrayBuffer): string {
  const view = new DataView(buffer)
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    const t = current.replace(/\0/g, '').trim()
    if (t.length >= 6) chunks.push(t)
    current = ''
  }
  for (let i = 0; i + 1 < view.byteLength; i += 2) {
    const code = view.getUint16(i, true)
    const printable =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    if (printable) {
      current += code === 0x0d ? '\n' : String.fromCharCode(code)
      if (current.length > 8000) flush()
    } else {
      flush()
    }
  }
  flush()
  return chunks
    .filter((c) => /[\u4e00-\u9fffA-Za-z0-9]/.test(c))
    .filter((c) => c.length >= 8 || /[\u4e00-\u9fff]{2,}/.test(c))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function convertDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer =
    typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : undefined
  const input = buffer ? { buffer } : { arrayBuffer }
  const api = mammoth as typeof mammoth & {
    convertToMarkdown: (opts: { arrayBuffer?: ArrayBuffer; buffer?: Buffer }) => Promise<{
      value: string
    }>
  }
  try {
    if (typeof api.convertToMarkdown === 'function') {
      const result = await api.convertToMarkdown(input)
      if (result.value?.trim()) return result.value
    }
  } catch {
    // fall through to HTML
  }
  const html = await mammoth.convertToHtml(input)
  return html.value
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

async function convertDoc(file: File): Promise<ConvertResult> {
  const title = file.name.replace(/\.[^.]+$/, '')
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (isZipContainer(bytes)) {
    const md = await convertDocx(new File([buffer], `${title}.docx`))
    return { markdown: wrapAsMarkdown(title, md) }
  }
  if (!isOleContainer(bytes)) {
    return { markdown: '', warning: t('markdown.warnNotWord') }
  }
  const text = extractOleDocText(buffer)
  if (!text) {
    return {
      markdown: '',
      warning: t('markdown.warnDocFailed'),
    }
  }
  return {
    markdown: wrapAsMarkdown(title, text),
    warning: t('markdown.warnDocPartial'),
  }
}

async function convertPdf(file: File): Promise<{ text: string; warning?: string }> {
  ensurePdfWorker()
  const data = new Uint8Array(await file.arrayBuffer())
  let pdf
  try {
    pdf = await getDocument({ data, useSystemFonts: true }).promise
  } catch (err) {
    if (typeof window !== 'undefined') {
      GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`
      try {
        pdf = await getDocument({ data, useSystemFonts: true }).promise
      } catch {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(t('markdown.warnPdfFailed', { message }))
      }
    } else {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(t('markdown.warnPdfFailed', { message }))
    }
  }
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(`<!-- Page number: ${i} -->\n\n${line}`)
  }
  const text = parts.join('\n\n---\n\n')
  if (!text.trim()) {
    return {
      text: '',
      warning: t('markdown.warnPdfNoText'),
    }
  }
  return { text }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/** Join a:t runs inside each a:p (fixes 目+录 / 《+标题+》 split across runs). */
function extractPptxSlideText(xml: string): string {
  const paragraphs: string[] = []
  for (const match of xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)) {
    const block = match[0].replace(/<a:br\s*\/?>/gi, '\n')
    const runs = [...block.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1]),
    )
    let line = runs.join('')
    line = line.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim()
    if (line) paragraphs.push(line)
  }
  return reflowPptxParagraphs(paragraphs)
}

function isPptxAtomLine(line: string): boolean {
  return (
    /^(PART|CONTENTS?|THANKS?|NO\.\d+)$/i.test(line) ||
    /^\d{1,2}$/.test(line) ||
    /^0\d$/.test(line) ||
    /^\d+%(\+)?$/.test(line)
  )
}

/** Only glue true fragments (1–2 chars), keep normal paragraph breaks. */
function reflowPptxParagraphs(paragraphs: string[]): string {
  const out: string[] = []
  for (const raw of paragraphs) {
    const line = raw.replace(/[ \t]{2,}/g, ' ').trim()
    if (!line) continue
    const prev = out[out.length - 1]
    if (
      prev &&
      !isPptxAtomLine(prev) &&
      !isPptxAtomLine(line) &&
      (prev.length <= 2 || line.length <= 2)
    ) {
      const gap = /[A-Za-z0-9]$/.test(prev) && /^[A-Za-z0-9]/.test(line) ? ' ' : ''
      out[out.length - 1] = prev + gap + line
      continue
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

async function convertPptx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const slides: string[] = []
  for (const name of slideNames) {
    const xml = await zip.file(name)!.async('string')
    const body = extractPptxSlideText(xml)
    if (body) {
      const num = name.replace(/^.*slide/i, '').replace(/\.xml$/i, '')
      slides.push(`## ${t('markdown.slideLabel', { n: num })}\n\n${body}`)
    }
  }
  return slides.join('\n\n')
}

async function convertXlsx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const shared: string[] = []
  const sharedFile = zip.file('xl/sharedStrings.xml')
  if (sharedFile) {
    const xml = await sharedFile.async('string')
    for (const m of xml.matchAll(/<si>[\s\S]*?<t[^>]*>([^<]*)<\/t>[\s\S]*?<\/si>/g)) {
      shared.push(m[1])
    }
  }
  const sheetNames = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const sections: string[] = []
  for (const name of sheetNames) {
    const xml = await zip.file(name)!.async('string')
    const rows = new Map<number, Map<number, string>>()
    for (const cell of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      const col = cell[1]
        .split('')
        .reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)
      const row = Number(cell[2])
      const attrs = cell[3] ?? ''
      let value = cell[4] ?? ''
      if (attrs.includes('t="s"') && value !== '') {
        value = shared[Number(value)] ?? value
      }
      if (!rows.has(row)) rows.set(row, new Map())
      rows.get(row)!.set(col, value)
    }
    const sortedRows = [...rows.entries()].sort((a, b) => a[0] - b[0])
    const lines = sortedRows.map(([, cols]) => {
      const maxCol = Math.max(...cols.keys(), 0)
      const cells = []
      for (let c = 1; c <= maxCol; c++) cells.push(cols.get(c) ?? '')
      return `| ${cells.join(' | ')} |`
    })
    if (lines.length) {
      const headerSep = `| ${Array(lines[0].split('|').length - 2)
        .fill('---')
        .join(' | ')} |`
      sections.push(
        `## ${name.replace(/^.*sheet/i, t('markdown.sheetLabel')).replace(/\.xml$/i, '')}\n\n${lines[0]}\n${headerSep}\n${lines.slice(1).join('\n')}`,
      )
    }
  }
  return sections.join('\n\n')
}

async function convertEpub(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const htmlFiles = Object.keys(zip.files)
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n))
    .sort()
  const parts: string[] = []
  for (const name of htmlFiles.slice(0, 80)) {
    const html = await zip.file(name)!.async('string')
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) parts.push(text)
  }
  return parts.join('\n\n')
}

/** OpenDocument text: unzip content.xml and pull text: nodes. */
async function convertOdt(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const content = zip.file('content.xml')
  if (!content) throw new Error(t('markdown.warnOdtInvalid'))
  const xml = await content.async('string')
  return xml
    .replace(/<text:p[^>]*>/g, '\n')
    .replace(/<text:h[^>]*>/g, '\n\n')
    .replace(/<text:line-break\/>/g, '\n')
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function csvToMarkdown(text: string, sep: string): string {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length)
  if (!lines.length) return ''
  const rows = lines.map((line) =>
    line.split(sep).map((c) => c.replace(/^"|"$/g, '').replace(/\|/g, '\\|')),
  )
  const width = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => {
    const copy = [...r]
    while (copy.length < width) copy.push('')
    return copy
  })
  const header = `| ${norm[0].join(' | ')} |`
  const sepLine = `| ${Array(width).fill('---').join(' | ')} |`
  const body = norm.slice(1).map((r) => `| ${r.join(' | ')} |`).join('\n')
  return `${header}\n${sepLine}\n${body}`
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\u(-?\d+)\?/g, (_, n) => {
      const code = Number(n)
      return code > 0 ? String.fromCharCode(code) : ''
    })
    // Skip binary/destination groups only ({\\* ...}), not the whole document body.
    .replace(/\{\\\*\\[^{}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function convertIpynb(raw: string): string {
  const nb = JSON.parse(raw) as {
    cells?: Array<{ cell_type?: string; source?: string | string[] }>
  }
  const parts: string[] = []
  for (const cell of nb.cells ?? []) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source ?? '')
    if (!source.trim()) continue
    if (cell.cell_type === 'markdown') parts.push(source.trim())
    else if (cell.cell_type === 'code') parts.push(`\`\`\`\n${source.trimEnd()}\n\`\`\``)
    else parts.push(source.trim())
  }
  return parts.join('\n\n')
}

function convertEml(raw: string): string {
  const split = raw.split(/\r?\n\r?\n/)
  const headers = split[0] ?? ''
  const body = split.slice(1).join('\n\n')
  const pick = (name: string) =>
    headers.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? ''
  const meta = [
    pick('Subject') && `**Subject:** ${pick('Subject')}`,
    pick('From') && `**From:** ${pick('From')}`,
    pick('To') && `**To:** ${pick('To')}`,
    pick('Date') && `**Date:** ${pick('Date')}`,
  ]
    .filter(Boolean)
    .join('\n')
  const text = body
    .replace(/--[^\n]+[\s\S]*Content-Type: text\/html[\s\S]*/i, '')
    .replace(/Content-Transfer-Encoding:[^\n]+\n/gi, '')
    .replace(/Content-Type:[^\n]+\n/gi, '')
  return `${meta}\n\n${stripHtml(text) || text}`.trim()
}

async function convertZip(file: File): Promise<ConvertResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir && !n.startsWith('__MACOSX/') && !n.includes('/.'))
    .sort()
    .slice(0, 20)
  const sections: string[] = []
  const warnings: string[] = []
  for (const name of names) {
    const nested = new File([await zip.file(name)!.async('blob')], name)
    if (!isSupported(name) || isMedia(name)) {
      warnings.push(t('markdown.warnZipSkip', { name }))
      continue
    }
    const result = await convertFile(nested)
    if (result.markdown) sections.push(`## ${name}\n\n${result.markdown}`)
    else if (result.warning) warnings.push(`${name}：${result.warning}`)
  }
  return {
    markdown: wrapAsMarkdown(file.name.replace(/\.[^.]+$/, ''), sections.join('\n\n---\n\n')),
    warning: warnings.length ? warnings.slice(0, 5).join(t('markdown.rejectJoin')) : undefined,
  }
}

function needsDesktop(ext: string, label: string): ConvertResult {
  return {
    markdown: '',
    warning: t('markdown.warnNeedsDesktop', { label, ext }),
  }
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
}

/** Reject binary/IWA scrape and broken PDF glyph dumps. */
function isReadableExtractedText(text: string): boolean {
  const t = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim()
  // Numbers sheets may only have a few short cells
  if (t.length < 2) return false
  const sample = t.slice(0, 4000)
  let letters = 0
  let cjk = 0
  let junk = 0
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || (code >= 0x30 && code <= 0x39)) {
      letters++
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      cjk++
    } else if (
      code === 0xfffd ||
      (code >= 0xe000 && code <= 0xf8ff) ||
      (code >= 0xf0000 && code <= 0xffffd) ||
      ch === '□' ||
      ch === '�'
    ) {
      junk++
    }
  }
  const meaningful = letters + cjk
  if (meaningful < 2) return false
  if (junk / sample.length > 0.08) return false
  if (sample.length <= 40) return meaningful >= 2
  // Binary scrapes tend to be dense unique CJK with almost no spaces/punctuation.
  const spaceRatio = (sample.match(/[\s，。！？、；：,.!?;:]/g) ?? []).length / sample.length
  if (cjk > 40 && spaceRatio < 0.02 && letters < 8) return false
  // Extreme character diversity ⇒ random binary decode
  const unique = new Set(sample).size
  if (sample.length > 80 && unique / sample.length > 0.72 && spaceRatio < 0.04) return false
  return meaningful / sample.length >= 0.08
}

async function findIworkPreviewPdf(buffer: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const fromLib = extractPreviewPdf(new Uint8Array(buffer))
    if (fromLib && looksLikePdf(fromLib)) return Uint8Array.from(fromLib)
  } catch {
    // fall through to manual scan
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return null
  }
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir)
    .sort((a, b) => {
      const rank = (n: string) => {
        if (/QuickLook\/Preview\.pdf$/i.test(n)) return 0
        if (/Preview\.pdf$/i.test(n)) return 1
        if (/\.pdf$/i.test(n)) return 2
        return 3
      }
      return rank(a) - rank(b) || a.length - b.length
    })

  for (const name of names) {
    if (!/\.pdf$/i.test(name) && !/QuickLook\//i.test(name)) continue
    const bytes = await zip.file(name)!.async('uint8array')
    if (looksLikePdf(bytes)) return Uint8Array.from(bytes)
  }

  // Some packages hide a PDF without .pdf suffix — scan small-ish entries for %PDF
  for (const name of names.slice(0, 80)) {
    const entry = zip.files[name]
    if (entry.dir) continue
    // skip huge media; preview PDFs are usually modest
    const bytes = await entry.async('uint8array')
    if (bytes.length > 2_000_000) continue
    if (looksLikePdf(bytes)) return Uint8Array.from(bytes)
  }
  return null
}

/**
 * Apple iWork (.pages / .numbers / .key) are ZIP packages.
 * Prefer Preview.pdf when present; otherwise decompress IWA (Snappy + protobuf strings).
 */
async function convertIwork(file: File, kind: 'pages' | 'numbers' | 'key'): Promise<ConvertResult> {
  const title = file.name.replace(/\.[^.]+$/, '')
  const app =
    kind === 'pages' ? 'Pages' : kind === 'numbers' ? 'Numbers' : 'Keynote'
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (!isZipContainer(bytes)) {
    return {
      markdown: '',
      warning: t('markdown.warnIworkNotPackage', { kind: kind.toUpperCase(), app }),
    }
  }

  const preview = await findIworkPreviewPdf(buffer)
  if (preview) {
    const pdfCopy = new Uint8Array(preview.byteLength)
    pdfCopy.set(preview)
    const pdfFile = new File([pdfCopy], `${title}.pdf`, { type: 'application/pdf' })
    const { text, warning } = await convertPdf(pdfFile)
    if (text.trim() && isReadableExtractedText(text)) {
      return {
        markdown: wrapAsMarkdown(title, text),
        warning:
          warning ||
          t('markdown.warnIworkFromPdf', { kind: kind.toUpperCase() }),
      }
    }
    // Preview PDF unusable → fall through to IWA text
  }

  try {
    const iwaText = await extractIworkDocumentText(buffer)
    if (iwaText && isReadableExtractedText(iwaText)) {
      return {
        markdown: wrapAsMarkdown(title, iwaText),
        warning: t('markdown.warnIworkFromData', { kind: kind.toUpperCase() }),
      }
    }
  } catch {
    // fall through
  }

  // Older iWork XML
  try {
    const zip = await JSZip.loadAsync(buffer)
    const xmlNames = Object.keys(zip.files)
      .filter((n) => !zip.files[n].dir)
      .filter((n) => /\.(xml|xhtml|html|htm)$/i.test(n))
      .filter((n) => !/META-INF/i.test(n))
      .slice(0, 40)
    const xmlParts: string[] = []
    for (const name of xmlNames) {
      const xml = await zip.file(name)!.async('string')
      const text = xml
        .replace(/<sf:p[^>]*>/gi, '\n')
        .replace(/<sf:br\s*\/>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      if (text.length >= 12 && isReadableExtractedText(text)) xmlParts.push(text)
    }
    if (xmlParts.length) {
      return {
        markdown: wrapAsMarkdown(title, xmlParts.join('\n\n')),
        warning: t('markdown.warnIworkLegacy', { kind: kind.toUpperCase() }),
      }
    }
  } catch {
    // ignore
  }

  return {
    markdown: '',
    warning: t('markdown.warnIworkFailed', { kind: kind.toUpperCase(), app }),
  }
}

/** Browser-local conversion aligned with Mac feature set where feasible. */
export async function convertFile(file: File): Promise<ConvertResult> {
  const title = file.name.replace(/\.[^.]+$/, '')
  const ext = extensionOf(file.name)

  if (isMedia(file.name)) {
    return {
      markdown: '',
      warning:
        t('markdown.warnMediaDesktop'),
    }
  }

  if (ext === 'svg') {
    const raw = await readText(file)
    return { markdown: `# ${title}\n\n\`\`\`svg\n${raw.trim()}\n\`\`\`\n` }
  }

  if (isImage(file.name)) {
    try {
      const text = await ocrImageToText(file)
      if (!text) {
        return {
          markdown: '',
          warning: t('markdown.warnOcrEmpty'),
        }
      }
      return {
        markdown: wrapAsMarkdown(title, text),
        warning: t('markdown.warnOcrPartial'),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        markdown: '',
        warning: t('markdown.warnOcrFailed', { message }),
      }
    }
  }

  if (ext === 'zip') return convertZip(file)

  if (ext === 'pages' || ext === 'numbers' || ext === 'key') {
    return convertIwork(file, ext)
  }
  if (ext === 'msg' || ext === 'ppt') {
    return needsDesktop(ext, ext.toUpperCase())
  }
  if (ext === 'doc') {
    return convertDoc(file)
  }
  if (ext === 'docx') {
    const md = await convertDocx(file)
    return { markdown: wrapAsMarkdown(title, md) }
  }
  if (ext === 'pdf') {
    const { text, warning } = await convertPdf(file)
    return { markdown: wrapAsMarkdown(title, text), warning }
  }
  if (ext === 'pptx' || ext === 'odp') {
    if (ext === 'odp') return needsDesktop(ext, 'OpenDocument Presentation')
    return { markdown: wrapAsMarkdown(title, await convertPptx(file)) }
  }
  if (ext === 'xlsx') {
    return { markdown: wrapAsMarkdown(title, await convertXlsx(file)) }
  }
  if (ext === 'xls' || ext === 'ods') {
    return needsDesktop(ext, ext === 'xls' ? 'Legacy Excel' : 'OpenDocument Spreadsheet')
  }
  if (ext === 'odt') {
    try {
      return { markdown: wrapAsMarkdown(title, await convertOdt(file)) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { markdown: '', warning: t('markdown.warnOdtFailed', { message }) }
    }
  }
  if (ext === 'epub') {
    return { markdown: wrapAsMarkdown(title, await convertEpub(file)) }
  }
  if (ext === 'rtf') {
    return { markdown: wrapAsMarkdown(title, stripRtf(await readText(file))) }
  }
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || ext === 'mhtml' || ext === 'mht') {
    return { markdown: wrapAsMarkdown(title, stripHtml(await readText(file))) }
  }
  if (ext === 'csv') {
    return { markdown: wrapAsMarkdown(title, csvToMarkdown(await readText(file), ',')) }
  }
  if (ext === 'tsv') {
    return { markdown: wrapAsMarkdown(title, csvToMarkdown(await readText(file), '\t')) }
  }
  if (ext === 'json') {
    const raw = await readText(file)
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2)
      return { markdown: `# ${title}\n\n\`\`\`json\n${pretty}\n\`\`\`\n` }
    } catch {
      return { markdown: wrapAsMarkdown(title, raw) }
    }
  }
  if (ext === 'jsonl') {
    const lines = (await readText(file))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, i) => {
        try {
          return `### ${i + 1}\n\n\`\`\`json\n${JSON.stringify(JSON.parse(line), null, 2)}\n\`\`\``
        } catch {
          return `### ${i + 1}\n\n${line}`
        }
      })
    return { markdown: wrapAsMarkdown(title, lines.join('\n\n')) }
  }
  if (ext === 'ipynb') {
    try {
      return { markdown: wrapAsMarkdown(title, convertIpynb(await readText(file))) }
    } catch {
      return { markdown: '', warning: t('markdown.warnIpynbInvalid') }
    }
  }
  if (ext === 'eml') {
    return { markdown: wrapAsMarkdown(title, convertEml(await readText(file))) }
  }
  if (
    ext === 'xml' ||
    ext === 'rss' ||
    ext === 'atom' ||
    ext === 'yaml' ||
    ext === 'yml' ||
    ext === 'toml' ||
    ext === 'ini' ||
    ext === 'cfg' ||
    ext === 'conf' ||
    ext === 'log' ||
    ext === 'txt' ||
    ext === 'text' ||
    ext === 'md' ||
    ext === 'markdown' ||
    ext === 'mdown' ||
    ext === 'rst' ||
    ext === 'org' ||
    ext === 'tex' ||
    ext === 'latex'
  ) {
    const raw = await readText(file)
    if (ext === 'yaml' || ext === 'yml' || ext === 'toml') {
      return { markdown: `# ${title}\n\n\`\`\`${ext === 'yml' ? 'yaml' : ext}\n${raw.trim()}\n\`\`\`\n` }
    }
    return { markdown: wrapAsMarkdown(title, raw) }
  }

  return {
    markdown: '',
    warning: t('markdown.warnUnsupported', { ext }),
  }
}
