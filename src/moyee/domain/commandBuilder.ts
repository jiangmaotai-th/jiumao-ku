import type { AppMode, OutputProfile } from '../types'
import { audioCodecFor, videoCodecFor } from './platforms'

function even(n: number): number {
  const v = Math.max(2, Math.round(n))
  return v % 2 === 0 ? v : v - 1
}

function buildScale(profile: OutputProfile): string | null {
  if (profile.keepOriginalResolution || !profile.width || !profile.height) return null
  const w = even(profile.width)
  const h = even(profile.height)
  if (profile.aspectMode === 'stretch') return `scale=${w}:${h}`
  if (profile.aspectMode === 'crop') {
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
  }
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`
}

function buildVf(profile: OutputProfile): string | null {
  const parts: string[] = []
  const scale = buildScale(profile)
  if (scale) parts.push(scale)
  const rot = profile.rotateDegrees ?? 0
  if (rot === 90) parts.push('transpose=1')
  else if (rot === 180) parts.push('transpose=1,transpose=1')
  else if (rot === 270) parts.push('transpose=2')
  if (profile.hFlip) parts.push('hflip')
  if (profile.vFlip) parts.push('vflip')
  if (profile.watermarkEnabled && profile.watermarkText?.trim()) {
    const pos = profile.watermarkPosition ?? 'br'
    const xy =
      pos === 'tl'
        ? 'x=24:y=24'
        : pos === 'tr'
          ? 'x=w-tw-24:y=24'
          : pos === 'bl'
            ? 'x=24:y=h-th-24'
            : pos === 'center'
              ? 'x=(w-tw)/2:y=(h-th)/2'
              : 'x=w-tw-24:y=h-th-24'
    const text = profile.watermarkText.replace(/:/g, '\\:').replace(/'/g, "\\'")
    parts.push(
      `drawtext=text='${text}':fontsize=28:fontcolor=white@0.85:box=1:boxcolor=black@0.35:boxborderw=8:${xy}`,
    )
  }
  return parts.length ? parts.join(',') : null
}

function buildAf(profile: OutputProfile): string | null {
  const parts: string[] = []
  if (profile.loudnormEnabled || profile.sellerLoudnorm) {
    parts.push('loudnorm=I=-14:TP=-1.5:LRA=11')
  }
  if (profile.sellerLoopFriendly) {
    parts.push('afade=t=in:st=0:d=0.4,afade=t=out:st=0:d=0.4')
  }
  return parts.length ? parts.join(',') : null
}

export function outputFileName(stem: string, profile: OutputProfile, mode: AppMode): string {
  const suffix = profile.outputNameSuffix || profile.platformId || mode
  const clean = stem.replace(/\.[^.]+$/, '')
  return `${clean}_${suffix}.${profile.container}`
}

/** Build ffmpeg argv for a single input → output job (browser ffmpeg.wasm). */
export function buildFfmpegArgs(
  inputName: string,
  outputName: string,
  profile: OutputProfile,
  mode: AppMode,
): string[] {
  const args: string[] = ['-hide_banner', '-y']

  if (profile.trimStartSecs != null && profile.trimStartSecs > 0) {
    args.push('-ss', String(profile.trimStartSecs))
  }
  args.push('-i', inputName)

  if (profile.trimEndSecs != null && profile.trimEndSecs > 0) {
    const start = profile.trimStartSecs ?? 0
    const dur = Math.max(0.1, profile.trimEndSecs - start)
    args.push('-t', String(dur))
  } else if (profile.maxDurationSecs != null && profile.maxDurationSecs > 0) {
    args.push('-t', String(profile.maxDurationSecs))
  }

  if (mode === 'extract') {
    const extract = profile.extractMode ?? 'audio'
    if (extract === 'audio') {
      args.push('-vn', '-c:a', profile.audioCodec || audioCodecFor(profile.container))
      if (profile.audioBitrateKbps) args.push('-b:a', `${profile.audioBitrateKbps}k`)
      args.push(outputName)
      return args
    }
    if (extract === 'cover') {
      args.push('-frames:v', '1', '-q:v', '2', outputName)
      return args
    }
    // gif
    args.push(
      '-vf',
      'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
      '-loop',
      '0',
      outputName,
    )
    return args
  }

  if (mode === 'music' || (!profile.videoCodec && profile.audioCodec)) {
    args.push('-vn')
    const ac = profile.audioCodec || audioCodecFor(profile.container)
    args.push('-c:a', ac)
    if (ac !== 'flac' && ac !== 'pcm_s16le' && profile.audioBitrateKbps) {
      args.push('-b:a', `${profile.audioBitrateKbps}k`)
    }
    if (profile.sampleRate) args.push('-ar', String(profile.sampleRate))
    if (profile.channels) args.push('-ac', String(profile.channels))
    const af = buildAf(profile)
    if (af) args.push('-af', af)
    args.push(outputName)
    return args
  }

  const vc = profile.videoCodec || videoCodecFor(profile.container)
  const ac = profile.keepOriginalAudio
    ? 'copy'
    : profile.audioCodec || audioCodecFor(profile.container === 'webm' ? 'ogg' : 'm4a')

  if (profile.bitrateMode === 'copy') {
    args.push('-c', 'copy')
  } else {
    args.push('-c:v', vc)
    if (vc === 'libx264') {
      args.push('-preset', mode === 'compress' ? 'fast' : 'medium')
      if (profile.bitrateMode === 'crf') {
        args.push('-crf', String(profile.crf ?? (mode === 'compress' ? 28 : 23)))
      } else if (profile.videoBitrateKbps) {
        args.push('-b:v', `${profile.videoBitrateKbps}k`)
      }
      args.push('-pix_fmt', 'yuv420p')
    } else if (vc === 'libvpx-vp9') {
      args.push('-b:v', `${profile.videoBitrateKbps ?? 2000}k`, '-row-mt', '1')
    }

    if (!profile.keepOriginalFrameRate && profile.frameRate) {
      args.push('-r', String(profile.frameRate))
    }

    const vf = buildVf(profile)
    if (vf) args.push('-vf', vf)

    if (ac === 'copy') {
      args.push('-c:a', 'copy')
    } else {
      args.push('-c:a', ac === 'libvorbis' || profile.container === 'webm' ? (profile.container === 'webm' ? 'libopus' : ac) : ac)
      if (profile.audioBitrateKbps) args.push('-b:a', `${profile.audioBitrateKbps}k`)
      if (profile.sampleRate) args.push('-ar', String(profile.sampleRate))
      if (profile.channels) args.push('-ac', String(profile.channels))
      const af = buildAf(profile)
      if (af) args.push('-af', af)
    }
  }

  if (profile.container === 'mp4' || profile.container === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push(outputName)
  return args
}

export function buildMergeArgs(listFile: string, outputName: string): string[] {
  return [
    '-hide_banner',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-c',
    'copy',
    outputName,
  ]
}

export function compressCrf(mode: 'standard' | 'highQuality' | 'maxCompress', quality: number): number {
  // quality 0–100 → CRF (higher quality → lower CRF)
  const base =
    mode === 'highQuality' ? 20 : mode === 'maxCompress' ? 32 : 28
  const offset = ((50 - quality) / 50) * 4
  return Math.min(36, Math.max(18, Math.round(base + offset)))
}
