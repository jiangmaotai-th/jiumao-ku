export type TaskStatus =
  | 'idle'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'

export type BitrateMode = 'auto' | 'bitrate' | 'crf' | 'copy'
export type AspectMode = 'keep' | 'stretch' | 'crop'
export type AppMode = 'convert' | 'compress' | 'music' | 'merge' | 'extract'
export type ExtractMode = 'audio' | 'gif' | 'cover'
export type WatermarkPosition = 'tl' | 'tr' | 'bl' | 'br' | 'center'
export type CompressMode = 'standard' | 'highQuality' | 'maxCompress'

export interface OutputProfile {
  container: string
  videoCodec?: string | null
  audioCodec?: string | null
  width?: number | null
  height?: number | null
  frameRate?: number | null
  bitrateMode: BitrateMode
  videoBitrateKbps?: number | null
  crf?: number | null
  audioBitrateKbps?: number | null
  sampleRate?: number | null
  channels?: number | null
  aspectMode: AspectMode
  keepOriginalResolution: boolean
  keepOriginalFrameRate: boolean
  keepOriginalAudio: boolean
  maxDurationSecs?: number | null
  platformId?: string | null
  trimStartSecs?: number | null
  trimEndSecs?: number | null
  rotateDegrees?: number | null
  hFlip?: boolean | null
  vFlip?: boolean | null
  watermarkEnabled?: boolean | null
  watermarkText?: string | null
  watermarkPosition?: WatermarkPosition | null
  loudnormEnabled?: boolean | null
  sellerLoopFriendly?: boolean | null
  sellerLoudnorm?: boolean | null
  extractMode?: ExtractMode | null
  outputNameSuffix?: string | null
}

export interface MediaMeta {
  fileName: string
  fileSize: number
  durationSecs?: number
  width?: number
  height?: number
  hasVideo: boolean
  hasAudio: boolean
  previewUrl: string
}

export interface JobItem {
  id: string
  file: File
  /** Source media (before convert). */
  meta: MediaMeta
  profile: OutputProfile
  status: TaskStatus
  progress: number
  error?: string
  outputBlob?: Blob
  outputName?: string
  /** Result media — shown in the list after success. */
  outputMeta?: MediaMeta
}

export function defaultVideoProfile(): OutputProfile {
  return {
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    width: null,
    height: null,
    frameRate: null,
    bitrateMode: 'crf',
    videoBitrateKbps: null,
    crf: 23,
    audioBitrateKbps: 192,
    sampleRate: null,
    channels: null,
    aspectMode: 'keep',
    keepOriginalResolution: true,
    keepOriginalFrameRate: true,
    keepOriginalAudio: false,
    maxDurationSecs: null,
    platformId: null,
    trimStartSecs: null,
    trimEndSecs: null,
    rotateDegrees: 0,
    hFlip: false,
    vFlip: false,
    watermarkEnabled: false,
    watermarkText: null,
    watermarkPosition: 'br',
    loudnormEnabled: false,
    sellerLoopFriendly: false,
    sellerLoudnorm: false,
    extractMode: null,
    outputNameSuffix: null,
  }
}

export function defaultMusicProfile(): OutputProfile {
  return {
    ...defaultVideoProfile(),
    container: 'mp3',
    videoCodec: null,
    audioCodec: 'libmp3lame',
    bitrateMode: 'bitrate',
    crf: null,
    audioBitrateKbps: 192,
    keepOriginalResolution: true,
  }
}

export function defaultCompressProfile(container = 'mp4'): OutputProfile {
  return {
    ...defaultVideoProfile(),
    container,
    bitrateMode: 'crf',
    crf: 28,
    videoBitrateKbps: null,
    keepOriginalResolution: true,
    keepOriginalFrameRate: true,
  }
}
