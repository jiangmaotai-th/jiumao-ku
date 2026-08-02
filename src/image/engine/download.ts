import JSZip from 'jszip'

import { extensionFor, type WebOutputFormat } from '../formats'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export type OutputArtifact = {
  blob: Blob
  filename: string
  /** Path inside ZIP, using `/` separators. */
  relativePath: string
}

export function buildOutputRelativePath(
  sourceFile: File,
  filename: string,
  format: WebOutputFormat,
): string {
  const relative = (sourceFile as File & { webkitRelativePath?: string }).webkitRelativePath
  const dir = relative?.includes('/')
    ? relative.split('/').slice(0, -1).filter(Boolean).join('/')
    : ''
  const formatFolder = extensionFor(format)
  return [formatFolder, dir, filename].filter(Boolean).join('/')
}

export async function zipArtifacts(files: OutputArtifact[]): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.relativePath || file.filename, file.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Single file downloads directly; multiple files become a ZIP with format folders. */
export async function downloadArtifacts(
  files: OutputArtifact[],
  options?: { zipName?: string },
): Promise<void> {
  if (!files.length) return
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].filename)
    return
  }
  const zip = await zipArtifacts(files)
  downloadBlob(zip, options?.zipName || `xiaowu-converted-${Date.now()}.zip`)
}
