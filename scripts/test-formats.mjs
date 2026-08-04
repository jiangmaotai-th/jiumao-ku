/**
 * Smoke-test markdown convertFile for supported web formats.
 * Usage: npx tsx scripts/test-formats.mjs
 */
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href

const { convertFile } = await import('../src/markdown/engine/convert.ts')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function makePdf(text) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 200])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText(text, { x: 40, y: 120, size: 14, font })
  const bytes = await doc.save()
  return new File([bytes], 'sample.pdf', { type: 'application/pdf' })
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
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'sample.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

async function makePptx(text) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`,
  )
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><a:t>${text}</a:t></p:sld>`,
  )
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'sample.pptx')
}

async function makeXlsx(cell) {
  const zip = new JSZip()
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>${cell}</t></si></sst>`,
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`,
  )
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'sample.xlsx')
}

async function makeEpub(text) {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('OEBPS/chapter.xhtml', `<html><body><p>${text}</p></body></html>`)
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'sample.epub')
}

async function makeOdt(text) {
  const zip = new JSZip()
  zip.file(
    'content.xml',
    `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>${text}</text:p></office:text></office:body></office:document-content>`,
  )
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'sample.odt')
}

function makeOleDoc(utf16Text) {
  const header = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  const pad = new Uint8Array(64)
  const payload = Buffer.from(utf16Text, 'utf16le')
  const bytes = new Uint8Array(header.length + pad.length + payload.length)
  bytes.set(header, 0)
  bytes.set(pad, header.length)
  bytes.set(payload, header.length + pad.length)
  return new File([bytes], 'sample.doc')
}

async function makeZipWithTxt(text) {
  const zip = new JSZip()
  zip.file('inner.txt', text)
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], 'bundle.zip')
}

async function makeIworkWithPreview(text, filename) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 200])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText(text, { x: 40, y: 120, size: 14, font })
  const pdfBytes = await doc.save()
  const zip = new JSZip()
  zip.file('QuickLook/Preview.pdf', pdfBytes)
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return new File([buf], filename)
}

const cases = []

async function check(name, file, expect) {
  try {
    const result = await convertFile(file)
    if (expect === 'desktop-warn') {
      assert(result.warning && !result.markdown, `${name}: expected desktop warning`)
      cases.push({ name, ok: true, note: 'warn-ok' })
      return
    }
    assert(result.markdown && result.markdown.includes(expect), `${name}: missing "${expect}" in markdown`)
    cases.push({ name, ok: true, note: `len=${result.markdown.length}` })
  } catch (err) {
    cases.push({ name, ok: false, note: err instanceof Error ? err.message : String(err) })
  }
}

await check('pdf', await makePdf('HelloPDFMarker'), 'HelloPDFMarker')
await check('docx', await makeDocx('HelloDocxMarker'), 'HelloDocxMarker')
await check('doc-ole', makeOleDoc('HelloDocMarkerABC'), 'HelloDocMarkerABC')
await check('pptx', await makePptx('HelloPptxMarker'), 'HelloPptxMarker')
await check('xlsx', await makeXlsx('HelloXlsxMarker'), 'HelloXlsxMarker')
await check('epub', await makeEpub('HelloEpubMarker'), 'HelloEpubMarker')
await check('odt', await makeOdt('HelloOdtMarker'), 'HelloOdtMarker')
await check('rtf', new File([String.raw`{\rtf1\ansi HelloRtfMarker}`], 'a.rtf'), 'HelloRtfMarker')
await check('html', new File(['<p>HelloHtmlMarker</p>'], 'a.html'), 'HelloHtmlMarker')
await check('csv', new File(['name,age\nAda,30'], 'a.csv'), 'Ada')
await check('tsv', new File(['name\tage\nBob\t20'], 'a.tsv'), 'Bob')
await check('json', new File(['{"k":"HelloJsonMarker"}'], 'a.json'), 'HelloJsonMarker')
await check('jsonl', new File(['{"a":1}\n{"b":2}'], 'a.jsonl'), '行 1')
await check(
  'ipynb',
  new File(
    [JSON.stringify({ cells: [{ cell_type: 'markdown', source: ['HelloIpynbMarker'] }] })],
    'a.ipynb',
  ),
  'HelloIpynbMarker',
)
await check(
  'eml',
  new File(['Subject: HelloEmlMarker\nFrom: a@b.c\n\nBody text here'], 'a.eml'),
  'HelloEmlMarker',
)
await check('txt', new File(['HelloTxtMarker'], 'a.txt'), 'HelloTxtMarker')
await check('md', new File(['# HelloMdMarker'], 'a.md'), 'HelloMdMarker')
await check('yaml', new File(['key: HelloYamlMarker'], 'a.yaml'), 'HelloYamlMarker')
await check('xml', new File(['<root>HelloXmlMarker</root>'], 'a.xml'), 'HelloXmlMarker')
await check('zip', await makeZipWithTxt('HelloZipInnerMarker'), 'HelloZipInnerMarker')
await check('svg', new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg'), '```svg')
// Invalid tiny PNG should fail OCR with a warning (not throw)
await check('png-image', new File([new Uint8Array([137, 80, 78, 71])], 'a.png'), 'desktop-warn')
await check('mp3-media', new File([new Uint8Array([0])], 'a.mp3'), 'desktop-warn')
await check('ppt-legacy', new File([new Uint8Array([0])], 'a.ppt'), 'desktop-warn')
await check('xls-legacy', new File([new Uint8Array([0])], 'a.xls'), 'desktop-warn')
await check('odp', new File([new Uint8Array([0])], 'a.odp'), 'desktop-warn')
await check('ods', new File([new Uint8Array([0])], 'a.ods'), 'desktop-warn')
await check('pages', await makeIworkWithPreview('HelloPagesMarker', 'sample.pages'), 'HelloPagesMarker')
await check('numbers', await makeIworkWithPreview('HelloNumbersMarker', 'sample.numbers'), 'HelloNumbersMarker')
await check('keynote', await makeIworkWithPreview('HelloKeynoteMarker', 'sample.key'), 'HelloKeynoteMarker')
await check(
  'pages-empty',
  new File([await (async () => {
    const z = new JSZip()
    z.file('Index/Document.iwa', new Uint8Array([1, 2, 3]))
    return z.generateAsync({ type: 'uint8array' })
  })()], 'empty.pages'),
  'desktop-warn',
)

const failed = cases.filter((c) => !c.ok)
for (const c of cases) {
  console.log(`${c.ok ? 'OK' : 'FAIL'}  ${c.name.padEnd(14)} ${c.note}`)
}
console.log(`\n${cases.length - failed.length}/${cases.length} passed`)
if (failed.length) process.exitCode = 1
