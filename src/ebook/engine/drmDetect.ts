import JSZip from 'jszip'
import * as pdfjs from 'pdfjs-dist'
import type { EbookFormat } from '../formats'

/** User-facing copy: detection only, no removal. */
export const DRM_BLOCKED_MESSAGE =
  '该文件受 DRM（数字版权保护）加密，魔书不提供也不协助移除 DRM。请改用无加密 / DRM-free 版本后再转换。'

export class DrmProtectedError extends Error {
  readonly code = 'drm_protected' as const
  constructor(detail?: string) {
    super(detail ? `${DRM_BLOCKED_MESSAGE}（${detail}）` : DRM_BLOCKED_MESSAGE)
    this.name = 'DrmProtectedError'
  }
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

/** PalmDOC encryption type != 0 ⇒ encrypted / DRM. */
function mobiEncryptionType(bytes: Uint8Array): number | null {
  if (bytes.length < 86) return null
  const numRecords = readU16BE(bytes, 76)
  if (numRecords < 1) return null
  const firstRecordOffset = readU32BE(bytes, 78)
  if (firstRecordOffset + 14 > bytes.length) return null
  return readU16BE(bytes, firstRecordOffset + 12)
}

async function detectZipEbookDrm(bytes: Uint8Array): Promise<string | null> {
  if (!looksLikeZip(bytes)) return null
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    return null
  }

  const names = Object.keys(zip.files).map((n) => n.replace(/\\/g, '/'))
  const encEntry = names.find((n) => /META-INF\/encryption\.xml$/i.test(n))
  if (encEntry) {
    return '检测到 encryption.xml'
  }
  if (names.some((n) => /META-INF\/rights\.xml$/i.test(n))) {
    return '检测到 rights.xml'
  }
  const opfName = names.find((n) => /\.opf$/i.test(n))
  if (opfName) {
    const opf = await zip.files[opfName].async('string')
    if (/adept:resource|xmlns:adept|urn:adept/i.test(opf)) return 'Adobe ADEPT'
  }
  return null
}

async function detectPdfDrm(bytes: Uint8Array): Promise<string | null> {
  try {
    await pdfjs.getDocument({ data: bytes, password: '' }).promise
    return null
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    const msg = e instanceof Error ? e.message : String(e)
    if (
      name === 'PasswordException' ||
      /password|encrypted|NeedPassword|encrypt/i.test(msg)
    ) {
      return 'PDF 已加密'
    }
    return null
  }
}

function detectMobiDrm(bytes: Uint8Array): string | null {
  const enc = mobiEncryptionType(bytes)
  if (enc !== null && enc !== 0) return 'MOBI/AZW 加密标记'

  const head = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 65536)))
  if (/DRM_KEY|DRMION|KindleEbookEncryption|PDOC_ENCRYPT/i.test(head)) {
    return 'Kindle DRM 标记'
  }
  return null
}

/**
 * Detect common DRM / encryption markers.
 * Returns a short detail string, or null if none found.
 * Does not decrypt or strip protection.
 */
export async function detectDrm(
  file: File,
  format: EbookFormat,
): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (format === 'epub') {
    return detectZipEbookDrm(bytes)
  }
  if (format === 'pdf') {
    return detectPdfDrm(bytes)
  }
  if (format === 'mobi' || format === 'azw3') {
    const zipHit = await detectZipEbookDrm(bytes)
    if (zipHit) return zipHit
    return detectMobiDrm(bytes)
  }
  return null
}

export async function assertNoDrm(file: File, format: EbookFormat): Promise<void> {
  const detail = await detectDrm(file, format)
  if (detail) throw new DrmProtectedError(detail)
}

/** Map converter / server errors that already indicate DRM. */
export function asDrmErrorIfMatched(message: string): DrmProtectedError | null {
  if (
    /DRM|drm_protected|encrypted|encryption\.xml|PasswordException|需要密码|受\s*DRM|版权保护|adept/i.test(
      message,
    )
  ) {
    return new DrmProtectedError()
  }
  return null
}
