export type EbookFormat = 'epub' | 'pdf' | 'txt' | 'docx' | 'mobi' | 'azw3' | 'html'

export interface ConversionRoute {
  id: string
  from: EbookFormat
  to: EbookFormat
  label: string
  /** Engine can produce this target (local or Calibre). */
  supported: boolean
  note?: string
}

export const FORMAT_LABEL: Record<EbookFormat, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  txt: 'TXT',
  docx: 'DOCX',
  mobi: 'MOBI',
  azw3: 'AZW3',
  html: 'HTML',
}

export const FORMAT_COLOR: Record<EbookFormat, string> = {
  epub: '#3B82F6',
  pdf: '#EF4444',
  txt: '#6B7280',
  docx: '#2563EB',
  mobi: '#10B981',
  azw3: '#475569',
  html: '#8B5CF6',
}

/** Reference grid — Kindle 方向由服务器 Calibre 保证完整性。 */
export const CONVERSION_ROUTES: ConversionRoute[] = [
  { id: 'epub-pdf', from: 'epub', to: 'pdf', label: 'EPUB 转 PDF', supported: true },
  { id: 'pdf-epub', from: 'pdf', to: 'epub', label: 'PDF 转 EPUB', supported: true, note: '扫描版自动 OCR' },
  { id: 'mobi-pdf', from: 'mobi', to: 'pdf', label: 'MOBI 转 PDF', supported: true, note: 'Calibre 完整转换' },
  { id: 'pdf-mobi', from: 'pdf', to: 'mobi', label: 'PDF 转 MOBI', supported: true, note: 'OCR + Calibre' },
  { id: 'epub-mobi', from: 'epub', to: 'mobi', label: 'EPUB 转 MOBI', supported: true, note: 'Calibre 完整转换' },
  { id: 'mobi-epub', from: 'mobi', to: 'epub', label: 'MOBI 转 EPUB', supported: true, note: 'Calibre 完整转换' },
  { id: 'epub-azw3', from: 'epub', to: 'azw3', label: 'EPUB 转 AZW3', supported: true, note: 'Calibre 完整转换' },
  { id: 'azw3-epub', from: 'azw3', to: 'epub', label: 'AZW3 转 EPUB', supported: true, note: 'Calibre 完整转换' },
  { id: 'pdf-azw3', from: 'pdf', to: 'azw3', label: 'PDF 转 AZW3', supported: true, note: 'OCR + Calibre' },
  { id: 'epub-txt', from: 'epub', to: 'txt', label: 'EPUB 转 TXT', supported: true },
  { id: 'txt-epub', from: 'txt', to: 'epub', label: 'TXT 转 EPUB', supported: true },
  { id: 'pdf-txt', from: 'pdf', to: 'txt', label: 'PDF 转 TXT', supported: true, note: '扫描版自动 OCR' },
]

export function detectFormat(fileName: string): EbookFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'epub':
      return 'epub'
    case 'pdf':
      return 'pdf'
    case 'txt':
    case 'text':
    case 'md':
      return 'txt'
    case 'docx':
      return 'docx'
    case 'mobi':
    case 'prc':
      return 'mobi'
    case 'azw':
    case 'azw3':
      return 'azw3'
    case 'html':
    case 'htm':
      return 'html'
    default:
      return null
  }
}

export function acceptFor(from?: EbookFormat | null): string {
  if (!from) return '.epub,.pdf,.txt,.text,.md,.docx,.mobi,.prc,.azw3,.azw,.html,.htm'
  const map: Record<EbookFormat, string> = {
    epub: '.epub',
    pdf: '.pdf',
    txt: '.txt,.text,.md',
    docx: '.docx',
    mobi: '.mobi,.prc',
    azw3: '.azw3,.azw',
    html: '.html,.htm',
  }
  return map[from]
}
