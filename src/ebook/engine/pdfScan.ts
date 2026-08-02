import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

/** Heuristic: average extractable chars/page below this ⇒ treat as scanned. */
const MIN_CHARS_PER_PAGE = 40
const SAMPLE_PAGES = 5

/** True when PDF likely has little/no text layer (scanned images). */
export async function pdfLooksScanned(file: File): Promise<boolean> {
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const doc = await pdfjs.getDocument({ data }).promise
    const pages = Math.max(1, doc.numPages)
    const sample = Math.min(pages, SAMPLE_PAGES)
    let chars = 0
    for (let i = 1; i <= sample; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      chars += content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join('')
        .replace(/\s+/g, '').length
    }
    return chars / sample < MIN_CHARS_PER_PAGE
  } catch {
    // If we cannot inspect, let the server decide.
    return true
  }
}
