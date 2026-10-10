import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import { downloadBlob, runMuteExport } from './engine'

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const loadFileRef = useRef<(f: File) => void>(() => {})
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoW, setVideoW] = useState(0)
  const [videoH, setVideoH] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const loadFile = useCallback(
    (f: File) => {
      if (!isVideoFile(f)) {
        setError(t('videoMute.dropHint'))
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
      setPhase(null)
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
        setVideoW(probe.videoWidth || 0)
        setVideoH(probe.videoHeight || 0)
        probe.removeAttribute('src')
        probe.load()
      }
      probe.onerror = () => {
        setError(t('videoMute.errorGeneric'))
      }
    },
    [t],
  )

  loadFileRef.current = loadFile

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

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
      else if (files.length) setError(t('videoMute.dropHint'))
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

  const start = async () => {
    if (!file || status === 'running') return
    setStatus('running')
    setProgress(3)
    setPhase(t('videoMute.loadingEngine'))
    setError(null)
    setResult(null)
    try {
      const out = await runMuteExport({
        file,
        onProgress: (r) =>
          setProgress((prev) => Math.max(prev, Math.min(99, Math.round(r * 100)))),
        onPhase: (p) => {
          if (p === 'load') {
            setPhase(t('videoMute.loadingEngine'))
            setProgress((prev) => Math.max(prev, 8))
          } else if (p === 'write') {
            setPhase(t('videoMute.writingFile'))
            setProgress((prev) => Math.max(prev, 22))
          } else if (p === 'mute') {
            setPhase(t('videoMute.muting'))
            setProgress((prev) => Math.max(prev, 48))
          } else if (p === 'encode') {
            setPhase(t('videoMute.encoding'))
            setProgress((prev) => Math.max(prev, 62))
          }
        },
      })
      if (!out.blob || out.blob.size < 32) {
        throw new Error(t('videoMute.errorGeneric'))
      }
      setResult(out)
      setProgress(100)
      setPhase(t('videoMute.done'))
      setStatus('done')
    } catch (e) {
      setResult(null)
      setPhase(null)
      setProgress(0)
      setStatus('failed')
      setError(e instanceof Error ? e.message : t('videoMute.errorGeneric'))
    }
  }

  return (
    <div className="vm-app">
      <header className="vm-top">
        <a className="vm-brand" href={lh('/')}>
          {t('common.brand')}
        </a>
        <div className="vm-top-right">
          <LangSwitchHost />
          <a className="vm-home" href={lh('/')}>
            {t('common.backHome')}
          </a>
        </div>
      </header>

      <main className="vm-main">
        <section className="vm-left">
          <div className="vm-left-head">
            <h1>{t('videoMute.heroTitle')}</h1>
            <p>{t('videoMute.heroLead')}</p>
          </div>

          <div
            ref={dropRef}
            className={`vm-dropzone${dragOver ? ' is-dragover' : ''}`}
          >
            {previewUrl ? (
              <div className="vm-stage">
                <video
                  ref={videoRef}
                  className="vm-video"
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : (
              <button
                type="button"
                className="vm-empty"
                onClick={() => inputRef.current?.click()}
              >
                <strong>{t('videoMute.dropTitle')}</strong>
                <span>{t('videoMute.dropHint')}</span>
              </button>
            )}
          </div>

          <div className="vm-filebar">
            {file ? (
              <>
                <div className="vm-file-meta">
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
                  className="vm-btn ghost"
                  onClick={() => inputRef.current?.click()}
                >
                  {t('videoMute.reselect')}
                </button>
              </>
            ) : (
              <span className="vm-file-placeholder">{t('videoMute.noFile')}</span>
            )}
          </div>
        </section>

        <aside className="vm-right">
          <div className="vm-right-head">
            <h2>{t('videoMute.settingsTitle')}</h2>
            <p>{t('videoMute.settingsLead')}</p>
          </div>

          {error ? <p className="vm-error">{error}</p> : null}

          <div className="vm-actions">
            <button
              type="button"
              className={`vm-cta${
                status === 'running' || status === 'done' ? ' is-progress' : ''
              }${status === 'done' ? ' is-done' : ''}`}
              style={
                status === 'running' || status === 'done'
                  ? ({
                      '--cta-progress': `${status === 'done' ? 100 : progress}%`,
                    } as CSSProperties)
                  : undefined
              }
              disabled={!file || status === 'running'}
              onClick={() => {
                if (status === 'done') return
                void start()
              }}
            >
              <span className="cta-label">
                {status === 'done'
                  ? t('videoMute.done')
                  : status === 'running'
                    ? phase || t('videoMute.processing')
                    : t('videoMute.start')}
              </span>
              {status === 'running' || status === 'done' ? (
                <span className="cta-pct">{status === 'done' ? 100 : progress}%</span>
              ) : null}
            </button>
            {status === 'done' && result ? (
              <button
                type="button"
                className="vm-btn"
                onClick={() => downloadBlob(result.blob, result.fileName)}
              >
                {t('videoMute.download')}
              </button>
            ) : null}
          </div>

          <p className="vm-privacy">{t('videoMute.privacyNote')}</p>
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
