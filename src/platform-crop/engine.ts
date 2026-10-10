import { fetchFile } from '@ffmpeg/util'
import { downloadBlob, getFfmpeg, type ProgressCb } from '../moyee/engine/ffmpegEngine'
import type { CropRect } from './presets'

function even(n: number): number {
  const v = Math.max(2, Math.round(n))
  return v % 2 === 0 ? v : v - 1
}

export interface CropExportOptions {
  file: File
  /** Normalized crop in source video space */
  crop: CropRect
  videoWidth: number
  videoHeight: number
  outWidth: number
  outHeight: number
  container: 'mp4' | 'mov' | 'webm'
  videoBitrateKbps: number
  audioBitrateKbps: number
  onProgress?: ProgressCb
}

export async function runCropExport(
  opts: CropExportOptions,
): Promise<{ blob: Blob; fileName: string }> {
  const ff = await getFfmpeg()
  const progressHandler = ({ progress }: { progress: number }) => {
    opts.onProgress?.(Math.max(0, Math.min(1, progress)))
  }
  ff.on('progress', progressHandler)

  const stem = opts.file.name.replace(/\.[^.]+$/, '') || 'video'
  const safeStem = stem.replace(/[^\w.\u4e00-\u9fff-]+/g, '_').slice(0, 80)
  const inName = `in_${Date.now()}_${safeStem}`
  const outName = `${safeStem}_crop.${opts.container}`

  const vw = opts.videoWidth
  const vh = opts.videoHeight
  let cw = even(opts.crop.w * vw)
  let ch = even(opts.crop.h * vh)
  let cx = even(opts.crop.x * vw)
  let cy = even(opts.crop.y * vh)
  // Keep crop inside frame
  if (cx + cw > vw) cx = Math.max(0, vw - cw)
  if (cy + ch > vh) cy = Math.max(0, vh - ch)
  cw = Math.min(cw, vw - cx)
  ch = Math.min(ch, vh - cy)
  cw = even(Math.max(2, cw))
  ch = even(Math.max(2, ch))

  const ow = even(opts.outWidth)
  const oh = even(opts.outHeight)
  const vf = `crop=${cw}:${ch}:${cx}:${cy},scale=${ow}:${oh}:flags=lanczos`

  const videoCodec = opts.container === 'webm' ? 'libvpx-vp9' : 'libx264'
  const audioCodec = opts.container === 'webm' ? 'libopus' : 'aac'

  const args = [
    '-hide_banner',
    '-y',
    '-i',
    inName,
    '-vf',
    vf,
    '-c:v',
    videoCodec,
    '-b:v',
    `${opts.videoBitrateKbps}k`,
    '-c:a',
    audioCodec,
    '-b:a',
    `${opts.audioBitrateKbps}k`,
  ]
  if (opts.container === 'mp4' || opts.container === 'mov') {
    args.push('-movflags', '+faststart')
  }
  args.push(outName)

  try {
    await ff.writeFile(inName, await fetchFile(opts.file))
    const code = await ff.exec(args)
    if (code !== 0) throw new Error(`FFmpeg exit ${code}`)
    const data = await ff.readFile(outName)
    const bytes =
      data instanceof Uint8Array
        ? Uint8Array.from(data)
        : new TextEncoder().encode(String(data))
    const mime =
      opts.container === 'webm'
        ? 'video/webm'
        : opts.container === 'mov'
          ? 'video/quicktime'
          : 'video/mp4'
    return { blob: new Blob([bytes], { type: mime }), fileName: outName }
  } finally {
    ff.off('progress', progressHandler)
    for (const n of [inName, outName]) {
      try {
        await ff.deleteFile(n)
      } catch {
        /* ignore */
      }
    }
  }
}

export { downloadBlob }
