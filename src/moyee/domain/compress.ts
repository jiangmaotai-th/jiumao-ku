import type { OutputProfile } from '../types'

export type CompressStrategy = 'quality' | 'targetSize'
export type CompressCodecId = 'h264' | 'h265' | 'vp9' | 'av1'
export type CompressResId = 'original' | '2160' | '1080' | '720' | '480' | '360' | '240'

export const COMPRESS_CODECS: {
  id: CompressCodecId
  label: string
  ffmpeg: string
  preferredContainer: string
  /** Relative size vs H.264 at same quality (lower = smaller). */
  sizeFactor: number
}[] = [
  { id: 'h264', label: 'H.264', ffmpeg: 'libx264', preferredContainer: 'mp4', sizeFactor: 1 },
  { id: 'h265', label: 'H.265', ffmpeg: 'libx265', preferredContainer: 'mp4', sizeFactor: 0.65 },
  { id: 'vp9', label: 'VP9', ffmpeg: 'libvpx-vp9', preferredContainer: 'webm', sizeFactor: 0.7 },
  { id: 'av1', label: 'AV1', ffmpeg: 'libaom-av1', preferredContainer: 'webm', sizeFactor: 0.55 },
]

export const COMPRESS_RESOLUTIONS: { id: CompressResId; maxEdge: number | null }[] = [
  { id: 'original', maxEdge: null },
  { id: '2160', maxEdge: 2160 },
  { id: '1080', maxEdge: 1080 },
  { id: '720', maxEdge: 720 },
  { id: '480', maxEdge: 480 },
  { id: '360', maxEdge: 360 },
  { id: '240', maxEdge: 240 },
]

export function codecIdFromProfile(profile: OutputProfile): CompressCodecId {
  const vc = profile.videoCodec || ''
  if (vc.includes('x265') || vc.includes('hevc')) return 'h265'
  if (vc.includes('vp9') || vc.includes('vpx')) return 'vp9'
  if (vc.includes('aom') || vc.includes('av1') || vc.includes('svt')) return 'av1'
  return 'h264'
}

export function resolutionIdFromProfile(profile: OutputProfile): CompressResId {
  if (profile.keepOriginalResolution || !profile.height) return 'original'
  const h = profile.height
  if (h >= 2000) return '2160'
  if (h >= 1000) return '1080'
  if (h >= 700) return '720'
  if (h >= 460) return '480'
  if (h >= 300) return '360'
  return '240'
}

function even(n: number): number {
  const v = Math.max(2, Math.round(n))
  return v % 2 === 0 ? v : v - 1
}

/** Scale so the shorter edge matches the preset (like 1080p / 720p). */
export function sizedForResolution(
  srcW: number,
  srcH: number,
  resId: CompressResId,
): { width: number; height: number; keepOriginal: boolean } {
  if (resId === 'original' || !srcW || !srcH) {
    return { width: srcW || 0, height: srcH || 0, keepOriginal: true }
  }
  const preset = COMPRESS_RESOLUTIONS.find((r) => r.id === resId)
  const maxEdge = preset?.maxEdge
  if (!maxEdge) return { width: srcW, height: srcH, keepOriginal: true }

  const short = Math.min(srcW, srcH)
  if (short <= maxEdge) {
    return { width: even(srcW), height: even(srcH), keepOriginal: true }
  }
  const scale = maxEdge / short
  return {
    width: even(srcW * scale),
    height: even(srcH * scale),
    keepOriginal: false,
  }
}

export function applyCompressCodec(profile: OutputProfile, codecId: CompressCodecId): OutputProfile {
  const codec = COMPRESS_CODECS.find((c) => c.id === codecId) ?? COMPRESS_CODECS[0]
  const keepContainer =
    (codecId === 'h264' || codecId === 'h265') &&
    ['mp4', 'mov', 'mkv'].includes(profile.container)
  return {
    ...profile,
    videoCodec: codec.ffmpeg,
    container: keepContainer ? profile.container : codec.preferredContainer,
    audioCodec: codec.preferredContainer === 'webm' ? 'libopus' : 'aac',
  }
}

export function applyCompressResolution(
  profile: OutputProfile,
  resId: CompressResId,
  srcW?: number,
  srcH?: number,
): OutputProfile {
  if (!srcW || !srcH || resId === 'original') {
    return {
      ...profile,
      keepOriginalResolution: true,
      width: null,
      height: null,
    }
  }
  const sized = sizedForResolution(srcW, srcH, resId)
  if (sized.keepOriginal) {
    return {
      ...profile,
      keepOriginalResolution: true,
      width: null,
      height: null,
    }
  }
  return {
    ...profile,
    keepOriginalResolution: false,
    width: sized.width,
    height: sized.height,
    aspectMode: 'keep',
  }
}

export function sourceBitrateMbps(fileSize: number, durationSecs?: number): number | null {
  if (!durationSecs || durationSecs <= 0 || fileSize <= 0) return null
  return (fileSize * 8) / durationSecs / 1_000_000
}

/** Typical H.264 ladder bitrate (Mbps) at 1080p for each quality preset. */
const PRESET_BITRATE_1080P_MBPS: Record<'highQuality' | 'standard' | 'maxCompress', number> = {
  highQuality: 8,
  standard: 4,
  maxCompress: 1.2,
}

export const COMPRESS_MODE_ORDER: Array<'highQuality' | 'standard' | 'maxCompress'> = [
  'highQuality',
  'standard',
  'maxCompress',
]

/** Expected bitrate for a preset at the given frame size. */
export function presetTargetBitrateMbps(
  mode: 'highQuality' | 'standard' | 'maxCompress',
  width?: number,
  height?: number,
): number {
  const w = width && width > 0 ? width : 1280
  const h = height && height > 0 ? height : 720
  const scale = (w * h) / (1920 * 1080)
  return Math.max(0.25, PRESET_BITRATE_1080P_MBPS[mode] * scale)
}

/**
 * A preset is unavailable when the source is already softer than that tier —
 * recompressing at a “higher” ladder would not improve quality and often grows the file.
 */
export function isCompressPresetAvailable(
  mode: 'highQuality' | 'standard' | 'maxCompress',
  sourceMbps: number | null,
  width?: number,
  height?: number,
): boolean {
  if (mode === 'maxCompress') return true
  if (sourceMbps == null || sourceMbps <= 0) return true
  const target = presetTargetBitrateMbps(mode, width, height)
  return sourceMbps + 0.05 >= target
}

export function firstAvailableCompressMode(
  sourceMbps: number | null,
  width?: number,
  height?: number,
): 'highQuality' | 'standard' | 'maxCompress' {
  for (const mode of COMPRESS_MODE_ORDER) {
    if (isCompressPresetAvailable(mode, sourceMbps, width, height)) return mode
  }
  return 'maxCompress'
}

export function effectiveDurationSecs(
  durationSecs: number | undefined,
  trimStart?: number | null,
  trimEnd?: number | null,
): number | undefined {
  if (!durationSecs || durationSecs <= 0) return durationSecs
  const start = Math.max(0, trimStart ?? 0)
  const end = trimEnd != null && trimEnd > start ? trimEnd : durationSecs
  return Math.max(0.1, end - start)
}

export type TargetSizeIssue = 'empty' | 'tooLarge' | 'tooSmall' | null

/** Lowest total bitrate that can still look acceptable even at 240p. */
const MIN_ACCEPTABLE_TOTAL_KBPS = 280

export function minTargetMbForQuality(
  originalBytes: number,
  durationSecs?: number,
): number {
  const originalMb = originalBytes / (1024 * 1024)
  if (durationSecs && durationSecs > 0) {
    const fromBitrate =
      ((MIN_ACCEPTABLE_TOTAL_KBPS * 1000) / 8) * durationSecs / (1024 * 1024)
    // Cap below original; keep a usable floor for very short clips.
    return Math.min(originalMb * 0.92, Math.max(0.15, fromBitrate))
  }
  // No duration: require at least ~12% of original to avoid absurd targets.
  return Math.max(0.15, originalMb * 0.12)
}

export function validateTargetMb(
  targetMb: number | null | undefined,
  originalBytes: number,
  durationSecs?: number,
): { ok: boolean; issue: TargetSizeIssue; originalMb: number; minMb: number } {
  const originalMb = originalBytes / (1024 * 1024)
  const minMb = minTargetMbForQuality(originalBytes, durationSecs)

  if (targetMb == null || !Number.isFinite(targetMb)) {
    return { ok: false, issue: 'empty', originalMb, minMb }
  }
  if (targetMb >= originalMb - 0.01) {
    return { ok: false, issue: 'tooLarge', originalMb, minMb }
  }
  if (targetMb < minMb - 0.001) {
    return { ok: false, issue: 'tooSmall', originalMb, minMb }
  }
  return { ok: true, issue: null, originalMb, minMb }
}

export function targetVideoBitrateKbps(
  targetMb: number,
  durationSecs: number,
  audioBitrateKbps = 128,
): number {
  const totalKbps = (targetMb * 1024 * 1024 * 8) / durationSecs / 1000
  return Math.max(80, Math.round(totalKbps - audioBitrateKbps))
}

export function estimateCompressBytes(opts: {
  originalBytes: number
  strategy: CompressStrategy
  targetMb?: number | null
  crf: number
  quality: number
  mode: 'standard' | 'highQuality' | 'maxCompress'
  codecId: CompressCodecId
  resId: CompressResId
  durationSecs?: number
  width?: number
  height?: number
}): { bytes: number; low: number; high: number } {
  const original = opts.originalBytes
  if (original <= 0) return { bytes: 0, low: 0, high: 0 }

  if (opts.strategy === 'targetSize' && opts.targetMb != null && opts.targetMb > 0) {
    const bytes = Math.round(opts.targetMb * 1024 * 1024)
    return {
      bytes: Math.min(original, bytes),
      low: Math.round(Math.min(original, bytes) * 0.92),
      high: Math.round(Math.min(original, bytes) * 1.08),
    }
  }

  const q = Math.min(100, Math.max(0, opts.quality)) / 100
  const midRatio =
    opts.mode === 'highQuality' ? 0.78 : opts.mode === 'maxCompress' ? 0.3 : 0.5
  const maxRatio = 0.98
  const minRatio = Math.max(0.06, midRatio * 0.4)

  let ratio: number
  if (q >= 0.5) {
    const t = (q - 0.5) / 0.5
    ratio = midRatio + (maxRatio - midRatio) * t
  } else {
    const t = q / 0.5
    ratio = minRatio + (midRatio - minRatio) * t
  }

  const crf = Math.min(36, Math.max(18, opts.crf))
  const crfBias = Math.pow(2, (28 - crf) / 12)
  ratio = Math.min(maxRatio, Math.max(minRatio, ratio * (0.85 + 0.15 * Math.min(1.3, crfBias))))

  const codec = COMPRESS_CODECS.find((c) => c.id === opts.codecId) ?? COMPRESS_CODECS[0]
  ratio *= codec.sizeFactor

  const srcPixels = (opts.width || 1280) * (opts.height || 720)
  const out =
    opts.resId === 'original' || !opts.width || !opts.height
      ? { width: opts.width || 1280, height: opts.height || 720, keepOriginal: true }
      : sizedForResolution(opts.width, opts.height, opts.resId)
  const outPixels = Math.max(1, out.width * out.height)
  ratio *= Math.min(1, Math.max(0.12, outPixels / srcPixels))

  let estimate = original * ratio
  const duration = opts.durationSecs
  if (duration && duration > 0 && out.width && out.height) {
    const vsCrf23 = Math.pow(2, (23 - crf) / 6)
    const videoMbps = Math.max(
      0.15,
      5 * (outPixels / (1920 * 1080)) * vsCrf23 * codec.sizeFactor,
    )
    const bitrateBytes = (((videoMbps + 0.128) * 1_000_000) / 8) * duration
    estimate = Math.min(estimate, bitrateBytes)
  }

  estimate = Math.min(original * maxRatio, Math.max(original * minRatio * codec.sizeFactor, estimate))
  const bytes = Math.round(estimate)
  return {
    bytes,
    low: Math.round(Math.max(original * 0.05, bytes * 0.88)),
    high: Math.round(Math.min(original, bytes * 1.12)),
  }
}
