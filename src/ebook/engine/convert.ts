import JSZip from 'jszip'
import mammoth from 'mammoth'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import type { EbookFormat } from '../formats'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export interface ConvertResult {
  blob: Blob
  fileName: string
  warnings: string[]
}

function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'book'
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToXhtmlParagraphs(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paras.length) return '<p></p>'
  return paras
    .map((p) => `<p>${escapeXml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

async function extractTxt(
  file: File,
  format: EbookFormat,
): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = []

  if (format === 'txt' || format === 'html') {
    const raw = await file.text()
    return { text: format === 'html' ? stripHtml(raw) : raw, warnings }
  }

  if (format === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await readAsArrayBuffer(file) })
    if (result.messages?.length) warnings.push('DOCX 部分样式已忽略，仅保留正文。')
    return { text: result.value.trim(), warnings }
  }

  if (format === 'pdf') {
    const data = new Uint8Array(await readAsArrayBuffer(file))
    const doc = await pdfjs.getDocument({ data }).promise
    const parts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      parts.push(
        content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
      )
    }
    return { text: parts.join('\n\n').trim(), warnings }
  }

  if (format === 'epub' || format === 'azw3') {
    return extractFromZipEbook(file, format, warnings)
  }

  if (format === 'mobi') {
    const text = extractMobiText(new Uint8Array(await readAsArrayBuffer(file)))
    if (!text.trim()) {
      throw new Error('无法从该 MOBI 提取文本（可能已加密或为非常用结构）')
    }
    warnings.push('MOBI 为尽力提取，复杂排版可能丢失。')
    return { text, warnings }
  }

  const _exhaustive: never = format
  throw new Error(`暂不支持读取 ${String(_exhaustive)}`)
}

async function extractFromZipEbook(
  file: File,
  format: EbookFormat,
  warnings: string[],
): Promise<{ text: string; warnings: string[] }> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await readAsArrayBuffer(file))
  } catch {
    throw new Error(
      format === 'azw3'
        ? '无法打开该 AZW3（可能已加密或非 KF8 结构）'
        : '无法打开该 EPUB 文件',
    )
  }
  const htmlFiles = Object.keys(zip.files)
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n) && !zip.files[n].dir)
    .sort()
  const chunks: string[] = []
  for (const name of htmlFiles) {
    const html = await zip.files[name].async('string')
    const t = stripHtml(html)
    if (t) chunks.push(t)
  }
  if (!chunks.length) throw new Error('未能提取到正文')
  if (format === 'azw3') warnings.push('AZW3 按 KF8/ZIP 结构解包，加密书籍无法处理。')
  return { text: chunks.join('\n\n'), warnings }
}

function extractMobiText(bytes: Uint8Array): string {
  const asUtf = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const utfParts =
    asUtf.match(/[\u4e00-\u9fffA-Za-z0-9，。！？、；：""''（）\s.,!?;:'"()-]{20,}/g) || []
  const utfJoined = utfParts.join('\n\n').replace(/\s{3,}/g, '\n\n').trim()
  if (utfJoined.length > 80) return utfJoined

  const asLatin = new TextDecoder('windows-1252', { fatal: false }).decode(bytes)
  const parts = asLatin.match(/[\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]{40,}/g) || []
  return parts
    .join('\n\n')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

async function buildEpub(text: string, title: string): Promise<Blob> {
  const zip = new JSZip()
  const bookId = `urn:uuid:${crypto.randomUUID()}`
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <style>
    body { font-family: serif; line-height: 1.7; margin: 1.2em; }
    p { text-indent: 2em; margin: 0.6em 0; }
  </style>
</head>
<body>
<h1>${escapeXml(title)}</h1>
${textToXhtmlParagraphs(text)}
</body>
</html>`

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.folder('META-INF')?.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  )
  const oebps = zip.folder('OEBPS')
  oebps?.file('chapter1.xhtml', xhtml)
  oebps?.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`,
  )
  oebps?.file(
    'nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc"><ol><li><a href="chapter1.xhtml">${escapeXml(title)}</a></li></ol></nav>
</body>
</html>`,
  )

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
}

/** Render text pages with canvas so CJK fonts work, then embed into PDF. */
async function buildPdf(text: string, title: string): Promise<Blob> {
  const pdf = await PDFDocument.create()
  const pageWidth = 595
  const pageHeight = 842
  const margin = 48
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = pageWidth * scale
  canvas.height = pageHeight * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布以生成 PDF')

  const fontSize = 14
  const lineHeight = 22
  const maxChars = 32
  const allLines: string[] = [title, '']
  for (const para of text.split(/\n/)) {
    if (!para.trim()) {
      allLines.push('')
      continue
    }
    for (let i = 0; i < para.length; i += maxChars) {
      allLines.push(para.slice(i, i + maxChars))
    }
    allLines.push('')
  }

  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight)
  for (let start = 0; start < allLines.length; start += linesPerPage) {
    const slice = allLines.slice(start, start + linesPerPage)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageWidth, pageHeight)
    ctx.fillStyle = '#1a1a1a'
    ctx.textBaseline = 'top'
    let y = margin
    slice.forEach((line, idx) => {
      const heading = start === 0 && idx === 0
      ctx.font = heading
        ? `bold 18px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif`
        : `${fontSize}px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif`
      ctx.fillText(line, margin, y)
      y += heading ? 28 : lineHeight
    })
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 失败'))), 'image/png')
    })
    const image = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()))
    const page = pdf.addPage([pageWidth, pageHeight])
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  }

  const bytes = await pdf.save()
  return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
}

export async function convertEbook(
  file: File,
  from: EbookFormat,
  to: EbookFormat,
): Promise<ConvertResult> {
  if (to === 'docx') {
    throw new Error('浏览器暂无法生成 DOCX，请改选 EPUB / PDF / TXT / AZW3。')
  }

  // AZW3 / MOBI 走服务器 Calibre（见 remoteConvert）；此处仅保留本地路径。
  if (to === 'mobi' || to === 'azw3') {
    throw new Error('请使用服务器转换通道生成 AZW3/MOBI。')
  }

  const { text, warnings } = await extractTxt(file, from)
  if (!text.trim()) throw new Error('没有提取到可转换的正文')

  const title = stemOf(file.name)
  const outName = `${title}.${to}`

  if (to === 'txt') {
    return {
      blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
      fileName: outName,
      warnings,
    }
  }
  if (to === 'epub') {
    return { blob: await buildEpub(text, title), fileName: outName, warnings }
  }
  if (to === 'pdf') {
    return { blob: await buildPdf(text, title), fileName: outName, warnings }
  }

  throw new Error(`暂不支持转换为 ${to.toUpperCase()}`)
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}
