import type { EbookFormat } from '../formats'
import type { ConvertResult } from './convert'
import { pdfLooksScanned } from './pdfScan'

const REFLOWABLE: EbookFormat[] = ['epub', 'mobi', 'azw3', 'txt']

/** Formats that always require Calibre on the server. */
export function needsRemoteConvert(from: EbookFormat, to: EbookFormat): boolean {
  return to === 'azw3' || to === 'mobi' || from === 'azw3' || from === 'mobi'
}

/** Whether this job should use the server (Calibre and/or OCR). */
export async function shouldUseRemote(
  file: File,
  from: EbookFormat,
  to: EbookFormat,
): Promise<boolean> {
  if (needsRemoteConvert(from, to)) return true
  if (from === 'pdf' && REFLOWABLE.includes(to)) {
    return pdfLooksScanned(file)
  }
  return false
}

export async function convertEbookRemote(
  file: File,
  from: EbookFormat,
  to: EbookFormat,
): Promise<ConvertResult> {
  const body = new FormData()
  body.append('file', file, file.name)
  body.append('from', from)
  body.append('to', to)

  const res = await fetch('/api/ebook-convert', {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    let message = `服务器转换失败（${res.status}）`
    try {
      const data = (await res.json()) as { message?: string; error?: string }
      if (data.message) message = data.message
      else if (data.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const headerName = res.headers.get('X-Output-Name')
  const fileName = headerName
    ? decodeURIComponent(headerName)
    : file.name.replace(/\.[^.]+$/, '') + `.${to}`
  const ocr = res.headers.get('X-Ocr-Applied') === '1'

  return {
    blob,
    fileName,
    warnings: [
      ocr
        ? '已对扫描版 PDF 做 OCR（中英），再用 Calibre 转换；文件瞬时处理完即删。'
        : '已用 Calibre 完整转换；文件经服务器瞬时处理，完成后立即删除。',
    ],
  }
}
