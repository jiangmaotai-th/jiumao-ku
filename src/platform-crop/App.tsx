import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import { CropStage } from './CropStage'
import { downloadBlob, runCropExport } from './engine'
import {
  BITRATE_OPTIONS,
  CONTAINERS,
  MAX_EDGE_OPTIONS,
  PLATFORM_CROP_PRESETS,
  aspectLabel,
  autoPresetId,
  maxInscribedRect,
  presetById,
  resolveOutputSize,
  type CropRect,
} from './presets'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function isVideoFile(f: File): boolean {
  if (f.type.startsWith('video/')) return true
  return /\.(mp4|mov|mkv|webm|m4v|avi|mpeg|mpg|3gp|mts|m2ts)$/i.test(f.name)
}

function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const out: File[] = []
  if (dt.items && dt.items.length) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== 'file') continue
      const f = item.getAsFile()
      if (f) out.push(f)
    }
  }
  if (!out.length && dt.files?.length) {
    out.push(...Array.from(dt.files))
  }
  return out
}

type Status = 'idle' | 'running' | 'done' | 'failed'

export function App() {
  const { t, lh } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const loadFileRef = useRef<(f: File) => void>(() => {})
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoW, setVideoW] = useState(0)
  const [videoH, setVideoH] = useState(0)
  const [presetId, setPresetId] = useState('youtube')
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 })
  const [menuOpen, setMenuOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [container, setContainer] = useState<'mp4' | 'mov' | 'webm'>('mp4')
  const [bitrate, setBitrate] = useState(8000)
  const [maxEdge, setMaxEdge] = useState(1080)
  const [outW, setOutW] = useState(1920)
  const [outH, setOutH] = useState(1080)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const preset = presetById(presetId)

  const applyPreset = useCallback(
    (id: string, vw: number, vh: number) => {
      const p = presetById(id)
      setPresetId(id)
      setContainer(p.container)
      setBitrate(p.videoBitrateKbps)
      const rect = maxInscribedRect(vw, vh, p.aspect)
      setCrop(rect)
      const size = resolveOutputSize(p, rect, vw, vh, maxEdge)
      setOutW(size.width)
      setOutH(size.height)
    },
    [maxEdge],
  )

  const loadFile = useCallback(
    (f: File) => {
      if (!isVideoFile(f)) {
        setError(t('platformCrop.dropHint'))
        return
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      const url = URL.createObjectURL(f)
      previewUrlRef.current = url
      setFile(f)
      setPreviewUrl(url)
      setStatus('idle')
      setProgress(0)
      setError(null)
      setResult(null)
      setVideoW(0)
      setVideoH(0)

      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.muted = true
      probe.playsInline = true
      probe.src = url
      probe.onloadedmetadata = () => {
        const vw = probe.videoWidth || 1280
        const vh = probe.videoHeight || 720
        setVideoW(vw)
        setVideoH(vh)
        applyPreset(autoPresetId(vw, vh), vw, vh)
        probe.removeAttribute('src')
        probe.load()
      }
      probe.onerror = () => {
        setError(t('platformCrop.errorGeneric'))
      }
    },
    [applyPreset, t],
  )

  loadFileRef.current = loadFile

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  // Capture-phase: stop browser from opening/downloading the dropped file.
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
    }
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('drop', onDrop, true)
    return () => {
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('drop', onDrop, true)
    }
  }, [])

  // Native drop on the preview zone (more reliable than React synthetic DnD).
  useEffect(() => {
    const el = dropRef.current
    if (!el) return

    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      setDragOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.currentTarget instanceof Node && e.relatedTarget instanceof Node) {
        if ((e.currentTarget as Node).contains(e.relatedTarget)) return
      }
      setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const files = filesFromDataTransfer(e.dataTransfer)
      const video = files.find(isVideoFile)
      if (video) loadFileRef.current(video)
      else if (files.length) setError(t('platformCrop.dropHint'))
    }

    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [t])

  const onPickPreset = (id: string) => {
    setMenuOpen(false)
    if (!videoW || !videoH) {
      setPresetId(id)
      const p = presetById(id)
      setContainer(p.container)
      setBitrate(p.videoBitrateKbps)
      return
    }
    applyPreset(id, videoW, videoH)
  }

  useEffect(() => {
    if (!videoW || !videoH) return
    const size = resolveOutputSize(preset, crop, videoW, videoH, maxEdge)
    // Only auto-update size for free preset from crop; locked presets keep preset size
    if (preset.aspect == null) {
      setOutW(size.width)
      setOutH(size.height)
    }
  }, [crop, maxEdge, preset, videoW, videoH])

  const summary = useMemo(() => {
    return t('platformCrop.exportSummary', {
      size: `${outW}×${outH}`,
      format: container.toUpperCase(),
      bitrate: `${(bitrate / 1000).toFixed(bitrate % 1000 === 0 ? 0 : 1)} Mbps`,
    })
  }, [bitrate, container, outW, outH, t])

  const start = async () => {
    if (!file || !videoW || !videoH || status === 'running') return
    setStatus('running')
    setProgress(0)
    setError(null)
    setResult(null)
    try {
      const out = await runCropExport({
        file,
        crop,
        videoWidth: videoW,
        videoHeight: videoH,
        outWidth: outW,
        outHeight: outH,
        container,
        videoBitrateKbps: bitrate,
        audioBitrateKbps: preset.audioBitrateKbps,
        onProgress: (r) => setProgress(Math.round(r * 100)),
      })
      setResult(out)
      setProgress(100)
      setStatus('done')
      // Don't auto-download — user clicks「下载结果」when ready.
    } catch (e) {
      setStatus('failed')
      setError(e instanceof Error ? e.message : t('platformCrop.errorGeneric'))
    }
  }

  const platformPresets = PLATFORM_CROP_PRESETS.filter((p) => p.group === 'platform')
  const standardPresets = PLATFORM_CROP_PRESETS.filter((p) => p.group === 'standard')

  return (
    <div className="pc-app">
      <header className="pc-top">
        <a className="pc-brand" href={lh('/')}>
          {t('common.brand')}
        </a>
        <div className="pc-top-right">
          <LangSwitchHost />
          <a className="pc-home" href={lh('/')}>
            {t('common.backHome')}
          </a>
        </div>
      </header>

      <main className="pc-main">
        <section className="pc-left">
          <div className="pc-left-head">
            <h1>{t('platformCrop.heroTitle')}</h1>
            <p>{t('platformCrop.heroLead')}</p>
          </div>

          <div
            ref={dropRef}
            className={`pc-dropzone${dragOver ? ' is-dragover' : ''}`}
          >
            <CropStage
              src={previewUrl}
              crop={crop}
              onCropChange={setCrop}
              lockAspect={preset.aspect}
              videoWidth={videoW}
              videoHeight={videoH}
              emptyLabel={t('platformCrop.dropTitle')}
              emptyHint={t('platformCrop.dropHint')}
              onPickFile={() => inputRef.current?.click()}
            />
          </div>

          <div className="pc-filebar">
            {file ? (
              <>
                <div className="pc-file-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                  {videoW && videoH ? (
                    <span>
                      {videoW}×{videoH}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="pc-btn ghost"
                  onClick={() => inputRef.current?.click()}
                >
                  {t('platformCrop.reselect')}
                </button>
              </>
            ) : (
              <span className="pc-file-placeholder">{t('platformCrop.noFile')}</span>
            )}
          </div>
        </section>

        <aside className="pc-right">
          <div className="pc-right-head">
            <h2>{t('platformCrop.settingsTitle')}</h2>
          </div>

          <label className="pc-label">{t('platformCrop.aspectRatio')}</label>
          <div className={`pc-preset ${menuOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="pc-preset-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              <span className="pc-preset-mark">{preset.mark}</span>
              <span className="pc-preset-name">
                {t(`platformCrop.preset.${preset.nameKey}`)}
              </span>
              <span className="pc-preset-ar">{aspectLabel(preset.aspect)}</span>
              <span className="pc-preset-chev">{menuOpen ? '▴' : '▾'}</span>
            </button>
            {menuOpen ? (
              <div className="pc-preset-menu" role="listbox">
                {platformPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pc-preset-item${p.id === presetId ? ' active' : ''}`}
                    onClick={() => onPickPreset(p.id)}
                  >
                    <span className="pc-preset-mark">{p.mark}</span>
                    <span className="pc-preset-name">
                      {t(`platformCrop.preset.${p.nameKey}`)}
                    </span>
                    <span className="pc-preset-ar">{aspectLabel(p.aspect)}</span>
                    {p.id === presetId ? <span className="pc-check">✓</span> : null}
                  </button>
                ))}
                <div className="pc-preset-section">{t('platformCrop.standardGroup')}</div>
                {standardPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pc-preset-item${p.id === presetId ? ' active' : ''}`}
                    onClick={() => onPickPreset(p.id)}
                  >
                    <span className="pc-preset-mark">{p.mark}</span>
                    <span className="pc-preset-name">
                      {t(`platformCrop.preset.${p.nameKey}`)}
                    </span>
                    <span className="pc-preset-ar">{aspectLabel(p.aspect)}</span>
                    {p.id === presetId ? <span className="pc-check">✓</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <p className="pc-summary">{summary}</p>

          <button
            type="button"
            className="pc-advanced-toggle"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? t('platformCrop.hideAdvanced') : t('platformCrop.showAdvanced')}
          </button>

          {advancedOpen ? (
            <div className="pc-advanced">
              <div className="pc-field">
                <label htmlFor="pc-fmt">{t('platformCrop.container')}</label>
                <select
                  id="pc-fmt"
                  value={container}
                  onChange={(e) =>
                    setContainer(e.target.value as 'mp4' | 'mov' | 'webm')
                  }
                >
                  {CONTAINERS.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pc-field">
                <label htmlFor="pc-br">{t('platformCrop.bitrate')}</label>
                <select
                  id="pc-br"
                  value={bitrate}
                  onChange={(e) => setBitrate(Number(e.target.value))}
                >
                  {BITRATE_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {(b / 1000).toFixed(b % 1000 === 0 ? 0 : 1)} Mbps
                    </option>
                  ))}
                </select>
              </div>
              {preset.aspect == null ? (
                <div className="pc-field">
                  <label htmlFor="pc-edge">{t('platformCrop.maxEdge')}</label>
                  <select
                    id="pc-edge"
                    value={maxEdge}
                    onChange={(e) => setMaxEdge(Number(e.target.value))}
                  >
                    {MAX_EDGE_OPTIONS.map((e) => (
                      <option key={e} value={e}>
                        {e}p
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="pc-field-row">
                  <div className="pc-field">
                    <label htmlFor="pc-ow">{t('platformCrop.width')}</label>
                    <input
                      id="pc-ow"
                      type="number"
                      min={16}
                      step={2}
                      value={outW}
                      onChange={(e) => setOutW(Number(e.target.value) || outW)}
                    />
                  </div>
                  <div className="pc-field">
                    <label htmlFor="pc-oh">{t('platformCrop.height')}</label>
                    <input
                      id="pc-oh"
                      type="number"
                      min={16}
                      step={2}
                      value={outH}
                      onChange={(e) => setOutH(Number(e.target.value) || outH)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="pc-error">{error}</p> : null}

          <div className="pc-actions">
            <button
              type="button"
              className={`pc-cta${status === 'running' ? ' is-progress' : ''}`}
              style={
                status === 'running'
                  ? ({ '--cta-progress': `${progress}%` } as CSSProperties)
                  : undefined
              }
              disabled={!file || status === 'running'}
              onClick={() => void start()}
            >
              <span className="cta-label">
                {status === 'running' ? t('platformCrop.processing') : t('platformCrop.start')}
              </span>
              {status === 'running' ? <span className="cta-pct">{progress}%</span> : null}
            </button>
            {status === 'done' && result ? (
              <button
                type="button"
                className="pc-btn"
                onClick={() => downloadBlob(result.blob, result.fileName)}
              >
                {t('platformCrop.download')}
              </button>
            ) : null}
          </div>

          <p className="pc-privacy">{t('platformCrop.privacyNote')}</p>
        </aside>
      </main>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.mkv,.webm,.m4v,.avi"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) loadFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
