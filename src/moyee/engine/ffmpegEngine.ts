import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { AppMode, OutputProfile } from '../types'
import { buildFfmpegArgs, buildMergeArgs, outputFileName } from '../domain/commandBuilder'

let ffmpeg: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

export type ProgressCb = (ratio: number) => void

const CORE_JS_MIME = 'text/javascript'
const CORE_WASM_MIME = 'application/wasm'
const FETCH_TIMEOUT_MS = 180_000
const INIT_TIMEOUT_MS = 90_000

async function fetchToBlobURL(
  url: string,
  mime: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const total = Number(res.headers.get('content-length') || 0)
    if (!res.body) {
      const buf = await res.arrayBuffer()
      onProgress?.(1)
      return URL.createObjectURL(new Blob([buf], { type: mime }))
    }
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      loaded += value.byteLength
      if (total > 0) onProgress?.(Math.min(0.99, loaded / total))
    }
    onProgress?.(1)
    return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mime }))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('处理引擎下载超时')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

async function loadCore(
  instance: FFmpeg,
  coreURL: string,
  wasmURL: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      instance.load({ coreURL, wasmURL }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          try {
            instance.terminate()
          } catch {
            /* ignore */
          }
          reject(new Error('处理引擎初始化超时'))
        }, INIT_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function getFfmpeg(
  onLog?: (line: string) => void,
  onLoadProgress?: ProgressCb,
): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg
  if (loading) return loading

  loading = (async () => {
    // Blob URLs are required: a module worker importing http(s) ffmpeg-core.js
    // often hangs forever (Safari / some Chromium) and never rejects, so the
    // CDN fallback never ran and the UI stayed on “加载处理引擎”.
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
    const sources = [
      {
        core: `${origin}/ffmpeg/ffmpeg-core.js`,
        wasm: `${origin}/ffmpeg/ffmpeg-core.wasm`,
      },
      {
        core: `${cdnBase}/ffmpeg-core.js`,
        wasm: `${cdnBase}/ffmpeg-core.wasm`,
      },
    ]

    let lastErr: unknown
    for (const src of sources) {
      const instance = new FFmpeg()
      if (onLog) {
        instance.on('log', ({ message }) => onLog(message))
      }
      let coreURL: string | undefined
      let wasmURL: string | undefined
      try {
        onLoadProgress?.(0.02)
        coreURL = await fetchToBlobURL(src.core, CORE_JS_MIME)
        wasmURL = await fetchToBlobURL(src.wasm, CORE_WASM_MIME, (r) => {
          onLoadProgress?.(0.05 + r * 0.85)
        })
        onLoadProgress?.(0.92)
        await loadCore(instance, coreURL, wasmURL)
        if (!instance.loaded) throw new Error('engine not loaded')
        onLoadProgress?.(1)
        ffmpeg = instance
        return instance
      } catch (e) {
        lastErr = e
        if (coreURL) URL.revokeObjectURL(coreURL)
        if (wasmURL) URL.revokeObjectURL(wasmURL)
        try {
          instance.terminate()
        } catch {
          /* ignore */
        }
      }
    }
    const tip = lastErr instanceof Error ? lastErr.message : 'engine load failed'
    throw new Error(`处理引擎加载失败：${tip}`)
  })()

  try {
    return await loading
  } catch (e) {
    loading = null
    ffmpeg = null
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
