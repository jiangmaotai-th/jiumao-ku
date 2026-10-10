export type CropRect = { x: number; y: number; w: number; h: number }

export type PresetGroup = 'platform' | 'standard'

export interface PlatformCropPreset {
  id: string
  /** Display name key suffix under platformCrop.preset.* */
  nameKey: string
  group: PresetGroup
  /** null = free / unlocked aspect */
  aspect: number | null
  /** Target export size; ignored for free until derived from crop */
  width: number | null
  height: number | null
  videoBitrateKbps: number
  audioBitrateKbps: number
  container: 'mp4' | 'mov' | 'webm'
  /** Simple mark for dropdown (emoji / letter) */
  mark: string
}

export const PLATFORM_CROP_PRESETS: PlatformCropPreset[] = [
  {
    id: 'free',
    nameKey: 'free',
    group: 'platform',
    aspect: null,
    width: null,
    height: null,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '✥',
  },
  {
    id: 'youtube',
    nameKey: 'youtube',
    group: 'platform',
    aspect: 16 / 9,
    width: 1920,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 320,
    container: 'mp4',
    mark: '▶',
  },
  {
    id: 'youtube-shorts',
    nameKey: 'youtubeShorts',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '▶',
  },
  {
    id: 'tiktok',
    nameKey: 'tiktok',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '♪',
  },
  {
    id: 'douyin',
    nameKey: 'douyin',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '抖',
  },
  {
    id: 'kuaishou',
    nameKey: 'kuaishou',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '快',
  },
  {
    id: 'xiaohongshu',
    nameKey: 'xiaohongshu',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '红',
  },
  {
    id: 'wechat-channels',
    nameKey: 'wechatChannels',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '号',
  },
  {
    id: 'weibo',
    nameKey: 'weibo',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '博',
  },
  {
    id: 'taobao',
    nameKey: 'taobao',
    group: 'platform',
    aspect: 1,
    width: 1080,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '淘',
  },
  {
    id: 'taobao-portrait',
    nameKey: 'taobaoPortrait',
    group: 'platform',
    aspect: 3 / 4,
    width: 1080,
    height: 1440,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '淘',
  },
  {
    id: 'instagram-post',
    nameKey: 'instagramPost',
    group: 'platform',
    aspect: 4 / 5,
    width: 1080,
    height: 1350,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '◎',
  },
  {
    id: 'instagram-story',
    nameKey: 'instagramStory',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '◎',
  },
  {
    id: 'instagram-reel',
    nameKey: 'instagramReel',
    group: 'platform',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '◎',
  },
  {
    id: 'linkedin',
    nameKey: 'linkedin',
    group: 'platform',
    aspect: 16 / 9,
    width: 1920,
    height: 1080,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: 'in',
  },
  {
    id: 'x',
    nameKey: 'x',
    group: 'platform',
    aspect: 1,
    width: 1080,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '𝕏',
  },
  {
    id: 'std-16-9',
    nameKey: 'std169',
    group: 'standard',
    aspect: 16 / 9,
    width: 1920,
    height: 1080,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '▭',
  },
  {
    id: 'std-9-16',
    nameKey: 'std916',
    group: 'standard',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '▮',
  },
  {
    id: 'std-1-1',
    nameKey: 'std11',
    group: 'standard',
    aspect: 1,
    width: 1080,
    height: 1080,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '□',
  },
  {
    id: 'std-4-5',
    nameKey: 'std45',
    group: 'standard',
    aspect: 4 / 5,
    width: 1080,
    height: 1350,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '▯',
  },
  {
    id: 'std-3-4',
    nameKey: 'std34',
    group: 'standard',
    aspect: 3 / 4,
    width: 1080,
    height: 1440,
    videoBitrateKbps: 10000,
    audioBitrateKbps: 192,
    container: 'mp4',
    mark: '▯',
  },
]

export function presetById(id: string): PlatformCropPreset {
  return PLATFORM_CROP_PRESETS.find((p) => p.id === id) ?? PLATFORM_CROP_PRESETS[0]
}

/** Pick a sensible default platform from source dimensions. */
export function autoPresetId(width: number, height: number): string {
  if (!width || !height) return 'youtube'
  const r = width / height
  if (r > 1.2) return 'youtube'
  if (r < 0.85) return 'douyin'
  return 'instagram-post'
}

/** Largest centered rect of given aspect inside the video (normalized 0–1). */
export function maxInscribedRect(
  videoW: number,
  videoH: number,
  aspect: number | null,
): CropRect {
  if (!videoW || !videoH) return { x: 0, y: 0, w: 1, h: 1 }
  if (aspect == null || aspect <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 }
  }
  const videoAspect = videoW / videoH
  if (videoAspect > aspect) {
    // video wider → letterbox sides
    const w = aspect / videoAspect
    return { x: (1 - w) / 2, y: 0, w, h: 1 }
  }
  const h = videoAspect / aspect
  return { x: 0, y: (1 - h) / 2, w: 1, h }
}

export function aspectLabel(aspect: number | null): string {
  if (aspect == null) return '—'
  const pairs: [number, string][] = [
    [16 / 9, '16:9'],
    [9 / 16, '9:16'],
    [1, '1:1'],
    [4 / 5, '4:5'],
    [3 / 4, '3:4'],
    [4 / 3, '4:3'],
    [3 / 5, '3:5'],
  ]
  for (const [a, label] of pairs) {
    if (Math.abs(a - aspect) < 0.02) return label
  }
  return aspect > 1 ? `${aspect.toFixed(2)}:1` : `1:${(1 / aspect).toFixed(2)}`
}

function even(n: number): number {
  const v = Math.max(2, Math.round(n))
  return v % 2 === 0 ? v : v - 1
}

/** Derive export WxH from preset + crop pixels. */
export function resolveOutputSize(
  preset: PlatformCropPreset,
  crop: CropRect,
  videoW: number,
  videoH: number,
  maxEdgeOverride?: number,
): { width: number; height: number } {
  if (preset.width && preset.height) {
    return { width: even(preset.width), height: even(preset.height) }
  }
  const cw = Math.max(2, crop.w * videoW)
  const ch = Math.max(2, crop.h * videoH)
  const maxEdge = maxEdgeOverride ?? 1080
  const long = Math.max(cw, ch)
  const scale = long > maxEdge ? maxEdge / long : 1
  return { width: even(cw * scale), height: even(ch * scale) }
}

export const CONTAINERS = ['mp4', 'mov', 'webm'] as const
export const BITRATE_OPTIONS = [4000, 6000, 8000, 10000, 12000, 16000, 20000] as const
export const MAX_EDGE_OPTIONS = [720, 1080, 1440, 1920, 2160] as const
