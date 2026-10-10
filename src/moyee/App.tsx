import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import { useMoyeeStore } from './store'
import {
  AUDIO_CONTAINERS,
  CONVERT_AUDIO_BITRATE_OPTIONS,
  CONVERT_AUDIO_CODECS,
  CONVERT_FORMAT_GROUPS,
  CONVERT_VIDEO_CODECS,
  PLATFORM_PRESETS,
  VIDEO_CONTAINERS,
  WEBM_AUDIO_CODEC_IDS,
  audioCodecFor,
  convertAudioCodecId,
  convertBitrateOptions,
  convertVideoCodecId,
  isPhoneShell,
  platformShellKind,
  videoCodecFor,
  type PlatformShellKind,
} from './domain/platforms'
import {
  COMPRESS_CODECS,
  COMPRESS_MODE_ORDER,
  COMPRESS_RESOLUTIONS,
  applyCompressCodec,
  applyCompressResolution,
  codecIdFromProfile,
  effectiveDurationSecs,
  estimateCompressBytes,
  firstAvailableCompressMode,
  isCompressPresetAvailable,
  resolutionIdFromProfile,
  sourceBitrateMbps,
  validateTargetMb,
  type CompressCodecId,
  type CompressResId,
  type CompressStrategy,
} from './domain/compress'
import type { AppMode, CompressMode, ExtractMode, OutputProfile } from './types'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function statusLabel(
  status: string,
  progress: number,
  translate: (path: string, vars?: Record<string, string | number>) => string,
): string {
  if (status === 'running') return `${progress}%`
  if (status === 'completed') return translate('moyee.statusCompleted')
  if (status === 'failed') return translate('moyee.statusFailed')
  return translate('moyee.statusReady')
}

function modeTitle(
  mode: AppMode,
  translate: (path: string, vars?: Record<string, string | number>) => string,
): string {
  switch (mode) {
    case 'convert':
      return translate('moyee.modeConvert')
    case 'compress':
      return translate('moyee.modeCompress')
    case 'music':
      return translate('moyee.modeMusic')
    case 'merge':
      return translate('moyee.modeMerge')
    case 'extract':
      return translate('moyee.modeExtract')
  }
}

function modeLead(
  mode: AppMode,
  translate: (path: string, vars?: Record<string, string | number>) => string,
): string {
  switch (mode) {
    case 'convert':
      return translate('moyee.leadConvert')
    case 'compress':
      return translate('moyee.leadCompress')
    case 'music':
      return translate('moyee.leadMusic')
    case 'merge':
      return translate('moyee.leadMerge')
    case 'extract':
      return translate('moyee.leadExtract')
  }
}

export function App() {
  const mode = useMoyeeStore((s) => s.mode)
  const setMode = useMoyeeStore((s) => s.setMode)
  const jobs = useMoyeeStore((s) => s.jobs)
  const selectedId = useMoyeeStore((s) => s.selectedId)
  const selectJob = useMoyeeStore((s) => s.selectJob)
  const addFiles = useMoyeeStore((s) => s.addFiles)
  const removeJob = useMoyeeStore((s) => s.removeJob)
  const updateProfile = useMoyeeStore((s) => s.updateProfile)
  const runSelected = useMoyeeStore((s) => s.runSelected)
  const runAll = useMoyeeStore((s) => s.runAll)
  const downloadJob = useMoyeeStore((s) => s.downloadJob)
  const ensureEngine = useMoyeeStore((s) => s.ensureEngine)
  const engineReady = useMoyeeStore((s) => s.engineReady)
  const engineLoading = useMoyeeStore((s) => s.engineLoading)
  const engineError = useMoyeeStore((s) => s.engineError)
  const banner = useMoyeeStore((s) => s.banner)
  const compressMode = useMoyeeStore((s) => s.compressMode)
  const compressQuality = useMoyeeStore((s) => s.compressQuality)
  const compressStrategy = useMoyeeStore((s) => s.compressStrategy)
  const compressTargetMb = useMoyeeStore((s) => s.compressTargetMb)
  const setCompressMode = useMoyeeStore((s) => s.setCompressMode)
  const setCompressQuality = useMoyeeStore((s) => s.setCompressQuality)
  const setCompressStrategy = useMoyeeStore((s) => s.setCompressStrategy)
  const setCompressTargetMb = useMoyeeStore((s) => s.setCompressTargetMb)

  const { t, lh } = useT()
  const [panel, setPanel] = useState<AppMode | 'manual'>('convert')
  const [dragOver, setDragOver] = useState(false)
  const [targetDraftInvalid, setTargetDraftInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const videoNav = useMemo(
    () =>
      [
        { id: 'convert' as const, label: t('moyee.modeConvert') },
        { id: 'compress' as const, label: t('moyee.modeCompress') },
        { id: 'merge' as const, label: t('moyee.modeMerge') },
      ] satisfies { id: AppMode; label: string }[],
    [t],
  )

  const audioNav = useMemo(
    () =>
      [
        { id: 'music' as const, label: t('moyee.modeMusic') },
        { id: 'extract' as const, label: t('moyee.modeExtract') },
      ] satisfies { id: AppMode; label: string }[],
    [t],
  )

  useEffect(() => {
    void ensureEngine()
  }, [ensureEngine])

  useEffect(() => {
    if (mode !== 'compress' || compressStrategy !== 'targetSize') {
      setTargetDraftInvalid(false)
    }
  }, [mode, compressStrategy])

  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? null,
    [jobs, selectedId],
  )

  const previewMeta = useMemo(() => {
    if (!selected) return null
    return selected.status === 'completed' && selected.outputMeta
      ? selected.outputMeta
      : selected.meta
  }, [selected])

  const compressTargetInvalid = useMemo(() => {
    if (mode !== 'compress' || compressStrategy !== 'targetSize' || !selected) return false
    if (targetDraftInvalid) return true
    const duration = effectiveDurationSecs(
      selected.meta.durationSecs,
      selected.profile.trimStartSecs,
      selected.profile.trimEndSecs,
    )
    return !validateTargetMb(compressTargetMb, selected.meta.fileSize, duration).ok
  }, [mode, compressStrategy, compressTargetMb, selected, targetDraftInvalid])

  const onPickMode = (id: AppMode | 'manual') => {
    setPanel(id)
    if (id !== 'manual') setMode(id)
  }

  const applyProfile = (next: OutputProfile) => {
    if (!selected) return
    updateProfile(selected.id, next)
  }

  const openPicker = () => inputRef.current?.click()

  const accept =
    mode === 'music' ? 'audio/*,video/*' : 'video/*,audio/*'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={lh('/moyee/')}>
          {t('moyee.heroTitle')}
        </a>
        <div className="topbar-meta">
          <span>
            {engineLoading
              ? t('moyee.engineLoading')
              : engineReady
                ? t('moyee.engineReady')
                : engineError
                  ? engineError
                  : t('moyee.engineLoading')}
          </span>
          <a href={lh('/')}>{t('common.backHome')}</a>
          <LangSwitchHost />
        </div>
      </header>

      <aside className="sidebar">
        <div className="nav-group">
          <p className="nav-group-label">{t('moyee.navVideo')}</p>
          {videoNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${panel === item.id ? 'active' : ''}`}
              onClick={() => onPickMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="nav-group">
          <p className="nav-group-label">{t('moyee.navAudio')}</p>
          {audioNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${panel === item.id ? 'active' : ''}`}
              onClick={() => onPickMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="nav-group nav-group-tail">
          <p className="nav-group-label">{t('moyee.navOther')}</p>
          <button
            type="button"
            className={`nav-btn ${panel === 'manual' ? 'active' : ''}`}
            onClick={() => onPickMode('manual')}
          >
            {t('moyee.modeManual')}
          </button>
        </div>
      </aside>

      <main className="main">
        {panel === 'manual' ? (
          <ManualPanel />
        ) : (
          <div className="stage">
            <header className="stage-header">
              <h1>{modeTitle(mode, t)}</h1>
              <p>{modeLead(mode, t)}</p>
            </header>

            <div
              className={`stage-canvas ${dragOver ? 'dragover' : ''} ${previewMeta ? 'has-media' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void addFiles(e.dataTransfer.files)
              }}
              onClick={!previewMeta ? openPicker : undefined}
              role={!previewMeta ? 'button' : undefined}
              tabIndex={!previewMeta ? 0 : undefined}
              onKeyDown={
                !previewMeta
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openPicker()
                      }
                    }
                  : undefined
              }
            >
              {previewMeta ? (
                <StagePreview
                  previewUrl={previewMeta.previewUrl}
                  hasVideo={previewMeta.hasVideo}
                  fileName={previewMeta.fileName}
                  platformFrame={
                    mode === 'convert' &&
                    selected?.profile.platformId &&
                    selected.profile.width &&
                    selected.profile.height
                      ? {
                          platformId: selected.profile.platformId,
                          width: selected.profile.width,
                          height: selected.profile.height,
                          aspectMode: selected.profile.aspectMode,
                          maxDurationSecs: selected.profile.maxDurationSecs ?? null,
                        }
                      : null
                  }
                />
              ) : (
                <div className="stage-empty">
                  <strong>{t('moyee.dropToPreview')}</strong>
                  <span>
                    {mode === 'merge'
                      ? t('moyee.dropMergeHint')
                      : mode === 'music'
                        ? t('moyee.dropMusicHint')
                        : t('moyee.dropHint')}
                  </span>
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept={accept}
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {selected && previewMeta ? (
              <div className="file-bar">
                <div className="file-bar-info">
                  <span className="file-bar-name" title={previewMeta.fileName}>
                    {previewMeta.fileName}
                  </span>
                  <span className="file-bar-meta">
                    {formatBytes(previewMeta.fileSize)}
                    {previewMeta.durationSecs
                      ? ` · ${previewMeta.durationSecs.toFixed(1)}s`
                      : ''}
                    {previewMeta.width && previewMeta.height
                      ? ` · ${previewMeta.width}×${previewMeta.height}`
                      : ''}
                    {mode === 'convert' &&
                    selected.profile.platformId &&
                    selected.profile.width &&
                    selected.profile.height
                      ? ` → ${selected.profile.width}×${selected.profile.height}`
                      : ''}
                    {selected.status === 'completed' ? ` · ${t('moyee.outputMarker')}` : ''}
                    {` · ${statusLabel(selected.status, selected.progress, t)}`}
                  </span>
                </div>
                <div className="file-bar-actions">
                  {selected.status === 'completed' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => downloadJob(selected.id)}
                    >
                      {t('moyee.download')}
                    </button>
                  ) : null}
                  <button type="button" className="btn" onClick={openPicker}>
                    {t('moyee.reselectFile')}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => removeJob(selected.id)}
                  >
                    {t('moyee.remove')}
                  </button>
                </div>
              </div>
            ) : null}

            {jobs.length > 1 ? (
              <section className="queue">
                <p className="queue-label">{t('moyee.queueLabel')}</p>
                <div className="queue-list">
                  {jobs.map((job) => {
                    const shown =
                      job.status === 'completed' && job.outputMeta ? job.outputMeta : job.meta
                    const isImageThumb =
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(shown.fileName) && !shown.hasVideo
                    return (
                      <button
                        key={job.id}
                        type="button"
                        className={`queue-item ${job.id === selectedId ? 'selected' : ''}`}
                        onClick={() => selectJob(job.id)}
                      >
                        {shown.hasVideo ? (
                          <video className="queue-thumb" src={shown.previewUrl} muted />
                        ) : isImageThumb ? (
                          <img className="queue-thumb" src={shown.previewUrl} alt="" />
                        ) : (
                          <div className="queue-thumb audio">{t('moyee.audioBadge')}</div>
                        )}
                        <span className="queue-name">{shown.fileName}</span>
                        <span
                          className={`chip ${
                            job.status === 'completed'
                              ? 'ok'
                              : job.status === 'failed'
                                ? 'bad'
                                : job.status === 'running'
                                  ? 'run'
                                  : ''
                          }`}
                        >
                          {statusLabel(job.status, job.progress, t)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <aside className="inspector">
        {panel === 'manual' ? (
          <>
            <h2>{t('moyee.webGuideTitle')}</h2>
            <p className="banner">{t('moyee.webGuideLead')}</p>
          </>
        ) : !selected ? (
          <>
            <h2>{t('moyee.settingsTitle')}</h2>
            <p className="banner">{t('moyee.settingsNoSelection')}</p>
            <button type="button" className="btn primary inspector-cta" onClick={openPicker}>
              {t('moyee.dropHint')}
            </button>
          </>
        ) : (
          <>
            <Inspector
              mode={mode}
              profile={selected.profile}
              sourceMeta={selected.meta}
              durationSecs={
                selected.status === 'completed' && selected.outputMeta
                  ? selected.outputMeta.durationSecs
                  : selected.meta.durationSecs
              }
              compressMode={compressMode}
              compressQuality={compressQuality}
              compressStrategy={compressStrategy}
              compressTargetMb={compressTargetMb}
              onCompressMode={setCompressMode}
              onCompressQuality={setCompressQuality}
              onCompressStrategy={setCompressStrategy}
              onCompressTargetMb={setCompressTargetMb}
              onTargetDraftInvalidChange={setTargetDraftInvalid}
              onChange={applyProfile}
            />
            <div className="inspector-actions">
              <button
                type="button"
                className={`btn primary inspector-cta${
                  selected.status === 'running' ? ' is-progress' : ''
                }`}
                style={
                  selected.status === 'running'
                    ? ({ '--cta-progress': `${selected.progress}%` } as CSSProperties)
                    : undefined
                }
                disabled={selected.status === 'running' || compressTargetInvalid}
                onClick={() => void runSelected()}
              >
                <span className="cta-label">
                  {selected.status === 'running'
                    ? t('moyee.processing')
                    : mode === 'merge'
                      ? t('moyee.startMerge')
                      : t('moyee.start')}
                </span>
                {selected.status === 'running' ? (
                  <span className="cta-pct">{selected.progress}%</span>
                ) : null}
              </button>
              {mode !== 'merge' && jobs.length > 1 ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!jobs.length}
                  onClick={() => void runAll()}
                >
                  {t('moyee.startAll')}
                </button>
              ) : null}
              {selected.status === 'completed' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => downloadJob(selected.id)}
                >
                  {t('moyee.downloadResult')}
                </button>
              ) : null}
            </div>
          </>
        )}
      </aside>

      <footer className="footer">
        <div className="footer-copy">
          <p className="banner">{banner ?? t('moyee.footerBrand')}</p>
          <p className="privacy-note">
            <span className="local-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
                <path d="M5 14.2h6M8 11.5v2.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                <circle cx="8" cy="7" r="1.35" fill="currentColor" />
              </svg>
            </span>
            {t('moyee.privacyNote')}{' '}
            <a href={lh('/legal/#privacy')}>{t('common.privacy')}</a>
            {' · '}
            <a href={lh('/legal/#terms')}>{t('common.terms')}</a>
            {' · '}
            <a href={lh('/legal/#credits')}>{t('common.credits')}</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function PhoneAppChrome({
  skin,
  platformName,
}: {
  skin: PlatformShellKind
  platformName: string
}) {
  const { t } = useT()
  if (skin === 'xhs') {
    return (
      <div className="app-chrome app-xhs" aria-hidden="true">
        <div className="app-xhs-top">
          <span className="app-xhs-back">‹</span>
          <div className="app-xhs-top-right">
            <span className="app-xhs-ico-btn search" />
            <span className="app-xhs-ico-btn share" />
          </div>
        </div>
        <div className="app-xhs-meta">
          <div className="app-xhs-user">
            <span className="app-xhs-avatar" />
            <strong>{platformName}</strong>
            <em>{t('moyee.platformShellFollow')}</em>
          </div>
          <p className="app-xhs-title">{t('moyee.platformShellXhsTitle')}</p>
          <p className="app-xhs-tags">#Moyee #预览</p>
          <div className="app-xhs-progress">
            <i />
          </div>
        </div>
        <div className="app-xhs-dock">
          <span className="app-xhs-input">{t('moyee.platformShellXhsComment')}</span>
          <span className="app-xhs-dock-act">
            <i className="heart" />
            1226
          </span>
          <span className="app-xhs-dock-act">
            <i className="star" />
            155
          </span>
          <span className="app-xhs-dock-act">
            <i className="chat" />
            93
          </span>
        </div>
      </div>
    )
  }

  if (skin === 'douyin') {
    return (
      <div className="app-chrome app-douyin" aria-hidden="true">
        <div className="app-dy-live">{t('moyee.platformShellForYou')}</div>
        <div className="app-dy-side">
          <div className="app-dy-avatar-wrap">
            <span className="app-dy-avatar" />
            <span className="app-dy-plus">+</span>
          </div>
          <div className="app-dy-act">
            <span>♡</span>
            <b>8.6万</b>
          </div>
          <div className="app-dy-act">
            <span>💬</span>
            <b>2311</b>
          </div>
          <div className="app-dy-act">
            <span>☆</span>
            <b>1.1万</b>
          </div>
          <div className="app-dy-act">
            <span>↗</span>
            <b>{t('moyee.platformShellShare')}</b>
          </div>
          <span className="app-dy-disc" />
        </div>
        <div className="app-dy-bottom">
          <strong>@{platformName}</strong>
          <p>{t('moyee.platformShellCaption')}</p>
          <span className="app-dy-music">♪ {t('moyee.platformShellMusic')}</span>
        </div>
      </div>
    )
  }

  if (skin === 'reels') {
    return (
      <div className="app-chrome app-reels" aria-hidden="true">
        <div className="app-reels-top">
          <strong>Reels</strong>
          <span>📷</span>
        </div>
        <div className="app-reels-side">
          <span>♡</span>
          <span>💬</span>
          <span>↗</span>
          <span>···</span>
        </div>
        <div className="app-reels-bottom">
          <div className="app-reels-user">
            <i />
            <strong>{platformName}</strong>
            <em>{t('moyee.platformShellFollow')}</em>
          </div>
          <p>{t('moyee.platformShellCaption')}</p>
        </div>
      </div>
    )
  }

  if (skin === 'shorts') {
    return (
      <div className="app-chrome app-shorts" aria-hidden="true">
        <div className="app-shorts-top">
          <span>Shorts</span>
          <span>🔍</span>
        </div>
        <div className="app-shorts-side">
          <span>♡</span>
          <span>💬</span>
          <span>↗</span>
          <span>↻</span>
        </div>
        <div className="app-shorts-bottom">
          <strong>@{platformName}</strong>
          <p>{t('moyee.platformShellCaption')}</p>
        </div>
      </div>
    )
  }

  // wechat channels
  return (
    <div className="app-chrome app-wechat" aria-hidden="true">
      <div className="app-wc-top">
        <span>‹</span>
        <strong>{t('moyee.platformShellChannels')}</strong>
        <span>···</span>
      </div>
      <div className="app-wc-bottom">
        <strong>{platformName}</strong>
        <p>{t('moyee.platformShellCaption')}</p>
        <div className="app-wc-actions">
          <span>♡ 赞</span>
          <span>💬 评论</span>
          <span>☆ 推荐</span>
        </div>
      </div>
    </div>
  )
}

function StagePreview({
  previewUrl,
  hasVideo,
  fileName,
  platformFrame,
}: {
  previewUrl: string
  hasVideo: boolean
  fileName: string
  platformFrame: {
    platformId: string
    width: number
    height: number
    aspectMode: OutputProfile['aspectMode']
    maxDurationSecs: number | null
  } | null
}) {
  const { t } = useT()
  const shellVideoRef = useRef<HTMLVideoElement>(null)
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) && !hasVideo

  if (hasVideo && platformFrame) {
    const isPortrait = platformFrame.height > platformFrame.width
    const isSquare = platformFrame.height === platformFrame.width
    const shell = platformShellKind(platformFrame.platformId)
    const phone = isPhoneShell(shell)
    const immersive = phone || shell === 'feed' || shell === 'shop'
    // Show the complete video inside the platform canvas (letterbox/pillarbox when AR differs).
    // Crop is a user choice — not the default platform-preview behavior.
    const fit =
      platformFrame.aspectMode === 'crop' || platformFrame.aspectMode === 'stretch'
        ? 'cover'
        : 'contain'
    const platformName = t(`moyee.plat.${platformFrame.platformId}`)
    const orientation = isPortrait ? 'portrait' : isSquare ? 'square' : 'landscape'
    const toggleShellPlayback = () => {
      const el = shellVideoRef.current
      if (!el) return
      if (el.paused) void el.play()
      else el.pause()
    }
    const media = (
      <video
        ref={shellVideoRef}
        key={`${previewUrl}-${platformFrame.platformId}`}
        className="platform-preview-media"
        style={{ objectFit: fit }}
        src={previewUrl}
        controls={!immersive}
        playsInline
        preload="metadata"
        muted={immersive}
        autoPlay={immersive}
        loop={immersive}
        onClick={immersive ? toggleShellPlayback : undefined}
      />
    )
    const arStyle = {
      '--platform-ar': `${platformFrame.width} / ${platformFrame.height}`,
    } as CSSProperties

    return (
      <div className={`platform-preview is-${orientation} shell-${shell}`}>
        {phone ? (
          <div className={`shell-phone skin-${shell}`}>
            <div className="shell-phone-bezel">
              <div className="shell-phone-screen" style={arStyle}>
                <div className="shell-phone-status" aria-hidden="true">
                  <span>9:41</span>
                  <span className="shell-phone-island" />
                  <span className="shell-phone-status-right">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="shell-phone-stage">{media}</div>
                <PhoneAppChrome skin={shell} platformName={platformName} />
                <div className="shell-phone-home" aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : null}

        {shell === 'youtube' ? (
          <div className="shell-youtube">
            <div className="shell-yt-chrome">
              <span className="shell-yt-mark">▶</span>
              <span className="shell-yt-brand">YouTube</span>
              <span className="shell-yt-search" aria-hidden="true" />
            </div>
            <div className="shell-yt-player" style={arStyle}>
              {media}
            </div>
            <div className="shell-yt-meta">
              <p className="shell-yt-title">{platformName}</p>
              <p className="shell-yt-sub">
                {platformFrame.width}×{platformFrame.height} · {t('moyee.platformShellYtViews')}
              </p>
              <div className="shell-yt-row" aria-hidden="true">
                <span>{t('moyee.platformShellYtLike')}</span>
                <span>{t('moyee.platformShellYtShare')}</span>
                <span>{t('moyee.platformShellYtSave')}</span>
              </div>
            </div>
          </div>
        ) : null}

        {shell === 'feed' ? (
          <div className="shell-feed">
            <div className="shell-feed-head">
              <span className="shell-feed-avatar" aria-hidden="true" />
              <div>
                <strong>{platformName}</strong>
                <span>{t('moyee.platformShellFeedHint')}</span>
              </div>
              <em className="shell-feed-follow">{t('moyee.platformShellFollow')}</em>
            </div>
            <div className={`shell-feed-media is-${orientation}`} style={arStyle}>
              {media}
            </div>
            <div className="shell-feed-actions" aria-hidden="true">
              <span>♡</span>
              <span>💬</span>
              <span>☆</span>
              <span>↗</span>
            </div>
            <p className="shell-feed-caption">
              <strong>moyee</strong> {t('moyee.platformShellCaption')}
            </p>
          </div>
        ) : null}

        {shell === 'desktop' ? (
          <div className="shell-desktop">
            <div className="shell-desktop-bar">
              <span />
              <span />
              <span />
              <em>{platformName}</em>
            </div>
            <div className="shell-desktop-player" style={arStyle}>
              {media}
            </div>
          </div>
        ) : null}

        {shell === 'shop' ? (
          <div className="shell-shop">
            <div className={`shell-shop-media is-${orientation}`} style={arStyle}>
              {media}
              <span className="shell-shop-tag">{t('moyee.platformShellShopTag')}</span>
            </div>
            <div className="shell-shop-foot">
              <strong>{platformName}</strong>
              <button type="button" className="shell-shop-buy" tabIndex={-1}>
                {t('moyee.platformShellShopCta')}
              </button>
            </div>
          </div>
        ) : null}

        <p className="platform-preview-badge">
          {t('moyee.platformPreviewBadge', {
            platform: platformName,
            size: `${platformFrame.width}×${platformFrame.height}`,
          })}
          {platformFrame.maxDurationSecs
            ? ` · ≤${platformFrame.maxDurationSecs}s`
            : ''}
        </p>
      </div>
    )
  }

  if (hasVideo) {
    return (
      <video
        key={previewUrl}
        className="stage-media"
        src={previewUrl}
        controls
        playsInline
        preload="metadata"
      />
    )
  }
  if (isImage) {
    return <img key={previewUrl} className="stage-media image" src={previewUrl} alt={fileName} />
  }
  return (
    <div className="stage-audio">
      <p className="stage-audio-badge">{t('moyee.audioBadge')}</p>
      <audio key={previewUrl} src={previewUrl} controls preload="metadata" />
      <p className="stage-audio-name">{fileName}</p>
    </div>
  )
}

function Inspector({
  mode,
  profile,
  sourceMeta,
  durationSecs,
  compressMode,
  compressQuality,
  compressStrategy,
  compressTargetMb,
  onCompressMode,
  onCompressQuality,
  onCompressStrategy,
  onCompressTargetMb,
  onTargetDraftInvalidChange,
  onChange,
}: {
  mode: AppMode
  profile: OutputProfile
  sourceMeta: { fileSize: number; durationSecs?: number; width?: number; height?: number }
  durationSecs?: number
  compressMode: CompressMode
  compressQuality: number
  compressStrategy: CompressStrategy
  compressTargetMb: number | null
  onCompressMode: (m: CompressMode) => void
  onCompressQuality: (q: number) => void
  onCompressStrategy: (s: CompressStrategy) => void
  onCompressTargetMb: (mb: number | null) => void
  onTargetDraftInvalidChange: (invalid: boolean) => void
  onChange: (p: OutputProfile) => void
}) {
  const { t } = useT()
  const containers = mode === 'music' || mode === 'extract' ? AUDIO_CONTAINERS : VIDEO_CONTAINERS

  return (
    <>
      <h2>
        {mode === 'compress'
          ? t('moyee.compressTitle')
          : mode === 'convert'
            ? t('moyee.convertSettings')
            : t('moyee.settingsTitle')}
      </h2>

      {mode === 'merge' ? <p className="banner">{t('moyee.mergeHint')}</p> : null}

      {mode === 'compress' ? (
        <CompressSettings
          profile={profile}
          sourceMeta={sourceMeta}
          compressMode={compressMode}
          compressQuality={compressQuality}
          compressStrategy={compressStrategy}
          compressTargetMb={compressTargetMb}
          onCompressMode={onCompressMode}
          onCompressQuality={onCompressQuality}
          onCompressStrategy={onCompressStrategy}
          onCompressTargetMb={onCompressTargetMb}
          onDraftInvalidChange={onTargetDraftInvalidChange}
          onChange={onChange}
        />
      ) : null}

      {mode === 'convert' ? (
        <ConvertSettings profile={profile} sourceMeta={sourceMeta} onChange={onChange} />
      ) : null}

      {mode === 'extract' ? (
        <section className="field-group">
          <h3>{t('moyee.extractTitle')}</h3>
          <div className="field">
            <label htmlFor="ex">{t('moyee.modeLabel')}</label>
            <select
              id="ex"
              value={profile.extractMode ?? 'audio'}
              onChange={(e) => {
                const extractMode = e.target.value as ExtractMode
                if (extractMode === 'cover') {
                  onChange({ ...profile, extractMode, container: 'jpg' })
                } else if (extractMode === 'gif') {
                  onChange({ ...profile, extractMode, container: 'gif' })
                } else {
                  onChange({ ...profile, extractMode, container: 'mp3', audioCodec: 'libmp3lame' })
                }
              }}
            >
              <option value="audio">{t('moyee.extractAudio')}</option>
              <option value="gif">{t('moyee.extractGif')}</option>
              <option value="cover">{t('moyee.extractCover')}</option>
            </select>
          </div>
        </section>
      ) : null}

      {mode !== 'merge' &&
      mode !== 'compress' &&
      mode !== 'convert' &&
      !(mode === 'extract' && profile.extractMode !== 'audio') ? (
        <section className="field-group">
          <div className="field">
            <label htmlFor="fmt">{t('moyee.outputFormat')}</label>
            <select
              id="fmt"
              value={profile.container}
              onChange={(e) => {
                const container = e.target.value
                onChange({
                  ...profile,
                  container,
                  platformId: null,
                  videoCodec:
                    mode === 'music' || mode === 'extract' ? null : videoCodecFor(container),
                  audioCodec: audioCodecFor(container === 'webm' ? 'ogg' : container),
                })
              }}
            >
              {containers.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          {mode === 'music' ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="ab">{t('moyee.audioBitrate')}</label>
                <input
                  id="ab"
                  type="number"
                  min={32}
                  max={512}
                  value={profile.audioBitrateKbps ?? 192}
                  onChange={(e) =>
                    onChange({ ...profile, audioBitrateKbps: Number(e.target.value), platformId: null })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="ar">{t('moyee.sampleRate')}</label>
                <select
                  id="ar"
                  value={profile.sampleRate ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...profile,
                      sampleRate: e.target.value ? Number(e.target.value) : null,
                      platformId: null,
                    })
                  }
                >
                  <option value="">{t('moyee.original')}</option>
                  <option value="44100">44100</option>
                  <option value="48000">48000</option>
                </select>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode !== 'merge' && mode !== 'convert' ? (
        <section className="field-group">
          <h3>{t('moyee.timeRange')}</h3>
          <div className="field-row">
            <div className="field">
              <label htmlFor="ts">{t('moyee.trimStart')}</label>
              <input
                id="ts"
                type="number"
                min={0}
                step={0.1}
                value={profile.trimStartSecs ?? ''}
                onChange={(e) =>
                  onChange({
                    ...profile,
                    trimStartSecs: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="te">{t('moyee.trimEnd')}</label>
              <input
                id="te"
                type="number"
                min={0}
                step={0.1}
                placeholder={durationSecs ? String(durationSecs.toFixed(1)) : ''}
                value={profile.trimEndSecs ?? ''}
                onChange={(e) =>
                  onChange({
                    ...profile,
                    trimEndSecs: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => onChange({ ...profile, trimStartSecs: null, trimEndSecs: null })}
          >
            {t('moyee.clearTrim')}
          </button>
        </section>
      ) : null}
    </>
  )
}

function ConvertSettings({
  profile,
  sourceMeta,
  onChange,
}: {
  profile: OutputProfile
  sourceMeta: { fileSize: number; durationSecs?: number; width?: number; height?: number }
  onChange: (p: OutputProfile) => void
}) {
  const { t } = useT()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const sourceMbps = sourceBitrateMbps(sourceMeta.fileSize, sourceMeta.durationSecs)
  const videoCodecId = convertVideoCodecId(profile.videoCodec)
  const audioCodecId = convertAudioCodecId(profile.audioCodec)
  const bitrateOptions = convertBitrateOptions(sourceMbps)
  const sourceBitrateOption = bitrateOptions.find((o) => o.isSource)
  const activeBitrate =
    profile.bitrateMode === 'bitrate' && profile.videoBitrateKbps
      ? profile.videoBitrateKbps
      : sourceBitrateOption?.kbps ?? bitrateOptions[bitrateOptions.length - 1]?.kbps

  const setContainer = (container: string) => {
    const nextVideo =
      container === 'webm'
        ? videoCodecId === 'h264' || videoCodecId === 'h265'
          ? 'libvpx-vp9'
          : CONVERT_VIDEO_CODECS.find((c) => c.id === videoCodecId)?.ffmpeg ?? 'libvpx-vp9'
        : videoCodecId === 'vp9' || videoCodecId === 'av1'
          ? container === 'mkv'
            ? CONVERT_VIDEO_CODECS.find((c) => c.id === videoCodecId)?.ffmpeg
            : 'libx264'
          : CONVERT_VIDEO_CODECS.find((c) => c.id === videoCodecId)?.ffmpeg ?? videoCodecFor(container)
    const nextAudio =
      container === 'webm'
        ? WEBM_AUDIO_CODEC_IDS.has(audioCodecId)
          ? CONVERT_AUDIO_CODECS.find((c) => c.id === audioCodecId)?.ffmpeg ?? 'libopus'
          : 'libopus'
        : CONVERT_AUDIO_CODECS.find((c) => c.id === audioCodecId)?.ffmpeg ?? audioCodecFor(container)
    onChange({
      ...profile,
      container,
      platformId: null,
      videoCodec: nextVideo ?? 'libx264',
      audioCodec: nextAudio,
      rotateDegrees: 0,
      hFlip: false,
      vFlip: false,
      watermarkEnabled: false,
      loudnormEnabled: false,
    })
  }

  const setVideoCodec = (id: (typeof CONVERT_VIDEO_CODECS)[number]['id']) => {
    const codec = CONVERT_VIDEO_CODECS.find((c) => c.id === id)
    if (!codec) return
    let container = profile.container
    if ((id === 'vp9' || id === 'av1') && !['webm', 'mkv'].includes(container)) container = 'webm'
    if ((id === 'h264' || id === 'h265') && container === 'webm') container = 'mp4'
    onChange({
      ...profile,
      container,
      videoCodec: codec.ffmpeg,
      platformId: null,
      audioCodec:
        container === 'webm' && !WEBM_AUDIO_CODEC_IDS.has(convertAudioCodecId(profile.audioCodec))
          ? 'libopus'
          : profile.audioCodec,
    })
  }

  const setAudioCodec = (id: (typeof CONVERT_AUDIO_CODECS)[number]['id']) => {
    const codec = CONVERT_AUDIO_CODECS.find((c) => c.id === id)
    if (!codec) return
    onChange({
      ...profile,
      audioCodec: codec.ffmpeg,
      // Lossless / PCM: bitrate control does not apply.
      audioBitrateKbps: id === 'flac' || id === 'pcm' ? null : profile.audioBitrateKbps ?? 192,
      platformId: null,
    })
  }

  const losslessAudio = audioCodecId === 'flac' || audioCodecId === 'pcm'

  return (
    <>
      <section className="field-group">
        <div className="field">
          <label htmlFor="plat">{t('moyee.platformOneClick')}</label>
          <select
            id="plat"
            value={profile.platformId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              if (!id) {
                onChange({ ...profile, platformId: null })
                return
              }
              const preset = PLATFORM_PRESETS.find((p) => p.id === id)
              if (preset) {
                onChange({
                  ...preset.profile,
                  rotateDegrees: 0,
                  hFlip: false,
                  vFlip: false,
                  watermarkEnabled: false,
                  loudnormEnabled: false,
                })
              }
            }}
          >
            <option value="">{t('moyee.platformOneClickPlaceholder')}</option>
            <optgroup label={t('moyee.platformSocial')}>
              {PLATFORM_PRESETS.filter((p) => p.category === 'social').map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`moyee.plat.${p.id}`)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('moyee.platformSeller')}>
              {PLATFORM_PRESETS.filter((p) => p.category === 'seller').map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`moyee.plat.${p.id}`)}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </section>

      <section className="field-group">
        <div className="field">
          <span className="field-label">{t('moyee.outputFormat')}</span>
          <div className="format-groups" role="group" aria-label={t('moyee.outputFormat')}>
            {CONVERT_FORMAT_GROUPS.map((group) => (
              <div key={group.id} className="format-group">
                <span className="format-group-label">
                  {group.id === 'common'
                    ? t('moyee.formatGroupCommon')
                    : t('moyee.formatGroupOther')}
                </span>
                <div className="format-group-items">
                  {group.items.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`format-item ${profile.container === c ? 'active' : ''}`}
                      onClick={() => setContainer(c)}
                    >
                      .{c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <details
        className="advanced-details"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="advanced-summary">{t('moyee.advancedSettings')}</summary>
        <div className="advanced-form">
          <div className="field">
            <label htmlFor="vcodec">{t('moyee.videoCodec')}</label>
            <select
              id="vcodec"
              value={videoCodecId}
              onChange={(e) =>
                setVideoCodec(e.target.value as (typeof CONVERT_VIDEO_CODECS)[number]['id'])
              }
            >
              {CONVERT_VIDEO_CODECS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {videoCodecId === 'h265' ? (
              <p className="field-hint">{t('moyee.codecHintH265')}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="acodec">{t('moyee.audioCodec')}</label>
            <select
              id="acodec"
              value={audioCodecId}
              onChange={(e) =>
                setAudioCodec(e.target.value as (typeof CONVERT_AUDIO_CODECS)[number]['id'])
              }
            >
              {CONVERT_AUDIO_CODECS.map((c) => {
                const disabled =
                  profile.container === 'webm' && !WEBM_AUDIO_CODEC_IDS.has(c.id)
                return (
                  <option key={c.id} value={c.id} disabled={disabled}>
                    {c.label}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="field">
            <label htmlFor="abitrate">{t('moyee.audioBitrate')}</label>
            <select
              id="abitrate"
              disabled={losslessAudio}
              value={profile.audioBitrateKbps ?? 192}
              onChange={(e) =>
                onChange({
                  ...profile,
                  audioBitrateKbps: Number(e.target.value),
                  platformId: null,
                })
              }
            >
              {CONVERT_AUDIO_BITRATE_OPTIONS.map((kbps) => (
                <option key={kbps} value={kbps}>
                  {kbps} kbps
                </option>
              ))}
            </select>
            {losslessAudio ? (
              <p className="field-hint">{t('moyee.audioBitrateLosslessHint')}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="vbitrate">{t('moyee.videoBitrate')}</label>
            <select
              id="vbitrate"
              value={activeBitrate}
              onChange={(e) =>
                onChange({
                  ...profile,
                  bitrateMode: 'bitrate',
                  videoBitrateKbps: Number(e.target.value),
                  crf: null,
                  platformId: null,
                })
              }
            >
              {bitrateOptions.map((opt) => (
                <option key={opt.kbps} value={opt.kbps}>
                  {opt.isSource ? `${opt.label}（${t('moyee.sourceTag')}）` : opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>
    </>
  )
}

function CompressSettings({
  profile,
  sourceMeta,
  compressMode,
  compressQuality,
  compressStrategy,
  compressTargetMb,
  onCompressMode,
  onCompressQuality,
  onCompressStrategy,
  onCompressTargetMb,
  onDraftInvalidChange,
  onChange,
}: {
  profile: OutputProfile
  sourceMeta: { fileSize: number; durationSecs?: number; width?: number; height?: number }
  compressMode: CompressMode
  compressQuality: number
  compressStrategy: CompressStrategy
  compressTargetMb: number | null
  onCompressMode: (m: CompressMode) => void
  onCompressQuality: (q: number) => void
  onCompressStrategy: (s: CompressStrategy) => void
  onCompressTargetMb: (mb: number | null) => void
  onDraftInvalidChange: (invalid: boolean) => void
  onChange: (p: OutputProfile) => void
}) {
  const { t } = useT()
  const codecId = codecIdFromProfile(profile)
  const resId = resolutionIdFromProfile(profile)
  const duration = effectiveDurationSecs(
    sourceMeta.durationSecs,
    profile.trimStartSecs,
    profile.trimEndSecs,
  )
  const sourceMbps = sourceBitrateMbps(sourceMeta.fileSize, sourceMeta.durationSecs)
  const lastValidTargetRef = useRef<number | null>(compressTargetMb)
  const [targetDraft, setTargetDraft] = useState(
    compressTargetMb != null ? String(compressTargetMb) : '',
  )
  const [targetError, setTargetError] = useState<string | null>(null)
  const [draftInvalid, setDraftInvalid] = useState(false)

  const outW = profile.keepOriginalResolution ? sourceMeta.width : profile.width ?? sourceMeta.width
  const outH = profile.keepOriginalResolution ? sourceMeta.height : profile.height ?? sourceMeta.height

  useEffect(() => {
    if (compressStrategy !== 'targetSize') {
      setTargetDraft(compressTargetMb != null ? String(compressTargetMb) : '')
      setTargetError(null)
      setDraftInvalid(false)
      onDraftInvalidChange(false)
    }
  }, [compressStrategy, compressTargetMb, onDraftInvalidChange])

  useEffect(() => {
    onDraftInvalidChange(draftInvalid)
  }, [draftInvalid, onDraftInvalidChange])

  useEffect(() => {
    if (compressStrategy !== 'quality') return
    if (isCompressPresetAvailable(compressMode, sourceMbps, outW, outH)) return
    onCompressMode(firstAvailableCompressMode(sourceMbps, outW, outH))
  }, [compressStrategy, compressMode, sourceMbps, outW, outH, onCompressMode])

  const estimate = estimateCompressBytes({
    originalBytes: sourceMeta.fileSize,
    strategy: compressStrategy,
    targetMb: compressTargetMb,
    crf: profile.crf ?? 28,
    quality: compressQuality,
    mode: compressMode,
    codecId,
    resId,
    durationSecs: duration,
    width: sourceMeta.width,
    height: sourceMeta.height,
  })

  const onCodec = (id: CompressCodecId) => {
    onChange(applyCompressCodec(profile, id))
  }

  const onResolution = (id: CompressResId) => {
    onChange(applyCompressResolution(profile, id, sourceMeta.width, sourceMeta.height))
  }

  const errorForTargetIssue = (issue: ReturnType<typeof validateTargetMb>['issue']) => {
    if (issue === 'tooLarge') return t('moyee.compressTargetMustSmaller')
    if (issue === 'tooSmall') return t('moyee.compressTargetTooSmallQuality')
    return t('moyee.compressTargetEmpty')
  }

  const onTargetDraftChange = (raw: string) => {
    setTargetDraft(raw)

    // Empty / unfinished decimal: no error tip yet.
    if (raw.trim() === '' || raw === '.' || /^-?\d+\.$/.test(raw.trim())) {
      setTargetError(null)
      setDraftInvalid(false)
      return
    }

    const value = Number(raw)
    if (!Number.isFinite(value)) {
      setTargetError(t('moyee.compressTargetEmpty'))
      setDraftInvalid(true)
      return
    }

    const check = validateTargetMb(value, sourceMeta.fileSize, duration)
    if (!check.ok) {
      setTargetError(errorForTargetIssue(check.issue))
      setDraftInvalid(true)
      // Keep last valid value in store so encode/estimate stay sane.
      onCompressTargetMb(lastValidTargetRef.current)
      return
    }

    setTargetError(null)
    setDraftInvalid(false)
    lastValidTargetRef.current = value
    onCompressTargetMb(value)
  }

  const targetInfo = `${t('moyee.compressOriginalSize', {
    size: formatBytes(sourceMeta.fileSize),
  })} ${t('moyee.compressTargetMustSmaller')}`

  return (
    <section className="compress-panel">
      <div className="compress-estimate-row">
        <span>{t('moyee.compressEstimate', { size: formatBytes(estimate.bytes) })}</span>
        {sourceMbps != null ? (
          <span className="compress-estimate-meta">
            {t('moyee.compressSourceBitrate', { rate: `${sourceMbps.toFixed(1)} Mbps` })}
          </span>
        ) : null}
      </div>

      <div className="compress-strategy" role="tablist" aria-label={t('moyee.compressTitle')}>
        <button
          type="button"
          role="tab"
          className={compressStrategy === 'quality' ? 'active' : ''}
          aria-selected={compressStrategy === 'quality'}
          onClick={() => onCompressStrategy('quality')}
        >
          {t('moyee.compressTabQuality')}
        </button>
        <button
          type="button"
          role="tab"
          className={compressStrategy === 'targetSize' ? 'active' : ''}
          aria-selected={compressStrategy === 'targetSize'}
          onClick={() => onCompressStrategy('targetSize')}
        >
          {t('moyee.compressTabTarget')}
        </button>
      </div>

      {compressStrategy === 'quality' ? (
        <div className="compress-block">
          <div className="preset-list" role="radiogroup" aria-label={t('moyee.compressTabQuality')}>
            {COMPRESS_MODE_ORDER.map((modeId) => {
              const available = isCompressPresetAvailable(modeId, sourceMbps, outW, outH)
              const label =
                modeId === 'highQuality'
                  ? t('moyee.compressHighQuality')
                  : modeId === 'standard'
                    ? t('moyee.compressStandard')
                    : t('moyee.compressMaxCompress')
              const hint =
                !available
                  ? t('moyee.compressPresetUnavailable')
                  : modeId === 'maxCompress'
                    ? t('moyee.compressPresetMaxHint')
                    : modeId === 'standard'
                      ? t('moyee.compressPresetLowHint')
                      : null
              return (
                <button
                  key={modeId}
                  type="button"
                  role="radio"
                  aria-checked={compressMode === modeId}
                  aria-disabled={!available}
                  disabled={!available}
                  className={`preset-option ${compressMode === modeId ? 'active' : ''} ${available ? '' : 'disabled'}`}
                  onClick={() => {
                    if (available) onCompressMode(modeId)
                  }}
                >
                  <span className="preset-option-title">{label}</span>
                  {hint ? <span className="preset-option-hint">{hint}</span> : null}
                </button>
              )
            })}
          </div>
          <div className="field">
            <label htmlFor="cq">{t('moyee.qualityLabel', { value: compressQuality })}</label>
            <input
              id="cq"
              type="range"
              min={0}
              max={100}
              value={compressQuality}
              onChange={(e) => onCompressQuality(Number(e.target.value))}
            />
          </div>
          <p className="field-hint">
            {t('moyee.crfHint', {
              crf: profile.crf ?? '-',
              container: profile.container.toUpperCase(),
            })}
          </p>
        </div>
      ) : (
        <div className="compress-block">
          <div className="field">
            <label htmlFor="targetMb">{t('moyee.compressTargetSize')}</label>
            <input
              id="targetMb"
              type="number"
              min={0.05}
              step={0.1}
              placeholder={t('moyee.compressTargetPlaceholder')}
              value={targetDraft}
              onChange={(e) => onTargetDraftChange(e.target.value)}
              aria-invalid={draftInvalid}
            />
            <p className="field-hint">{targetInfo}</p>
            {targetError ? <p className="field-error">{targetError}</p> : null}
          </div>
        </div>
      )}

      <div className="field-row compress-output-row">
        <div className="field">
          <label htmlFor="cres">{t('moyee.compressResolution')}</label>
          <select
            id="cres"
            value={resId}
            onChange={(e) => onResolution(e.target.value as CompressResId)}
          >
            {COMPRESS_RESOLUTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id === 'original'
                  ? t('moyee.compressResOriginal')
                  : t(`moyee.compressRes${r.id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ccodec">{t('moyee.compressCodec')}</label>
          <select
            id="ccodec"
            value={codecId}
            onChange={(e) => onCodec(e.target.value as CompressCodecId)}
          >
            {COMPRESS_CODECS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}

function ManualPanel() {
  const { t, tList, lh } = useT()

  return (
    <div className="manual">
      <h2>{t('moyee.manualTitle')}</h2>
      <p>{t('moyee.manualIntro')}</p>
      <h3>{t('moyee.manualFeatureTitle')}</h3>
      <ul>
        {tList('moyee.manualFeatures').map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>{t('moyee.manualDifferenceTitle')}</h3>
      <ul>
        {tList('moyee.manualDifferences').map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        {t('moyee.manualDownloadPrefix')}{' '}
        <a href={lh('/')}>{t('common.brand')}</a>{' '}
        {t('moyee.manualDownloadSuffix')}
      </p>
    </div>
  )
}
