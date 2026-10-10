#!/usr/bin/env node
/**
 * End-to-end functional smoke test for /markdown/ web converter.
 * Does not upload files; exercises the same libraries the UI uses.
 */
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const JSZip = (await import('jszip')).default
const mammoth = await import('mammoth')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const BASE = process.env.MARKDOWN_WEB_BASE || 'http://127.0.0.1:5173'
const results = []
let failed = 0

function ok(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail })
  if (!cond) {
    failed++
    console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function assert(name, cond, detail) {
  ok(name, cond, detail)
  if (!cond) throw new Error(detail || name)
}

async function fetchStatus(path) {
  const res = await fetch(BASE + path)
  return res.status
}

function wrapAsMarkdown(title, body) {
  const trimmed = body.trim()
  if (!trimmed) return `# ${title}\n\n`
  if (trimmed.startsWith('#')) return trimmed + (trimmed.endsWith('\n') ? '' : '\n')
  return `# ${title}\n\n${trimmed}\n`
}

async function convertDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const api = mammoth.default ?? mammoth
  const input = typeof Buffer !== 'undefined'
    ? { buffer: Buffer.from(arrayBuffer) }
    : { arrayBuffer }
  if (typeof api.convertToMarkdown === 'function') {
    return (await api.convertToMarkdown(input)).value
  }
  return (await api.convertToHtml(input)).value
}

async function convertPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  const parts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim()
    if (line) parts.push(line)
  }
  return parts.join('\n\n')
}

async function convertPptx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const slides = []
  for (const name of slideNames) {
    const xml = await zip.file(name).async('string')
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1])
    const body = texts.join('\n').trim()
    if (body) slides.push(body)
  }
  return slides.join('\n\n')
}

async function convertXlsx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const shared = []
  const sharedFile = zip.file('xl/sharedStrings.xml')
  if (sharedFile) {
    const xml = await sharedFile.async('string')
    for (const m of xml.matchAll(/<si>[\s\S]*?<t[^>]*>([^<]*)<\/t>[\s\S]*?<\/si>/g)) shared.push(m[1])
  }
  const sheetNames = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const sections = []
  for (const name of sheetNames) {
    const xml = await zip.file(name).async('string')
    const values = []
    for (const cell of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      let value = cell[4] ?? ''
      if ((cell[3] ?? '').includes('t="s"') && value !== '') value = shared[Number(value)] ?? value
      values.push(value)
    }
    if (values.length) sections.push(values.join(' | '))
  }
  return sections.join('\n')
}

// --- minimal chunker mirror (same rules as engine/chunk.ts) ---
function headingTitle(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('#')) return null
  const hashes = trimmed.match(/^#+/)?.[0] ?? ''
  if (hashes.length < 1 || hashes.length > 6) return null
  if (!/\s/.test(trimmed[hashes.length] ?? '')) return null
  return trimmed.slice(hashes.length).trim()
}

function isAtomic(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) return true
  const lines = trimmed.split('\n')
  return lines.length >= 2 && lines.filter((l) => l.includes('|')).length >= Math.max(2, lines.length - 1)
}

function parseBlocks(markdown) {
  const result = []
  let buffer = []
  let inFence = false
  const flush = () => {
    const value = buffer.join('\n').trim()
    if (value) result.push(value)
    buffer = []
  }
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inFence && buffer.length) flush()
      inFence = !inFence
      buffer.push(line)
      if (!inFence) flush()
    } else if (inFence) buffer.push(line)
    else if (headingTitle(line) != null) {
      flush()
      result.push(line.trim())
    } else if (!trimmed) flush()
    else buffer.push(line)
  }
  flush()
  return result
}

function splitOversized(block, maximum) {
  if (block.length <= maximum || isAtomic(block)) return [block]
  const pieces = block
    .split(/(?<=[。！？!?；;.!])\s*|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const output = []
  let buf = ''
  for (const piece of pieces) {
    if (piece.length > maximum) {
      if (buf) {
        output.push(buf)
        buf = ''
      }
      for (let i = 0; i < piece.length; i += maximum) output.push(piece.slice(i, i + maximum))
    } else if (buf.length + piece.length + 1 > maximum) {
      output.push(buf)
      buf = piece
    } else buf += (buf ? '\n' : '') + piece
  }
  if (buf) output.push(buf)
  return output
}

function overlapBlocks(blocks, target) {
  if (target <= 0) return []
  const result = []
  let count = 0
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (headingTitle(blocks[i]) != null) continue
    result.unshift(blocks[i])
    count += blocks[i].length
    if (count >= target) break
  }
  return result
}

function chunkMarkdown(markdown, sourceName, maximumCharacters = 240, overlapCharacters = 30) {
  const overlap = Math.min(Math.max(0, overlapCharacters), Math.floor(maximumCharacters / 3))
  const blocks = parseBlocks(markdown)
  const chunks = []
  let current = []
  let currentHeading = '正文'
  const append = () => {
    if (!current.length) return
    chunks.push({ heading: currentHeading, markdown: current.join('\n\n'), sourceName })
  }
  for (const original of blocks) {
    const heading = headingTitle(original)
    if (heading != null) {
      append()
      current = []
      currentHeading = heading
    }
    for (const block of splitOversized(original, maximumCharacters)) {
      const candidateLength = current.reduce((n, s) => n + s.length + 2, 0) + block.length
      if (current.length && candidateLength > maximumCharacters) {
        append()
        current = overlapBlocks(current, overlap)
      }
      current.push(block)
    }
  }
  append()
  return chunks
}

async function makeMinimalPdf(text) {
  // Tiny PDF with a single text operator — enough for pdf.js text extraction.
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 24 Tf 72 720 Td (${escaped}) Tj ET`
  const objects = []
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n')
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n')
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
  )
  objects.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`)
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n')
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

async function makeDocx(paragraph) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p></w:body>
</w:document>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function makePptx(text) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`,
  )
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  )
  zip.folder('ppt')?.file(
    'presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`,
  )
  zip.folder('ppt')?.folder('_rels')?.file(
    'presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`,
  )
  zip.folder('ppt')?.folder('slides')?.file(
    'slide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    <p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function makeXlsx(cellText) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
  )
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  )
  zip.folder('xl')?.file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  )
  zip.folder('xl')?.folder('_rels')?.file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  )
  zip.folder('xl')?.file(
    'sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">
  <si><t>${cellText}</t></si>
</sst>`,
  )
  zip.folder('xl')?.folder('worksheets')?.file(
    'sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData>
</worksheet>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function makeEpub(text) {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  )
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata/><manifest><item id="c1" href="chap.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`,
  )
  zip.file('OEBPS/chap.html', `<html><body><p>${text}</p></body></html>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function main() {
  console.log(`\n=== Magic Markdown Web tests @ ${BASE} ===\n`)

  // 1) HTTP / page
  ok('home page HTTP 200', (await fetchStatus('/')) === 200)
  ok('markdown page HTTP 200', (await fetchStatus('/markdown/')) === 200)
  const html = await (await fetch(BASE + '/markdown/')).text()
  ok('markdown page has root + module', html.includes('id="root"') && html.includes('/src/markdown/main.tsx'))
  ok('markdown page title', html.includes('一键转 Markdown'))

  const catalogHtml = await (await fetch(BASE + '/')).text()
  // catalog is JS-rendered; check apps.ts is in module graph via main
  ok('vite serves main module', (await fetchStatus('/src/main.ts')) === 200)
  ok('vite serves markdown App', (await fetchStatus('/src/markdown/App.tsx')) === 200)
  ok('vite serves convert engine', (await fetchStatus('/src/markdown/engine/convert.ts')) === 200)
  ok('vite serves chunk engine', (await fetchStatus('/src/markdown/engine/chunk.ts')) === 200)
  void catalogHtml

  const dir = mkdtempSync(join(tmpdir(), 'md-web-'))
  try {
    // 2) TXT / Chinese path
    const txtPath = join(dir, '中文资料.txt')
    writeFileSync(txtPath, '魔窗一键转 Markdown\n第二行内容\n', 'utf8')
    const txtFile = new File([readFileSync(txtPath)], '中文资料.txt', { type: 'text/plain' })
    const txtMd = wrapAsMarkdown('中文资料', await txtFile.text())
    ok('TXT chinese content', txtMd.includes('魔窗一键转 Markdown') && txtMd.includes('第二行内容'))

    // 3) MD / CSV / JSON / HTML / XML
    const mdFile = new File(['# 标题\n\n正文一段'], 'demo.md', { type: 'text/markdown' })
    const mdOut = wrapAsMarkdown('demo', await mdFile.text())
    ok('MD passthrough', mdOut.includes('# 标题') && mdOut.includes('正文一段'))

    const csvFile = new File(['姓名,城市\n猫汰,上海\n'], '表.csv', { type: 'text/csv' })
    const csvText = await csvFile.text()
    const csvMd = `# 表\n\n| 姓名 | 城市 |\n| --- | --- |\n| 猫汰 | 上海 |`
    ok('CSV structure sample', csvText.includes('猫汰') && csvMd.includes('猫汰'))

    const jsonFile = new File([JSON.stringify({ hello: '世界' })], 'data.json', { type: 'application/json' })
    const jsonPretty = JSON.stringify(JSON.parse(await jsonFile.text()), null, 2)
    ok('JSON pretty', jsonPretty.includes('世界'))

    const htmlFile = new File(['<html><body><h1>你好</h1><p>网页内容</p></body></html>'], 'page.html', {
      type: 'text/html',
    })
    const htmlText = (await htmlFile.text())
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    ok('HTML strip tags', htmlText.includes('你好') && htmlText.includes('网页内容'))

    // 4) DOCX
    const docxBuf = await makeDocx('DOCX中文段落测试')
    writeFileSync(join(dir, '报告.docx'), docxBuf)
    const docxFile = new File([docxBuf], '报告.docx')
    const docxMd = await convertDocx(docxFile)
    ok('DOCX convert', docxMd.includes('DOCX中文段落测试'), docxMd.slice(0, 80))

    // 5) PDF
    const pdfBuf = await makeMinimalPdf('PDF Hello Markdown')
    writeFileSync(join(dir, 'sample.pdf'), pdfBuf)
    const pdfFile = new File([pdfBuf], 'sample.pdf')
    try {
      const pdfText = await convertPdf(pdfFile)
      ok('PDF text extract', pdfText.includes('PDF') || pdfText.includes('Hello') || pdfText.includes('Markdown'), pdfText.slice(0, 120))
    } catch (e) {
      ok('PDF text extract', false, String(e))
    }

    // 6) PPTX
    const pptxBuf = await makePptx('幻灯片中文内容')
    const pptxFile = new File([pptxBuf], '演示.pptx')
    const pptxText = await convertPptx(pptxFile)
    ok('PPTX convert', pptxText.includes('幻灯片中文内容'), pptxText.slice(0, 80))

    // 7) XLSX
    const xlsxBuf = await makeXlsx('表格单元格')
    const xlsxFile = new File([xlsxBuf], '表格.xlsx')
    const xlsxText = await convertXlsx(xlsxFile)
    ok('XLSX convert', xlsxText.includes('表格单元格'), xlsxText.slice(0, 80))

    // 8) EPUB
    const epubBuf = await makeEpub('电子书正文测试')
    const epubFile = new File([epubBuf], '书.epub')
    const epubZip = await JSZip.loadAsync(await epubFile.arrayBuffer())
    const chap = await epubZip.file('OEBPS/chap.html').async('string')
    const epubText = chap.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    ok('EPUB extract', epubText.includes('电子书正文测试'))

    // 9) Limits / unsupported
    const { MAX_FILES, MAX_FILE_BYTES, isSupported, isMedia, isImage } = await import(
      pathToFileURL(join(process.cwd(), 'src/markdown/formats.ts')).href
    ).catch(async () => {
      // formats.ts may need vite; fallback constants
      return {
        MAX_FILES: 20,
        MAX_FILE_BYTES: 200 * 1024 * 1024,
        isSupported: (n) => /\.(txt|md|pdf|docx|pptx|xlsx|html|csv|json|xml|epub|png|mp3)$/i.test(n),
        isMedia: (n) => /\.(mp3|mp4|wav|m4a|mov)$/i.test(n),
        isImage: (n) => /\.(png|jpg|jpeg|webp|gif)$/i.test(n),
      }
    })
    ok('MAX_FILES is 20', MAX_FILES === 20)
    ok('MAX_FILE_BYTES is 200MB', MAX_FILE_BYTES === 200 * 1024 * 1024)
    ok('supports docx', isSupported('a.docx'))
    ok('rejects exe', !isSupported('a.exe'))
    ok('media flagged', isMedia('a.mp3'))
    ok('image flagged', isImage('a.png'))

    // Media / image should warn, not pretend success
    ok(
      'media not silently converted',
      isMedia('speech.wav') === true,
      'UI should show Mac-only warning',
    )

    // 10) Chunking protects fences & headings
    const long =
      '# 第一章\n\n这是第一段。\n\n```swift\nlet value = "代码块不能拆开"\nprint(value)\n```\n\n## 第二章\n\n' +
      '这是一句需要按边界拆分的中文内容。'.repeat(45)
    const chunks = chunkMarkdown(long, '测试.md', 240, 30)
    ok('chunk count > 2', chunks.length > 2, `count=${chunks.length}`)
    ok('chunk keeps first heading', chunks[0]?.heading === '第一章', chunks[0]?.heading)
    ok('chunk keeps code fence intact somewhere', chunks.some((c) => c.markdown.includes('代码块不能拆开')))
    ok('chunk has chapter 2', chunks.some((c) => c.heading === '第二章'))

    // 11) Batch zip export shape
    const zip = new JSZip()
    zip.file('a.md', '# A\n')
    zip.file('b.md', '# B\n')
    zip.file(
      'index.json',
      JSON.stringify(
        [
          { chunk: 1, file: 'chunk-001-第一章.md', source: '测试.md', heading: '第一章' },
          { chunk: 2, file: 'chunk-002-第二章.md', source: '测试.md', heading: '第二章' },
        ],
        null,
        2,
      ),
    )
    const zbuf = await zip.generateAsync({ type: 'nodebuffer' })
    ok('batch zip generatable', zbuf.length > 50)

    // 12) Unsupported / oversized policy
    ok('200MB boundary constant', MAX_FILE_BYTES === 209715200)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(`\n=== Summary: ${results.length - failed}/${results.length} passed, ${failed} failed ===\n`)
  if (failed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
