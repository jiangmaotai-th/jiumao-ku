import JSZip from 'jszip'

import { extensionFor, type WebOutputFormat } from '../formats'

export type OutputArtifact = {
  blob: Blob
  filename: string
  /** Path inside ZIP, using `/` separators. */
  relativePath: string
}

export type ZipPack = {
  name: string
  blob: Blob
  count: number
}

type DirectoryHandle = {
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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

export async function makeZipPack(
  files: OutputArtifact[],
  name: string,
): Promise<ZipPack> {
  return {
    name,
    blob: files.length === 1 ? files[0].blob : await zipArtifacts(files),
    count: files.length,
  }
}

/** Wrap every pack into one ZIP so Chrome cannot drop packs 2…n-1. */
export async function zipPacksTogether(packs: ZipPack[]): Promise<Blob> {
  if (packs.length === 1) return packs[0].blob
  const zip = new JSZip()
  for (const pack of packs) {
    zip.file(pack.name, await pack.blob.arrayBuffer())
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

function saveFilePickerAvailable(): boolean {
  return typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
}

/** Must run in the click handler, before any slow zip work, to keep the user gesture. */
export async function pickSaveFile(suggestedName: string): Promise<SaveFileHandle | null> {
  const picker = (window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<SaveFileHandle>
  }).showSaveFilePicker
  if (typeof picker !== 'function') return null
  try {
    return await picker({
      suggestedName,
      types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
    })
  } catch {
    return null
  }
}

export async function writeBlobToSaveFile(handle: SaveFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

/**
 * Multiple `<a download>` clicks are silently dropped by Chrome (often only
 * pack 1 and pack N survive). For several packs, open a save dialog on the
 * click, then write one combined ZIP — no download-manager race.
 */
export async function downloadPacks(
  packs: ZipPack[],
  options?: {
    preferSavePicker?: boolean
    onEach?: (index: number, total: number) => void
  },
): Promise<'saved' | 'downloaded' | 'cancelled'> {
  if (!packs.length) return 'downloaded'
  options?.onEach?.(1, packs.length)
  const name = packs.length === 1 ? packs[0].name : 'xiaowu-converted-all.zip'

  let handle: SaveFileHandle | null = null
  if (options?.preferSavePicker && packs.length > 1) {
    handle = await pickSaveFile(name)
    if (!handle && saveFilePickerAvailable()) return 'cancelled'
  }

  const blob = packs.length === 1 ? packs[0].blob : await zipPacksTogether(packs)
  if (handle) {
    await writeBlobToSaveFile(handle, blob)
    return 'saved'
  }
  downloadBlob(blob, name)
  return 'downloaded'
}

export async function pickOutputDirectory(): Promise<DirectoryHandle | null> {
  const picker = (window as Window & {
    showDirectoryPicker?: (options?: { mode?: string; id?: string }) => Promise<DirectoryHandle>
  }).showDirectoryPicker
  if (typeof picker !== 'function') return null
  try {
    return await picker({ mode: 'readwrite', id: 'xiaowu-image-out' })
  } catch {
    return null
  }
}

export async function writeBlobToDirectory(
  root: DirectoryHandle,
  relativePath: string,
  blob: Blob,
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) return
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  const file = await dir.getFileHandle(filename, { create: true })
  const writable = await file.createWritable()
  await writable.write(blob)
  await writable.close()
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
