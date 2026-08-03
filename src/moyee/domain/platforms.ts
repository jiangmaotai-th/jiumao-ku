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
      keepOriginalFrameRate: true,
      audioBitrateKbps: partial.audioBitrateKbps ?? 256,
      sampleRate: 48000,
      channels: 2,
      platformId: id,
      aspectMode: category === 'seller' ? 'crop' : (partial.aspectMode ?? 'keep'),
      sellerLoopFriendly: category === 'seller',
      sellerLoudnorm: category === 'seller',
    },
  }
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  vp('YouTube 1080p', 'youtube-1080', 'social', { width: 1920, height: 1080, videoBitrateKbps: 8000, audioBitrateKbps: 384 }),
  vp('YouTube 4K', 'youtube-4k', 'social', { width: 3840, height: 2160, videoBitrateKbps: 20000, audioBitrateKbps: 384 }),
  vp('YouTube Shorts', 'youtube-shorts', 'social', { width: 1080, height: 1920, videoBitrateKbps: 8000, maxDurationSecs: 60 }),
  vp('Instagram Reels', 'instagram-reels', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5200, maxDurationSecs: 90 }),
  vp('Instagram Feed', 'instagram-feed', 'social', { width: 1080, height: 1350, videoBitrateKbps: 5000 }),
  vp('Instagram Square', 'instagram-square', 'social', { width: 1080, height: 1080, videoBitrateKbps: 5000 }),
  vp('TikTok', 'tiktok', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5100 }),
  vp('Douyin', 'douyin', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5000 }),
  vp('Xiaohongshu', 'xiaohongshu', 'social', { width: 1080, height: 1920, videoBitrateKbps: 6000 }),
  vp('Kuaishou', 'kuaishou', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5500 }),
  vp('Toutiao', 'toutiao', 'social', { width: 1920, height: 1080, videoBitrateKbps: 7500 }),
  vp('Weibo', 'weibo', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5400 }),
  vp('Facebook Reels', 'facebook-reels', 'social', { width: 1080, height: 1920, videoBitrateKbps: 5500, maxDurationSecs: 90 }),
  vp('LinkedIn', 'linkedin-video', 'social', { width: 1920, height: 1080, videoBitrateKbps: 5000 }),
  vp('Pinterest', 'pinterest-video', 'social', { width: 1080, height: 1920, videoBitrateKbps: 4500 }),
  vp('WeChat Channels', 'wechat-channels', 'social', { width: 1080, height: 1920, videoBitrateKbps: 6200 }),
  vp('Taobao Seller', 'taobao-seller', 'seller', { width: 1080, height: 1080, videoBitrateKbps: 4000, maxDurationSecs: 60 }),
  vp('JD Seller', 'jd-seller', 'seller', { width: 1080, height: 1080, videoBitrateKbps: 4000, maxDurationSecs: 60 }),
  vp('Xiaohongshu Seller', 'xiaohongshu-seller', 'seller', { width: 1080, height: 1440, videoBitrateKbps: 4500, maxDurationSecs: 60 }),
]

export const VIDEO_CONTAINERS = ['mp4', 'mov', 'webm', 'mkv', 'avi'] as const
export const AUDIO_CONTAINERS = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'] as const

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
  return 'libx264'
}
