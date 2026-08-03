import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import {
  ACCEPT_INPUT,
  detectInputFormat,
  isLossyOutputFormat,
  WEB_OUTPUT_FORMATS,
  type WebOutputFormat,
} from './formats'
import {
  convertImageFile,
  formatBytes,
  previewImageSize,
  runPool,
} from './engine/convert'
import {
  buildOutputRelativePath,
  downloadArtifacts,
  type OutputArtifact,
} from './engine/download'

type FileStatus =
  | 'queued'
  | 'converting'
  | 'compressing'
  | 'success'
  | 'failed'
  | 'cancelled'

interface AppFile {
  id: string
  file: File
  name: string
  relativePath: string
  format: string
  originalSize: number
  status: FileStatus
  progress: number
  selected: boolean
  outputBlob?: Blob
  outputName?: string
  outputRelativePath?: string
  outputSize?: number
  previewSize?: number
  previewPending?: boolean
  previewError?: string
  previewWarning?: string
  error?: string
}

const MAX_RENDERED_ROWS = 600
const MAX_VISIBLE_HISTORY = 600
const MAX_PREVIEW_BATCH = 24

type Translate = (path: string, vars?: Record<string, string | number>) => string

export function App() {
  const { t } = useT()
  const [files, setFiles] = useState<AppFile[]>([])
  const [outputFormat, setOutputFormat] = useState<WebOutputFormat>('JPEG')
  const [targetSizeMb, setTargetSizeMb] = useState(10)
  const [quality, setQuality] = useState(92)
  const [filenameSuffix, setFilenameSuffix] = useState('_converted')
  const [concurrency, setConcurrency] = useState<1 | 2 | 3 | 4>(2)
  const [allowResize, setAllowResize] = useState(false)
  const [autoDownload, setAutoDownload] = useState(true)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<string[]>([t('image.initialNotice')])
  const cancelRef = useRef(false)
  const previewRunRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const previewKey = useMemo(
    () =>
      [
        files.map((file) => `${file.id}:${file.status}`).join('|'),
        outputFormat,
        quality,
        targetSizeMb,
        allowResize,
      ].join('::'),
    [files, outputFormat, quality, targetSizeMb, allowResize],
  )

  useEffect(() => {
    if (busy) return

    const previewableFiles = files
      .filter((file) => file.status === 'queued' || file.status === 'failed')
      .slice(-MAX_PREVIEW_BATCH)

    if (previewableFiles.length === 0) return

    const runId = previewRunRef.current + 1
    previewRunRef.current = runId
    const targetBytes = Math.max(1, Math.round(targetSizeMb * 1024 * 1024))

    setFiles((current) =>
      current.map((file) =>
        file.status === 'queued' || file.status === 'failed'
          ? { ...file, previewPending: true, previewError: undefined }
          : file,
      ),
    )

    const timer = window.setTimeout(() => {
      void (async () => {
        for (const item of previewableFiles) {
          if (previewRunRef.current !== runId) return
          try {
            const estimate = await previewImageSize(item.file, {
              format: outputFormat,
              quality,
              minQuality: 65,
              targetBytes,
              allowResize,
              suffix: filenameSuffix,
            })
            if (previewRunRef.current !== runId) return
            setFiles((current) =>
              current.map((file) =>
                file.id === item.id
                  ? {
                      ...file,
                      previewSize: estimate.size,
                      previewPending: false,
                      previewError: undefined,
                      previewWarning: estimate.warning,
                    }
                  : file,
              ),
            )
          } catch (error) {
            if (previewRunRef.current !== runId) return
            setFiles((current) =>
              current.map((file) =>
                file.id === item.id
                  ? {
                      ...file,
                      previewPending: false,
                      previewError: String(error instanceof Error ? error.message : error),
                    }
                  : file,
              ),
            )
          }
        }
      })()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [previewKey, busy, filenameSuffix])

  const selectedCount = useMemo(
    () => files.filter((file) => file.selected).length,
    [files],
  )
  const queuedCount = useMemo(
    () => files.filter((file) => file.status === 'queued' || file.status === 'failed').length,
    [files],
  )
  const failedCount = useMemo(
    () => files.filter((file) => file.status === 'failed').length,
    [files],
  )
  const successCount = useMemo(
    () => files.filter((file) => file.status === 'success' && file.outputBlob).length,
    [files],
  )
  const canStart = queuedCount > 0
  const showQuality = isLossyOutputFormat(outputFormat)

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list)
    if (!incoming.length) return

    const accepted: AppFile[] = []
    const rejected: string[] = []

    for (const file of incoming) {
      if (file.size === 0) {
        rejected.push(t('image.emptyFileError', { name: file.name }))
        continue
      }
      const format = detectInputFormat(file.name)
      if (!format) {
        rejected.push(t('image.unsupportedFormatError', { name: file.name }))
        continue
      }
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      accepted.push({
        id: `${relativePath}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        relativePath,
        format,
        originalSize: file.size,
        status: 'queued',
        progress: 0,
        selected: true,
      })
    }

    setFiles((current) => {
      const existing = new Set(
        current.map((file) => `${file.relativePath}:${file.originalSize}:${file.file.lastModified}`),
      )
      return [
        ...current,
        ...accepted.filter(
          (file) =>
            !existing.has(`${file.relativePath}:${file.originalSize}:${file.file.lastModified}`),
        ),
      ]
    })

    setMessages([
      ...(accepted.length > 0 ? [t('image.addedFilesMessage', { count: accepted.length })] : []),
      ...rejected.slice(0, 5),
    ])
  }

  const collectArtifacts = (source: AppFile[]): OutputArtifact[] =>
    source
      .filter(
        (file): file is AppFile & { outputBlob: Blob; outputName: string; outputRelativePath: string } =>
          file.status === 'success' &&
          Boolean(file.outputBlob && file.outputName && file.outputRelativePath),
      )
      .map((file) => ({
        blob: file.outputBlob,
        filename: file.outputName,
        relativePath: file.outputRelativePath,
      }))

  const runJobs = async (jobs: AppFile[]) => {
    if (!jobs.length || busy) return
    cancelRef.current = false
    setBusy(true)
    setMessages([])

    const jobIds = new Set(jobs.map((job) => job.id))
    setFiles((current) =>
      current.map((file) =>
        jobIds.has(file.id)
          ? {
              ...file,
              status: 'queued',
              progress: 0,
              error: undefined,
              outputBlob: undefined,
              outputName: undefined,
              outputRelativePath: undefined,
              outputSize: undefined,
              previewPending: true,
            }
          : file,
      ),
    )

    const targetBytes = Math.max(1, Math.round(targetSizeMb * 1024 * 1024))
    let success = 0
    let failed = 0
    const completedArtifacts: OutputArtifact[] = []

    await runPool(
      jobs,
      concurrency,
      async (job) => {
        if (cancelRef.current) {
          setFiles((current) =>
            current.map((file) =>
              file.id === job.id ? { ...file, status: 'cancelled', progress: file.progress } : file,
            ),
          )
          return
        }

        setFiles((current) =>
          current.map((file) =>
            file.id === job.id
              ? { ...file, status: 'converting', progress: 20, error: undefined }
              : file,
          ),
        )

        try {
          const result = await convertImageFile(job.file, {
            format: outputFormat,
            quality,
            minQuality: 65,
            targetBytes,
            allowResize,
            suffix: filenameSuffix,
            onPhase: (phase, progress) => {
              setFiles((current) =>
                current.map((file) =>
                  file.id === job.id ? { ...file, status: phase, progress } : file,
                ),
              )
            },
          })

          if (cancelRef.current) {
            setFiles((current) =>
              current.map((file) =>
                file.id === job.id ? { ...file, status: 'cancelled', progress: file.progress } : file,
              ),
            )
            return
          }

          if (!result.blob || result.size === 0 || result.width === 0 || result.height === 0) {
            throw new Error(t('image.outputValidationFailed'))
          }

          const relativePath = buildOutputRelativePath(job.file, result.filename, outputFormat)
          success += 1
          completedArtifacts.push({
            blob: result.blob,
            filename: result.filename,
            relativePath,
          })

          setFiles((current) =>
            current.map((file) =>
              file.id === job.id
                ? {
                    ...file,
                    status: 'success',
                    progress: 100,
                    outputBlob: result.blob,
                    outputName: result.filename,
                    outputRelativePath: relativePath,
                    outputSize: result.size,
                    previewSize: result.size,
                    previewPending: false,
                    previewError: undefined,
                    previewWarning: undefined,
                    error: result.warning,
                  }
                : file,
            ),
          )
        } catch (error) {
          failed += 1
          const message = String(error instanceof Error ? error.message : error)
          setFiles((current) =>
            current.map((file) =>
              file.id === job.id
                ? { ...file, status: 'failed', progress: 0, error: message }
                : file,
            ),
          )
        }
      },
      () => cancelRef.current,
    )

    setFiles((current) => compactCompletedFiles(current))
    setBusy(false)

    if (cancelRef.current) {
      setMessages([t('image.cancelRequested')])
      return
    }

    setMessages([t('image.conversionComplete', { success, failed })])
    if (autoDownload && completedArtifacts.length > 0) {
      try {
        await downloadArtifacts(completedArtifacts)
      } catch (error) {
        setMessages((current) => [
          ...current,
          t('image.autoDownloadFailed', {
            error: String(error instanceof Error ? error.message : error),
          }),
        ])
      }
    }
  }

  const startConvert = async () => {
    const jobs = files.filter((file) => file.status === 'queued' || file.status === 'failed')
    await runJobs(jobs)
  }

  const retryFailed = async () => {
    const jobs = files.filter((file) => {
      if (file.status !== 'failed') return false
      if (selectedCount === 0) return true
      return file.selected
    })
    await runJobs(jobs)
  }

  const cancelConvert = () => {
    cancelRef.current = true
    setMessages([t('image.cancelRequested')])
  }

  const clearFiles = () => {
    if (busy) return
    setFiles([])
    setMessages([])
  }

  const downloadOutputs = async () => {
    const selectedReady = collectArtifacts(files.filter((file) => file.selected))
    const ready = selectedReady.length > 0 ? selectedReady : collectArtifacts(files)
    if (!ready.length) return
    try {
      await downloadArtifacts(ready)
    } catch (error) {
      setMessages([
        t('image.downloadFailed', {
          error: String(error instanceof Error ? error.message : error),
        }),
      ])
    }
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    const visibleIds = new Set(visibleFiles.map((file) => file.id))
    setFiles((current) =>
      current.map((file) => (visibleIds.has(file.id) ? { ...file, selected: checked } : file)),
    )
  }

  const visibleFiles =
    files.length > MAX_RENDERED_ROWS ? files.slice(-MAX_RENDERED_ROWS) : files
  const allVisibleSelected =
    visibleFiles.length > 0 && visibleFiles.every((file) => file.selected)
  const fileSummaryParts = [
    t('image.fileSummaryTotal', { count: files.length }),
    ...(selectedCount > 0 ? [t('image.fileSummarySelected', { count: selectedCount })] : []),
    ...(files.length > visibleFiles.length
      ? [t('image.fileSummaryRecent', { count: visibleFiles.length })]
      : []),
  ]

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">
            <a className="back-link" href="/">
              {t('common.brand')}
            </a>
            <span>maotaiworks.com</span>
          </p>
          <h1 className="app-title">
            <span>{t('image.heroTitle')}</span>
            <img className="pro-badge" src="/image/pro-badge.png" alt="Pro" />
          </h1>
          <p className="hero-lead" style={{ marginTop: '0.35rem' }}>
            {t('image.heroLead')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="mode-card">
            <strong>{t('image.format')}</strong>
            <span>{outputFormat}</span>
          </div>
          <LangSwitchHost />
        </div>
      </header>

      <section className="workspace">
        <div className="main-panel">
          <section className="cat-banner" aria-label={t('image.catBannerAria')}>
            <div className="cat-banner-frame">
              <img src="/image/cat-banner.png" alt={t('image.catBannerAlt')} />
              <ul className="cat-memorial" aria-hidden="true">
                <li className="cat-1">
                  <span className="cat-name">小瓷</span>
                  <span className="cat-meta">{t('image.catAge', { n: 19 })}</span>
                </li>
                <li className="cat-2">
                  <span className="cat-name">杨大宝</span>
                </li>
                <li className="cat-3">
                  <span className="cat-name">肝菲</span>
                </li>
                <li className="cat-4">
                  <span className="cat-name">杨小美</span>
                </li>
                <li className="cat-5">
                  <span className="cat-name">杨小午</span>
                </li>
              </ul>
            </div>
          </section>

          <section
            className="drop-zone"
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (busy) return
              if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
            }}
          >
            <div>
              <h2>{t('image.dropTitle')}</h2>
              <p>{t('image.dropHint')}</p>
            </div>
            <div className="drop-actions">
              <button
                className="icon-button"
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="button-icon file-icon" aria-hidden="true" />
                {t('image.selectFiles')}
              </button>
              <button
                className="icon-button"
                type="button"
                disabled={busy}
                onClick={() => folderInputRef.current?.click()}
              >
                <span className="button-icon folder-icon" aria-hidden="true" />
                {t('image.selectFolder')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_INPUT}
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              accept={ACCEPT_INPUT}
              multiple
              hidden
              {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files)
                event.target.value = ''
              }}
            />
          </section>

          {messages.length > 0 && (
            <div className="message-panel">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          {files.length === 0 ? (
            <div className="empty-list">{t('image.emptyList')}</div>
          ) : (
            <section className="file-panel">
              <div className="file-summary">{fileSummaryParts.join(' · ')}</div>
              <div className="file-table">
                <div className="file-row file-head file-row-select">
                  <span>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={busy}
                      onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                      aria-label={t('image.selectAllVisible')}
                    />
                  </span>
                  <span>{t('image.fileName')}</span>
                  <span>{t('image.fileFormat')}</span>
                  <span>{t('image.originalSize')}</span>
                  <span>{t('image.previewSize')}</span>
                  <span>{t('image.status')}</span>
                  <span>{t('image.progress')}</span>
                  <span>{t('image.noteError')}</span>
                </div>
                {visibleFiles.map((file) => (
                  <div className="file-row file-row-select" key={file.id}>
                    <span>
                      <input
                        type="checkbox"
                        checked={file.selected}
                        disabled={busy}
                        onChange={(event) =>
                          setFiles((current) =>
                            current.map((item) =>
                              item.id === file.id
                                ? { ...item, selected: event.target.checked }
                                : item,
                            ),
                          )
                        }
                        aria-label={t('image.selectFile', { name: file.name })}
                      />
                    </span>
                    <span className="file-name" title={file.relativePath}>
                      {file.name}
                    </span>
                    <span>{file.format}</span>
                    <span>{formatBytes(file.originalSize)}</span>
                    <span>
                      {file.outputSize ? (
                        formatBytes(file.outputSize)
                      ) : file.previewPending ? (
                        t('image.calculating')
                      ) : file.previewSize ? (
                        <span className="preview-value">
                          {formatBytes(file.previewSize)}
                          {file.previewWarning && (
                            <small title={file.previewWarning}>{file.previewWarning}</small>
                          )}
                        </span>
                      ) : file.previewError ? (
                        <span className="preview-error" title={file.previewError}>
                          {t('image.previewFailed')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </span>
                    <span>
                      <span className={`status-badge status-${file.status}`}>
                        {statusLabel(file.status, t)}
                      </span>
                    </span>
                    <span>
                      <div className="progress-wrap">
                        <div className="progress-track">
                          <span style={{ width: `${file.progress}%` }} />
                        </div>
                        <strong>{file.progress}%</strong>
                      </div>
                    </span>
                    <span
                      className="error-cell"
                      title={file.error || file.previewWarning || file.previewError}
                    >
                      {file.error || file.previewWarning || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="settings-panel">
          <h2>{t('image.settings')}</h2>

          <label className="field">
            {t('image.format')}
            <select
              value={outputFormat}
              disabled={busy}
              onChange={(event) => setOutputFormat(event.target.value as WebOutputFormat)}
            >
              {WEB_OUTPUT_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            {t('image.targetSize')}
            <select
              value={[5, 10, 20].includes(targetSizeMb) ? targetSizeMb : 'custom'}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value === 'custom') return
                setTargetSizeMb(Number(event.target.value))
              }}
            >
              <option value={5}>5MB</option>
              <option value={10}>10MB</option>
              <option value={20}>20MB</option>
              <option value="custom">{t('image.custom')}</option>
            </select>
            <input
              type="number"
              min={1}
              max={500}
              value={targetSizeMb}
              disabled={busy}
              onChange={(event) => setTargetSizeMb(Math.max(1, Number(event.target.value)))}
            />
          </label>

          {showQuality && (
            <label className="field">
              {t('image.quality')}
              <div className="slider-row">
                <input
                  type="range"
                  min={65}
                  max={100}
                  value={quality}
                  disabled={busy}
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
                <strong>{quality}</strong>
              </div>
            </label>
          )}

          <label className="field">
            {t('image.suffix')}
            <input
              value={filenameSuffix}
              disabled={busy}
              onChange={(event) => setFilenameSuffix(event.target.value)}
              placeholder="_converted"
            />
          </label>

          <label className="field">
            {t('image.concurrency')}
            <select
              value={concurrency}
              disabled={busy}
              onChange={(event) => setConcurrency(Number(event.target.value) as 1 | 2 | 3 | 4)}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={allowResize}
              disabled={busy}
              onChange={(event) => setAllowResize(event.target.checked)}
            />
            {t('image.allowResize')}
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={autoDownload}
              disabled={busy}
              onChange={(event) => setAutoDownload(event.target.checked)}
            />
            {t('image.autoDownload')}
          </label>

          <div className="tool-status">
            <div className="tool-status-item">
              <div>
                <span className="dot ok" />
                {t('image.localConversion')}
              </div>
              <p className="format-hint">{t('image.supportedFormatsHint')}</p>
            </div>
            <div className="tool-status-item">
              <div>
                <span className="dot ok" />
                {t('image.saveByDownload')}
              </div>
              <p className="format-hint">{t('image.saveByDownloadHint')}</p>
            </div>
          </div>
        </aside>
      </section>

      <footer className="bottom-toolbar">
        <button className="primary" type="button" disabled={!canStart || busy} onClick={() => void startConvert()}>
          <span className="button-icon play-icon" aria-hidden="true" />
          {t('image.startConvert')}
        </button>
        <button type="button" disabled={!busy} onClick={cancelConvert}>
          <span className="button-icon cancel-icon" aria-hidden="true" />
          {t('image.cancel')}
        </button>
        <button
          type="button"
          disabled={busy || failedCount === 0}
          onClick={() => void retryFailed()}
        >
          {t('image.retryFailed')}
        </button>
        <button type="button" disabled={busy} onClick={clearFiles}>
          <span className="button-icon trash-icon" aria-hidden="true" />
          {t('image.clear')}
        </button>
        <button
          type="button"
          disabled={successCount === 0 || busy}
          onClick={() => void downloadOutputs()}
        >
          <span className="button-icon folder-icon" aria-hidden="true" />
          {t('image.downloadAll')}
        </button>
      </footer>
    </main>
  )
}

function statusLabel(status: FileStatus, t: Translate): string {
  switch (status) {
    case 'queued':
      return t('image.statusQueued')
    case 'converting':
      return t('image.statusConverting')
    case 'compressing':
      return t('image.statusCompressing')
    case 'success':
      return t('image.statusSuccess')
    case 'failed':
      return t('image.statusFailed')
    case 'cancelled':
      return t('image.statusCancelled')
  }
}

function compactCompletedFiles(files: AppFile[]) {
  const compacted = files.map((file) =>
    file.status === 'success'
      ? {
          ...file,
          previewPending: false,
          previewError: undefined,
          previewWarning: undefined,
        }
      : file,
  )

  if (compacted.length <= MAX_VISIBLE_HISTORY) return compacted

  const keep = compacted.filter((file) => file.status !== 'success')
  const successTail = compacted
    .filter((file) => file.status === 'success')
    .slice(-(MAX_VISIBLE_HISTORY - keep.length))
  return [...keep, ...successTail]
}
