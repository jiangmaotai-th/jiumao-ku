import { useEffect, useMemo, useRef, useState } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import { useMoyeeStore } from './store'
import {
  AUDIO_CONTAINERS,
  PLATFORM_PRESETS,
  VIDEO_CONTAINERS,
  audioCodecFor,
  videoCodecFor,
} from './domain/platforms'
import type { AppMode, ExtractMode, OutputProfile } from './types'

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
  const setCompressMode = useMoyeeStore((s) => s.setCompressMode)
  const setCompressQuality = useMoyeeStore((s) => s.setCompressQuality)

  const { t } = useT()
  const [panel, setPanel] = useState<AppMode | 'manual'>('convert')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const nav = useMemo(
    () =>
      [
        { id: 'convert' as const, label: t('moyee.modeConvert') },
        { id: 'compress' as const, label: t('moyee.modeCompress') },
        { id: 'music' as const, label: t('moyee.modeMusic') },
        { id: 'merge' as const, label: t('moyee.modeMerge') },
        { id: 'extract' as const, label: t('moyee.modeExtract') },
        { id: 'manual' as const, label: t('moyee.modeManual') },
      ] satisfies { id: AppMode | 'manual'; label: string }[],
    [t],
  )

  useEffect(() => {
    void ensureEngine()
  }, [ensureEngine])

  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? null,
    [jobs, selectedId],
  )

  const onPickMode = (id: AppMode | 'manual') => {
    setPanel(id)
    if (id !== 'manual') setMode(id)
  }

  const applyProfile = (next: OutputProfile) => {
    if (!selected) return
    updateProfile(selected.id, next)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/moyee/">
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
          <a href="/">{t('common.backHome')}</a>
          <LangSwitchHost />
        </div>
      </header>

      <aside className="sidebar">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-btn ${panel === item.id ? 'active' : ''}`}
            onClick={() => onPickMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </aside>

      <main className="main">
        {panel === 'manual' ? (
          <ManualPanel />
        ) : (
          <>
            <div
              className={`dropzone ${dragOver ? 'dragover' : ''}`}
              onClick={() => inputRef.current?.click()}
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
            >
              <strong>{t('moyee.dropHint')}</strong>
              <span>
                {mode === 'merge'
                  ? t('moyee.dropMergeHint')
                  : mode === 'music'
                    ? t('moyee.dropMusicHint')
                    : t('moyee.privacyNote')}
              </span>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={
                  mode === 'music'
                    ? 'audio/*,video/*'
                    : 'video/*,audio/*'
                }
                hidden
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {jobs.length === 0 ? (
              <p className="empty-hint">{t('moyee.noJobs')}</p>
            ) : (
              <div className="task-list">
                {jobs.map((job) => {
                  const shown =
                    job.status === 'completed' && job.outputMeta ? job.outputMeta : job.meta
                  const isImageThumb =
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(shown.fileName) && !shown.hasVideo
                  return (
                  <article
                    key={job.id}
                    className={`task-card ${job.id === selectedId ? 'selected' : ''}`}
                    onClick={() => selectJob(job.id)}
                  >
                    {shown.hasVideo ? (
                      <video className="task-thumb" src={shown.previewUrl} muted />
                    ) : isImageThumb ? (
                      <img className="task-thumb" src={shown.previewUrl} alt="" />
                    ) : (
                      <div className="task-thumb audio">{t('moyee.audioBadge')}</div>
                    )}
                    <div>
                      <p className="task-name">{shown.fileName}</p>
                      <p className="task-meta">
                        {formatBytes(shown.fileSize)}
                        {shown.durationSecs
                          ? ` · ${shown.durationSecs.toFixed(1)}s`
                          : ''}
                        {shown.width && shown.height
                          ? ` · ${shown.width}×${shown.height}`
                          : ''}
                        {job.status === 'completed' ? ` · ${t('moyee.outputMarker')}` : ''}
                      </p>
                    </div>
                    <div className="task-actions">
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
                      {job.status === 'completed' ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadJob(job.id)
                          }}
                        >
                          {t('moyee.download')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeJob(job.id)
                        }}
                      >
                        {t('moyee.remove')}
                      </button>
                    </div>
                  </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <aside className="inspector">
        {panel === 'manual' ? (
          <>
            <h2>{t('moyee.webGuideTitle')}</h2>
            <p className="banner">
              {t('moyee.webGuideLead')}
            </p>
          </>
        ) : !selected ? (
          <>
            <h2>{t('moyee.settingsTitle')}</h2>
            <p className="banner">{t('moyee.settingsNoSelection')}</p>
          </>
        ) : (
          <Inspector
            mode={mode}
            profile={selected.profile}
            previewUrl={
              selected.status === 'completed' && selected.outputMeta
                ? selected.outputMeta.previewUrl
                : selected.meta.previewUrl
            }
            hasVideo={
              selected.status === 'completed' && selected.outputMeta
                ? selected.outputMeta.hasVideo
                : selected.meta.hasVideo
            }
            fileName={
              selected.status === 'completed' && selected.outputMeta
                ? selected.outputMeta.fileName
                : selected.meta.fileName
            }
            durationSecs={
              selected.status === 'completed' && selected.outputMeta
                ? selected.outputMeta.durationSecs
                : selected.meta.durationSecs
            }
            compressMode={compressMode}
            compressQuality={compressQuality}
            onCompressMode={setCompressMode}
            onCompressQuality={setCompressQuality}
            onChange={applyProfile}
          />
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
            <a href="/legal/#privacy">{t('common.privacy')}</a>
            {' · '}
            <a href="/legal/#terms">{t('common.terms')}</a>
            {' · '}
            <a href="/legal/#credits">{t('common.credits')}</a>
          </p>
        </div>
        <div className="footer-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!selected || selected.status === 'running' || panel === 'manual'}
            onClick={() => void runSelected()}
          >
            {mode === 'merge' ? t('moyee.startMerge') : t('moyee.start')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!jobs.length || panel === 'manual' || mode === 'merge'}
            onClick={() => void runAll()}
          >
            {t('moyee.startAll')}
          </button>
          {selected?.status === 'completed' ? (
            <button type="button" className="btn" onClick={() => downloadJob(selected.id)}>
              {t('moyee.downloadResult')}
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function Inspector({
  mode,
  profile,
  previewUrl,
  hasVideo,
  fileName,
  durationSecs,
  compressMode,
  compressQuality,
  onCompressMode,
  onCompressQuality,
  onChange,
}: {
  mode: AppMode
  profile: OutputProfile
  previewUrl: string
  hasVideo: boolean
  fileName: string
  durationSecs?: number
  compressMode: 'standard' | 'highQuality' | 'maxCompress'
  compressQuality: number
  onCompressMode: (m: 'standard' | 'highQuality' | 'maxCompress') => void
  onCompressQuality: (q: number) => void
  onChange: (p: OutputProfile) => void
}) {
  const { t } = useT()
  const containers = mode === 'music' || mode === 'extract' ? AUDIO_CONTAINERS : VIDEO_CONTAINERS
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) && !hasVideo

  return (
    <>
      <h2>{modeTitle(mode, t)}</h2>

      <section className="field-group">
        <h3>{t('moyee.preview')}</h3>
        <div className="preview-box">
          {hasVideo ? (
            <video key={previewUrl} src={previewUrl} controls playsInline preload="metadata" />
          ) : isImage ? (
            <img key={previewUrl} src={previewUrl} alt={fileName} style={{ width: '100%', display: 'block' }} />
          ) : (
            <audio key={previewUrl} src={previewUrl} controls preload="metadata" />
          )}
        </div>
        <p className="banner">{fileName}</p>
      </section>

      {mode === 'merge' ? (
        <p className="banner">{t('moyee.mergeHint')}</p>
      ) : null}

      {mode === 'compress' ? (
        <section className="field-group">
          <h3>{t('moyee.compressTitle')}</h3>
          <div className="field">
            <label htmlFor="cmode">{t('moyee.modeLabel')}</label>
            <select
              id="cmode"
              value={compressMode}
              onChange={(e) =>
                onCompressMode(e.target.value as 'standard' | 'highQuality' | 'maxCompress')
              }
            >
              <option value="standard">{t('moyee.compressStandard')}</option>
              <option value="highQuality">{t('moyee.compressHighQuality')}</option>
              <option value="maxCompress">{t('moyee.compressMaxCompress')}</option>
            </select>
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
          <p className="banner">
            {t('moyee.crfHint', {
              crf: profile.crf ?? '-',
              container: profile.container.toUpperCase(),
            })}
          </p>
        </section>
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

      {mode === 'convert' ? (
        <section className="field-group">
          <h3>{t('moyee.platformPresets')}</h3>
          <div className="field">
            <label htmlFor="plat">{t('moyee.platformSpec')}</label>
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
                if (preset) onChange({ ...preset.profile })
              }}
            >
              <option value="">{t('moyee.platformCustom')}</option>
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
      ) : null}

      {mode !== 'merge' && !(mode === 'extract' && profile.extractMode !== 'audio') ? (
        <section className="field-group">
          <h3>{t('moyee.formatTitle')}</h3>
          <div className="field">
            <label htmlFor="fmt">{t('moyee.container')}</label>
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
          {mode === 'convert' || mode === 'music' ? (
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
          {mode === 'convert' ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="w">{t('moyee.width')}</label>
                <input
                  id="w"
                  type="number"
                  placeholder={t('moyee.originalResolution')}
                  value={profile.width ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...profile,
                      width: e.target.value ? Number(e.target.value) : null,
                      keepOriginalResolution: !e.target.value,
                      platformId: null,
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="h">{t('moyee.height')}</label>
                <input
                  id="h"
                  type="number"
                  placeholder={t('moyee.originalResolution')}
                  value={profile.height ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...profile,
                      height: e.target.value ? Number(e.target.value) : null,
                      keepOriginalResolution: !e.target.value,
                      platformId: null,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode !== 'merge' ? (
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

      {mode === 'convert' ? (
        <>
          <section className="field-group">
            <h3>{t('moyee.picture')}</h3>
            <div className="field">
              <label htmlFor="rot">{t('moyee.rotate')}</label>
              <select
                id="rot"
                value={profile.rotateDegrees ?? 0}
                onChange={(e) =>
                  onChange({ ...profile, rotateDegrees: Number(e.target.value), platformId: null })
                }
              >
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
            </div>
            <div className="field-row">
              <label>
                <input
                  type="checkbox"
                  checked={!!profile.hFlip}
                  onChange={(e) => onChange({ ...profile, hFlip: e.target.checked })}
                />{' '}
                {t('moyee.hFlip')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!profile.vFlip}
                  onChange={(e) => onChange({ ...profile, vFlip: e.target.checked })}
                />{' '}
                {t('moyee.vFlip')}
              </label>
            </div>
            <div className="field">
              <label htmlFor="aspect">{t('moyee.aspectMode')}</label>
              <select
                id="aspect"
                value={profile.aspectMode}
                onChange={(e) =>
                  onChange({
                    ...profile,
                    aspectMode: e.target.value as OutputProfile['aspectMode'],
                  })
                }
              >
                <option value="keep">{t('moyee.aspectKeep')}</option>
                <option value="crop">{t('moyee.aspectCrop')}</option>
                <option value="stretch">{t('moyee.aspectStretch')}</option>
              </select>
            </div>
          </section>

          <section className="field-group">
            <h3>{t('moyee.watermarkLoudness')}</h3>
            <label>
              <input
                type="checkbox"
                checked={!!profile.watermarkEnabled}
                onChange={(e) => onChange({ ...profile, watermarkEnabled: e.target.checked })}
              />{' '}
              {t('moyee.enableTextWatermark')}
            </label>
            <div className="field">
              <label htmlFor="wm">{t('moyee.watermarkText')}</label>
              <input
                id="wm"
                type="text"
                value={profile.watermarkText ?? ''}
                onChange={(e) => onChange({ ...profile, watermarkText: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="wmp">{t('moyee.watermarkPosition')}</label>
              <select
                id="wmp"
                value={profile.watermarkPosition ?? 'br'}
                onChange={(e) =>
                  onChange({
                    ...profile,
                    watermarkPosition: e.target.value as OutputProfile['watermarkPosition'],
                  })
                }
              >
                <option value="tl">{t('moyee.positionTl')}</option>
                <option value="tr">{t('moyee.positionTr')}</option>
                <option value="bl">{t('moyee.positionBl')}</option>
                <option value="br">{t('moyee.positionBr')}</option>
                <option value="center">{t('moyee.positionCenter')}</option>
              </select>
            </div>
            <label>
              <input
                type="checkbox"
                checked={!!profile.loudnormEnabled}
                onChange={(e) => onChange({ ...profile, loudnormEnabled: e.target.checked })}
              />{' '}
              {t('moyee.loudnorm')}
            </label>
          </section>
        </>
      ) : null}
    </>
  )
}

function ManualPanel() {
  const { t, tList } = useT()

  return (
    <div className="manual" style={{ padding: '1.25rem 1.5rem', overflow: 'auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
        {t('moyee.manualTitle')}
      </h2>
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
        <a href="/" style={{ color: 'var(--gold-soft)' }}>
          {t('common.brand')}
        </a>{' '}
        {t('moyee.manualDownloadSuffix')}
      </p>
    </div>
  )
}
