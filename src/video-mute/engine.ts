import { fetchFile } from '@ffmpeg/util'
import { downloadBlob, getFfmpeg, type ProgressCb } from '../moyee/engine/ffmpegEngine'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

function extOf(name: string): string {
  const m = name.match(/\.([^.]+)$/)
  return (m?.[1] || 'mp4').toLowerCase()
}

function mimeForExt(ext: string): string {
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

function safeStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '') || 'video'
  return stem.replace(/[^\w.\u4e00-\u9fff-]+/g, '_').slice(0, 80)
}

function toBytes(data: Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) return data.slice()
  return new TextEncoder().encode(String(data))
}

function toBlob(bytes: Uint8Array, mime: string): Blob {
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  return new Blob([ab], { type: mime })
}

async function fileExists(ff: FFmpeg, name: string): Promise<boolean> {
  try {
    const data = await ff.readFile(name)
    const bytes = toBytes(data)
    return bytes.byteLength > 32
  } catch {
    return false
  }
}

/** Probe whether an ffmpeg FS file still contains an audio stream. */
async function outputHasAudio(ff: FFmpeg, name: string): Promise<boolean> {
  const logs: string[] = []
  const onLog = ({ message }: { message: string }) => {
    logs.push(message)
  }
  ff.on('log', onLog)
  try {
    // Probe-only: no output file. Exit code is usually non-zero; logs still list streams.
    await ff.exec(['-hide_banner', '-i', name])
  } catch {
    /* ignore */
  } finally {
    ff.off('log', onLog)
  }
  return /Stream #\d+:\d+[^\n]*Audio:/i.test(logs.join('\n'))
}

async function readOutput(ff: FFmpeg, name: string): Promise<Uint8Array> {
  const data = await ff.readFile(name)
  const bytes = toBytes(data)
  if (bytes.byteLength < 32) throw new Error('输出文件为空')
  return bytes
}

export async function runMuteExport(opts: {
  file: File
  onProgress?: ProgressCb
  onPhase?: (phase: 'load' | 'write' | 'mute' | 'encode') => void
}): Promise<{ blob: Blob; fileName: string }> {
  opts.onPhase?.('load')
  opts.onProgress?.(0.02)

  const logs: string[] = []
  const ff = await getFfmpeg(undefined, (r) => {
    opts.onProgress?.(0.08 + Math.max(0, Math.min(1, r)) * 0.28)
  })
  const onLog = ({ message }: { message: string }) => {
    logs.push(message)
  }
  const progressHandler = ({ progress }: { progress: number }) => {
    const ratio = Number.isFinite(progress) ? progress : 0
    opts.onProgress?.(Math.max(0.05, Math.min(0.99, ratio)))
  }
  ff.on('log', onLog)
  ff.on('progress', progressHandler)

  const ext = extOf(opts.file.name)
  const inExt = ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(ext) ? ext : 'mp4'
  const stem = safeStem(opts.file.name)
  const stamp = Date.now()
  // Keep a real media extension so the demuxer recognizes the file.
  const inName = `mute_in_${stamp}.${inExt}`
  const copyOut = `mute_copy_${stamp}.mp4`
  const encOut = `mute_enc_${stamp}.mp4`

  const cleanup = async (names: string[]) => {
    for (const n of names) {
      try {
        await ff.deleteFile(n)
      } catch {
        /* ignore */
      }
    }
  }

  try {
    opts.onPhase?.('write')
    await ff.writeFile(inName, await fetchFile(opts.file))
    opts.onProgress?.(0.06)

    opts.onPhase?.('mute')
    // Fast remux: video only → mp4
    const copyCode = await ff.exec([
      '-hide_banner',
      '-y',
      '-i',
      inName,
      '-map',
      '0:v:0',
      '-c:v',
      'copy',
      '-an',
      '-sn',
      '-dn',
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      copyOut,
    ])

    let outName: string | null = null
    if (copyCode === 0 && (await fileExists(ff, copyOut))) {
      const hasAudio = await outputHasAudio(ff, copyOut)
      if (!hasAudio) outName = copyOut
    }

    if (!outName) {
      await cleanup([copyOut])
      opts.onPhase?.('encode')
      opts.onProgress?.(0.1)
      // Reliable path: re-encode video, drop audio.
      const encCode = await ff.exec([
        '-hide_banner',
        '-y',
        '-i',
        inName,
        '-map',
        '0:v:0',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-an',
        '-sn',
        '-dn',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        encOut,
      ])
      if (encCode !== 0) {
        const tip = logs.filter((l) => /error|invalid|fail/i.test(l)).slice(-4).join(' | ')
        throw new Error(tip || `FFmpeg exit ${encCode}`)
      }
      if (!(await fileExists(ff, encOut))) {
        throw new Error('编码后未生成文件')
      }
      const hasAudio = await outputHasAudio(ff, encOut)
      if (hasAudio) {
        throw new Error('静音失败：输出仍包含音轨')
      }
      outName = encOut
    }

    const bytes = await readOutput(ff, outName)
    opts.onProgress?.(1)
    return {
      blob: toBlob(bytes, mimeForExt('mp4')),
      fileName: `${stem}_muted.mp4`,
    }
  } finally {
    ff.off('log', onLog)
    ff.off('progress', progressHandler)
    await cleanup([inName, copyOut, encOut])
  }
}

export { downloadBlob }
