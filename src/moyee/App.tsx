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

function statusLabel(status: string, progress: number): string {
  if (status === 'running') return `${progress}%`
  if (status === 'completed') return '完成'
  if (status === 'failed') return '失败'
  return '就绪'
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
              <strong>拖放文件到这里，或点击选择</strong>
              <span>
                {mode === 'merge'
                  ? '合并模式：按顺序添加至少 2 个视频'
                  : mode === 'music'
                    ? '支持常见音频 / 视频（提取音轨）'
                    : '文件只在浏览器内处理，不会上传到服务器'}
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
              <p className="empty-hint">还没有任务。添加媒体后可在右侧调整参数。</p>
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
                      <div className="task-thumb audio">AUDIO</div>
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
                        {job.status === 'completed' ? ' · 输出' : ''}
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
                        {statusLabel(job.status, job.progress)}
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
                          下载
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
                        移除
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
            <h2>网页版说明</h2>
            <p className="banner">
              对齐桌面版核心工作流：转换、压缩、音频、合并、提取与平台预设。处理在本地浏览器完成。
            </p>
          </>
        ) : !selected ? (
          <>
            <h2>输出设置</h2>
            <p className="banner">选择一个任务后可编辑参数。</p>
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
          <p className="banner">{banner ?? '魔叶Converte 网页版 · maotaiworks.com'}</p>
          <p className="privacy-note">
            <span className="local-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
                <path d="M5 14.2h6M8 11.5v2.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                <circle cx="8" cy="7" r="1.35" fill="currentColor" />
              </svg>
            </span>
            本地处理｜转换压缩全在本机完成，不上传、不联网，隐私零泄露。{' '}
            <a href="/legal/#privacy">隐私说明</a>
            {' · '}
            <a href="/legal/#terms">使用条款</a>
            {' · '}
            <a href="/legal/#credits">开源致谢</a>
          </p>
        </div>
        <div className="footer-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!selected || selected.status === 'running' || panel === 'manual'}
            onClick={() => void runSelected()}
          >
            {mode === 'merge' ? '开始合并' : '开始转换'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!jobs.length || panel === 'manual' || mode === 'merge'}
            onClick={() => void runAll()}
          >
            全部开始
          </button>
          {selected?.status === 'completed' ? (
            <button type="button" className="btn" onClick={() => downloadJob(selected.id)}>
              下载结果
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
  const containers = mode === 'music' || mode === 'extract' ? AUDIO_CONTAINERS : VIDEO_CONTAINERS
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) && !hasVideo

  return (
    <>
      <h2>
        {mode === 'convert'
          ? '转换'
          : mode === 'compress'
            ? '压缩'
            : mode === 'music'
              ? '音频'
              : mode === 'merge'
                ? '合并'
                : '提取'}
      </h2>

      <section className="field-group">
        <h3>预览</h3>
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
        <p className="banner">将按任务列表顺序拼接（尽量使用相同编码的视频）。</p>
      ) : null}

      {mode === 'compress' ? (
        <section className="field-group">
          <h3>压缩</h3>
          <div className="field">
            <label htmlFor="cmode">模式</label>
            <select
              id="cmode"
              value={compressMode}
              onChange={(e) =>
                onCompressMode(e.target.value as 'standard' | 'highQuality' | 'maxCompress')
              }
            >
              <option value="standard">标准</option>
              <option value="highQuality">高质量</option>
              <option value="maxCompress">极限压缩</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cq">画质 {compressQuality}</label>
            <input
              id="cq"
              type="range"
              min={0}
              max={100}
              value={compressQuality}
              onChange={(e) => onCompressQuality(Number(e.target.value))}
            />
          </div>
          <p className="banner">CRF ≈ {profile.crf ?? '—'} · 保持原容器 {profile.container.toUpperCase()}</p>
        </section>
      ) : null}

      {mode === 'extract' ? (
        <section className="field-group">
          <h3>提取类型</h3>
          <div className="field">
            <label htmlFor="ex">模式</label>
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
              <option value="audio">提取音频</option>
              <option value="gif">转 GIF</option>
              <option value="cover">封面图</option>
            </select>
          </div>
        </section>
      ) : null}

      {mode === 'convert' ? (
        <section className="field-group">
          <h3>平台预设</h3>
          <div className="field">
            <label htmlFor="plat">一键规格</label>
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
              <option value="">自定义</option>
              <optgroup label="社交平台">
                {PLATFORM_PRESETS.filter((p) => p.category === 'social').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="卖家">
                {PLATFORM_PRESETS.filter((p) => p.category === 'seller').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </section>
      ) : null}

      {mode !== 'merge' && !(mode === 'extract' && profile.extractMode !== 'audio') ? (
        <section className="field-group">
          <h3>格式</h3>
          <div className="field">
            <label htmlFor="fmt">容器</label>
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
                <label htmlFor="ab">音频码率</label>
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
                <label htmlFor="ar">采样率</label>
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
                  <option value="">原始</option>
                  <option value="44100">44100</option>
                  <option value="48000">48000</option>
                </select>
              </div>
            </div>
          ) : null}
          {mode === 'convert' ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="w">宽</label>
                <input
                  id="w"
                  type="number"
                  placeholder="原画"
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
                <label htmlFor="h">高</label>
                <input
                  id="h"
                  type="number"
                  placeholder="原画"
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
          <h3>时间范围</h3>
          <div className="field-row">
            <div className="field">
              <label htmlFor="ts">起点（秒）</label>
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
              <label htmlFor="te">终点（秒）</label>
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
            清除裁剪
          </button>
        </section>
      ) : null}

      {mode === 'convert' ? (
        <>
          <section className="field-group">
            <h3>画面</h3>
            <div className="field">
              <label htmlFor="rot">旋转</label>
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
                水平翻转
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!profile.vFlip}
                  onChange={(e) => onChange({ ...profile, vFlip: e.target.checked })}
                />{' '}
                垂直翻转
              </label>
            </div>
            <div className="field">
              <label htmlFor="aspect">比例模式</label>
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
                <option value="keep">保持（补边）</option>
                <option value="crop">裁切填充</option>
                <option value="stretch">拉伸</option>
              </select>
            </div>
          </section>

          <section className="field-group">
            <h3>水印 / 响度</h3>
            <label>
              <input
                type="checkbox"
                checked={!!profile.watermarkEnabled}
                onChange={(e) => onChange({ ...profile, watermarkEnabled: e.target.checked })}
              />{' '}
              启用文字水印
            </label>
            <div className="field">
              <label htmlFor="wm">水印文字</label>
              <input
                id="wm"
                type="text"
                value={profile.watermarkText ?? ''}
                onChange={(e) => onChange({ ...profile, watermarkText: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="wmp">位置</label>
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
                <option value="tl">左上</option>
                <option value="tr">右上</option>
                <option value="bl">左下</option>
                <option value="br">右下</option>
                <option value="center">居中</option>
              </select>
            </div>
            <label>
              <input
                type="checkbox"
                checked={!!profile.loudnormEnabled}
                onChange={(e) => onChange({ ...profile, loudnormEnabled: e.target.checked })}
              />{' '}
              响度标准化
            </label>
          </section>
        </>
      ) : null}
    </>
  )
}

function ManualPanel() {
  return (
    <div className="manual" style={{ padding: '1.25rem 1.5rem', overflow: 'auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>使用说明</h2>
      <p>
        MoyeeConverter 是一款全能视频音频转换器，格式转换、体积压缩、参数精调一站式搞定。网页版在浏览器内用
        FFmpeg（WebAssembly）处理媒体，文件不会上传到服务器。
      </p>
      <h3>功能对齐</h3>
      <ul>
        <li>视频转换：格式、分辨率、平台预设（抖音 / 小红书 / YouTube 等）</li>
        <li>视频压缩：标准 / 高质量 / 极限 + 画质滑杆</li>
        <li>音频转换：MP3 / M4A / WAV / FLAC / OGG</li>
        <li>合并：多段视频顺序拼接</li>
        <li>提取：音轨 / GIF / 封面</li>
        <li>裁剪时间、旋转翻转、文字水印、响度标准化</li>
      </ul>
      <h3>与桌面版差异</h3>
      <ul>
        <li>大文件会更慢，并受浏览器内存限制（建议单文件 &lt; 500MB）</li>
        <li>图片水印、外挂字幕烧录、硬件加速等以桌面版为准</li>
        <li>首次打开需下载约 25MB 的 FFmpeg 引擎（可缓存）</li>
      </ul>
      <p>
        需要完整批量与桌面体验时，请到{' '}
        <a href="/" style={{ color: 'var(--gold-soft)' }}>
          九猫库
        </a>{' '}
        下载安装包。
      </p>
    </div>
  )
}
