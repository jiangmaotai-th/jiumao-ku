import type { OutputProfile } from '../types'
import { defaultVideoProfile } from '../types'

export interface PlatformPreset {
  id: string
  label: string
  category: 'social' | 'seller' | 'audio'
  profile: OutputProfile
}

function vp(
  label: string,
  id: string,
  category: PlatformPreset['category'],
  partial: Partial<OutputProfile> & { width: number; height: number; videoBitrateKbps: number },
): PlatformPreset {
  return {
    id,
    label,
    category,
    profile: {
      ...defaultVideoProfile(),
      ...partial,
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      bitrateMode: 'bitrate',
      keepOriginalResolution: false,
      // Match source fps when possible; platforms accept 24–60.
      keepOriginalFrameRate: partial.keepOriginalFrameRate ?? true,
      frameRate: partial.frameRate ?? null,
      audioBitrateKbps: partial.audioBitrateKbps ?? 192,
      sampleRate: 48000,
      channels: 2,
      platformId: id,
      // Keep full frame: scale + letterbox/pillarbox into platform canvas (no auto-crop).
      aspectMode: partial.aspectMode ?? 'keep',
      sellerLoopFriendly: category === 'seller',
      sellerLoudnorm: category === 'seller',
    },
  }
}

export type PlatformShellKind =
  | 'xhs'
  | 'douyin'
  | 'reels'
  | 'shorts'
  | 'wechat'
  | 'youtube'
  | 'feed'
  | 'desktop'
  | 'shop'

/** Visual chrome for platform publish preview (not the encode profile itself). */
export function platformShellKind(platformId: string): PlatformShellKind {
  if (platformId.includes('xiaohongshu')) return 'xhs'
  if (platformId === 'douyin' || platformId === 'kuaishou' || platformId === 'tiktok' || platformId === 'weibo') {
    return 'douyin'
  }
  if (platformId === 'instagram-reels' || platformId === 'facebook-reels' || platformId === 'pinterest-video') {
    return 'reels'
  }
  if (platformId === 'youtube-shorts') return 'shorts'
  if (platformId === 'wechat-channels') return 'wechat'
  if (platformId.startsWith('youtube')) return 'youtube'
  if (
    platformId === 'instagram-feed' ||
    platformId === 'instagram-square' ||
    platformId === 'linkedin-video'
  ) {
    return 'feed'
  }
  if (platformId === 'toutiao') return 'desktop'
  if (platformId.includes('seller') || platformId.startsWith('taobao') || platformId.startsWith('jd')) {
    return 'shop'
  }
  return 'douyin'
}

export function isPhoneShell(shell: PlatformShellKind): boolean {
  return shell === 'xhs' || shell === 'douyin' || shell === 'reels' || shell === 'shorts' || shell === 'wechat'
}

/**
 * Platform export targets (2025–2026 common recommendations):
 * vertical short-form → 1080×1920 H.264 ~10–12 Mbps AAC 192k
 * YouTube long-form → 1080p ~8 Mbps / 4K ~40 Mbps AAC 320–384k
 * Aspect: keep + pad (full video). Crop is left to the user if they want it.
 */
export const PLATFORM_PRESETS: PlatformPreset[] = [
  vp('YouTube 1080p', 'youtube-1080', 'social', {
    width: 1920,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 320,
  }),
  vp('YouTube 4K', 'youtube-4k', 'social', {
    width: 3840,
    height: 2160,
    videoBitrateKbps: 40000,
    audioBitrateKbps: 384,
  }),
  vp('YouTube Shorts', 'youtube-shorts', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    maxDurationSecs: 60,
  }),
  vp('Instagram Reels', 'instagram-reels', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    maxDurationSecs: 90,
    frameRate: 30,
    keepOriginalFrameRate: false,
  }),
  vp('Instagram Feed', 'instagram-feed', 'social', {
    width: 1080,
    height: 1350,
    videoBitrateKbps: 10000,
  }),
  vp('Instagram Square', 'instagram-square', 'social', {
    width: 1080,
    height: 1080,
    videoBitrateKbps: 10000,
  }),
  vp('TikTok', 'tiktok', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
  }),
  vp('Douyin', 'douyin', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
  }),
  vp('Xiaohongshu', 'xiaohongshu', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
  }),
  vp('Kuaishou', 'kuaishou', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
  }),
  vp('Toutiao', 'toutiao', 'social', {
    width: 1920,
    height: 1080,
    videoBitrateKbps: 10000,
  }),
  vp('Weibo', 'weibo', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
  }),
  vp('Facebook Reels', 'facebook-reels', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
    maxDurationSecs: 90,
  }),
  vp('LinkedIn', 'linkedin-video', 'social', {
    width: 1920,
    height: 1080,
    videoBitrateKbps: 10000,
  }),
  vp('Pinterest', 'pinterest-video', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
  }),
  vp('WeChat Channels', 'wechat-channels', 'social', {
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
  }),
  vp('Taobao Seller', 'taobao-seller', 'seller', {
    width: 1080,
    height: 1080,
    videoBitrateKbps: 8000,
    maxDurationSecs: 60,
  }),
  vp('JD Seller', 'jd-seller', 'seller', {
    width: 1080,
    height: 1080,
    videoBitrateKbps: 8000,
    maxDurationSecs: 60,
  }),
  vp('Xiaohongshu Seller', 'xiaohongshu-seller', 'seller', {
    width: 1080,
    height: 1440,
    videoBitrateKbps: 10000,
    maxDurationSecs: 60,
  }),
]

export const VIDEO_CONTAINERS = ['mp4', 'mov', 'webm', 'mkv', 'avi'] as const
/** Convert formats — order/grouping differs from typical competitor ladders. */
export const CONVERT_VIDEO_CONTAINERS = [
  'mov',
  'mp4',
  'm4v',
  'mkv',
  'ts',
  'webm',
  'avi',
  'flv',
  'wmv',
  '3gp',
  'mpg',
] as const

export const CONVERT_FORMAT_GROUPS: {
  id: 'common' | 'other'
  items: readonly (typeof CONVERT_VIDEO_CONTAINERS)[number][]
}[] = [
  { id: 'common', items: ['mov', 'mp4', 'm4v', 'mkv'] },
  { id: 'other', items: ['ts', 'webm', 'avi', 'flv', 'wmv', '3gp', 'mpg'] },
]

export const AUDIO_CONTAINERS = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'] as const

/** Codec order: efficiency-first, not the usual H.264→H.265→VP9→AV1 row. */
export const CONVERT_VIDEO_CODECS = [
  { id: 'h265', label: 'H.265', ffmpeg: 'libx265' },
  { id: 'av1', label: 'AV1', ffmpeg: 'libaom-av1' },
  { id: 'h264', label: 'H.264', ffmpeg: 'libx264' },
  { id: 'vp9', label: 'VP9', ffmpeg: 'libvpx-vp9' },
] as const

export const CONVERT_AUDIO_CODECS = [
  { id: 'mp3', label: 'MP3', ffmpeg: 'libmp3lame' },
  { id: 'opus', label: 'Opus', ffmpeg: 'libopus' },
  { id: 'aac', label: 'AAC', ffmpeg: 'aac' },
  { id: 'vorbis', label: 'Vorbis', ffmpeg: 'libvorbis' },
  { id: 'flac', label: 'FLAC', ffmpeg: 'flac' },
  { id: 'pcm', label: 'PCM / WAV', ffmpeg: 'pcm_s16le' },
] as const

/** Audio codecs usable inside WebM. */
export const WEBM_AUDIO_CODEC_IDS = new Set(['opus', 'vorbis'])

export const CONVERT_AUDIO_BITRATE_OPTIONS = [
  64, 96, 128, 160, 192, 256, 320,
] as const

export function convertVideoCodecId(ffmpegCodec?: string | null): (typeof CONVERT_VIDEO_CODECS)[number]['id'] {
  const vc = ffmpegCodec || ''
  if (vc.includes('x265') || vc.includes('hevc')) return 'h265'
  if (vc.includes('vp9') || vc.includes('vpx')) return 'vp9'
  if (vc.includes('aom') || vc.includes('av1') || vc.includes('svt')) return 'av1'
  return 'h264'
}

export function convertAudioCodecId(ffmpegCodec?: string | null): (typeof CONVERT_AUDIO_CODECS)[number]['id'] {
  const ac = ffmpegCodec || ''
  if (ac.includes('mp3') || ac.includes('lame')) return 'mp3'
  if (ac.includes('opus')) return 'opus'
  if (ac.includes('vorbis')) return 'vorbis'
  if (ac.includes('flac')) return 'flac'
  if (ac.includes('pcm')) return 'pcm'
  return 'aac'
}

function formatBitrateLabel(kbps: number): string {
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(kbps % 1000 === 0 ? 0 : 1)} Mbps` : `${kbps} kbps`
}

/** Video bitrate ladder: fixed commons + source-relative steps (ascending). */
export function convertBitrateOptions(sourceMbps: number | null): {
  kbps: number
  label: string
  isSource: boolean
}[] {
  const baseMbps = sourceMbps && sourceMbps > 0 ? sourceMbps : 2.5
  const sourceKbps = Math.max(100, Math.round(baseMbps * 1000))
  const ratios = [0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85, 1, 1.25]
  const fixed = [300, 500, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000]
  const values = new Set<number>()

  for (const kbps of fixed) values.add(kbps)
  for (const ratio of ratios) {
    values.add(Math.max(100, Math.round(sourceKbps * ratio)))
  }
  values.add(sourceKbps)

  return [...values]
    .sort((a, b) => a - b)
    .map((kbps) => ({
      kbps,
      label: formatBitrateLabel(kbps),
      isSource: kbps === sourceKbps,
    }))
}

export function audioCodecFor(container: string): string {
  switch (container) {
    case 'mp3':
      return 'libmp3lame'
    case 'ogg':
      return 'libvorbis'
    case 'flac':
      return 'flac'
    case 'wav':
      return 'pcm_s16le'
    case 'aac':
    case 'm4a':
      return 'aac'
    default:
      return 'aac'
  }
}

export function videoCodecFor(container: string): string {
  if (container === 'webm') return 'libvpx-vp9'
  if (container === 'mpg' || container === 'mpeg') return 'mpeg2video'
  if (container === '3gp') return 'libx264'
  return 'libx264'
}
