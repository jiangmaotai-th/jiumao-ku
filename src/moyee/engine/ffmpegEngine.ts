import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { AppMode, OutputProfile } from '../types'
import { buildFfmpegArgs, buildMergeArgs, outputFileName } from '../domain/commandBuilder'

let ffmpeg: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

export type ProgressCb = (ratio: number) => void

export async function getFfmpeg(onLog?: (line: string) => void): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  if (loading) return loading

  loading = (async () => {
    const instance = new FFmpeg()
    instance.on('log', ({ message }) => onLog?.(message))
    // Single-thread core: no SharedArrayBuffer / COOP-COEP required.
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
    await instance.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpeg = instance
    return instance
  })()

  try {
    return await loading
  } catch (e) {
    loading = null
    throw e
  }
}

function mimeFor(container: string, mode: AppMode, extract?: string | null): string {
  if (mode === 'extract' && extract === 'cover') return 'image/jpeg'
  if (mode === 'extract' && extract === 'gif') return 'image/gif'
  switch (container) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'flac':
      return 'audio/flac'
    case 'ogg':
      return 'audio/ogg'
    case 'm4a':
    case 'aac':
      return 'audio/mp4'
    case 'webm':
      return 'video/webm'
    case 'mov':
      return 'video/quicktime'
    default:
      return 'video/mp4'
  }
}

export async function runJob(opts: {
  file: File
  profile: OutputProfile
  mode: AppMode
  onProgress?: ProgressCb
}): Promise<{ blob: Blob; fileName: string }> {
  const ff = await getFfmpeg()
  const progressHandler = ({ progress }: { progress: number }) => {
    opts.onProgress?.(Math.max(0, Math.min(1, progress)))
  }
  ff.on('progress', progressHandler)

  const inName = `in_${Date.now()}_${opts.file.name.replace(/[^\w.-]+/g, '_')}`
  let outContainer = opts.profile.container
  if (opts.mode === 'extract') {
    const ex = opts.profile.extractMode ?? 'audio'
    if (ex === 'cover') outContainer = 'jpg'
    else if (ex === 'gif') outContainer = 'gif'
    else outContainer = opts.profile.container || 'mp3'
  }
  const profile = { ...opts.profile, container: outContainer }
  const outName = outputFileName(opts.file.name, profile, opts.mode)

  try {
    await ff.writeFile(inName, await fetchFile(opts.file))
    const args = buildFfmpegArgs(inName, outName, profile, opts.mode)
    const code = await ff.exec(args)
    if (code !== 0) {
      throw new Error(`FFmpeg 退出码 ${code}`)
    }
    const data = await ff.readFile(outName)
    const bytes =
      data instanceof Uint8Array
        ? Uint8Array.from(data)
        : new TextEncoder().encode(String(data))
    const blob = new Blob([bytes], {
      type: mimeFor(outContainer, opts.mode, profile.extractMode),
    })
    return { blob, fileName: outName }
  } finally {
    ff.off('progress', progressHandler)
    try {
      await ff.deleteFile(inName)
    } catch {
      /* ignore */
    }
    try {
      await ff.deleteFile(outName)
    } catch {
      /* ignore */
    }
  }
}

export async function runMerge(opts: {
  files: File[]
  onProgress?: ProgressCb
}): Promise<{ blob: Blob; fileName: string }> {
  if (opts.files.length < 2) throw new Error('合并至少需要 2 个文件')
  const ff = await getFfmpeg()
  const progressHandler = ({ progress }: { progress: number }) => {
    opts.onProgress?.(Math.max(0, Math.min(1, progress)))
  }
  ff.on('progress', progressHandler)

  const names: string[] = []
  const listName = `concat_${Date.now()}.txt`
  const outName = `merged_${Date.now()}.mp4`

  try {
    for (let i = 0; i < opts.files.length; i++) {
      const n = `merge_${i}_${opts.files[i].name.replace(/[^\w.-]+/g, '_')}`
      names.push(n)
      await ff.writeFile(n, await fetchFile(opts.files[i]))
    }
    const listBody = names.map((n) => `file '${n}'`).join('\n')
    await ff.writeFile(listName, listBody)
    const code = await ff.exec(buildMergeArgs(listName, outName))
    if (code !== 0) throw new Error(`合并失败（退出码 ${code}）。请尽量使用相同编码的文件。`)
    const data = await ff.readFile(outName)
    const bytes =
      data instanceof Uint8Array
        ? Uint8Array.from(data)
        : new TextEncoder().encode(String(data))
    return {
      blob: new Blob([bytes], { type: 'video/mp4' }),
      fileName: outName,
    }
  } finally {
    ff.off('progress', progressHandler)
    for (const n of [...names, listName, outName]) {
      try {
        await ff.deleteFile(n)
      } catch {
        /* ignore */
      }
    }
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
