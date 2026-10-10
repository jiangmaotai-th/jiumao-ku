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
  downloadPacks,
  makeZipPack,
  pickOutputDirectory,
  writeBlobToDirectory,
  type OutputArtifact,
  type ZipPack,
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

const MAX_RENDERED_ROWS = 200
const MAX_VISIBLE_HISTORY = 200
const MAX_PREVIEW_BATCH = 12
const DOWNLOAD_CHUNK = 80

/** Common digital ID-photo sizes @ ~300dpi */
const ID_PHOTO_PRESETS = {
  inch1: { width: 295, height: 413 },
  inch2: { width: 413, height: 579 },
} as const

type ConvertMode = 'normal' | 'idPhoto'
type IdPhotoPreset = 'inch1' | 'inch2' | 'custom'

type Translate = (path: string, vars?: Record<string, string | number>) => string

export function App() {
  const { t, lh } = useT()
  const [files, setFiles] = useState<AppFile[]>([])
  const [mode, setMode] = useState<ConvertMode>('normal')
  const [outputFormat, setOutputFormat] = useState<WebOutputFormat>('JPEG')
  const [targetSizeMb, setTargetSizeMb] = useState(10)
  const [targetSizeKb, setTargetSizeKb] = useState(10)
  const [idPhotoPreset, setIdPhotoPreset] = useState<IdPhotoPreset>('inch1')
  const [customWidth, setCustomWidth] = useState(295)
  const [customHeight, setCustomHeight] = useState(413)
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
  const packsRef = useRef<ZipPack[]>([])
  const [packCount, setPackCount] = useState(0)

  const idPhotoDims = useMemo(() => {
    if (idPhotoPreset === 'inch1') return ID_PHOTO_PRESETS.inch1
    if (idPhotoPreset === 'inch2') return ID_PHOTO_PRESETS.inch2
    return {
      width: Math.max(32, Math.round(customWidth) || 295),
      height: Math.max(32, Math.round(customHeight) || 413),
    }
  }, [idPhotoPreset, customWidth, customHeight])

  const buildOptions = () => {
    if (mode === 'idPhoto') {
      return {
        format: 'JPEG' as WebOutputFormat,
        // Start at max clarity; engine binary-searches down only if over the KB budget.
        quality: 100,
        minQuality: 8,
        targetBytes: Math.max(1024, Math.round(targetSizeKb * 1024)),
        allowResize: true,
        suffix: filenameSuffix,
        outputWidth: idPhotoDims.width,
        outputHeight: idPhotoDims.height,
        fit: 'cover' as const,
        qualityStep: 2,
      }
    }
    return {
      format: outputFormat,
      quality,
      minQuality: 65,
      targetBytes: Math.max(1, Math.round(targetSizeMb * 1024 * 1024)),
      allowResize,
      suffix: filenameSuffix,
    }
  }

  const queuedIds = useMemo(
    () =>
      files
        .filter((file) => file.status === 'queued' || file.status === 'failed')
        .map((file) => file.id),
    [files],
  )

  const previewKey = useMemo(
    () =>
      [
        queuedIds.length > MAX_PREVIEW_BATCH ? `skip:${queuedIds.length}` : queuedIds.join('|'),
        mode,
        outputFormat,
        quality,
        targetSizeMb,
        targetSizeKb,
        allowResize,
        idPhotoPreset,
        idPhotoDims.width,
        idPhotoDims.height,
        filenameSuffix,
      ].join('::'),
    [
      queuedIds,
      mode,
      outputFormat,
      quality,
      targetSizeMb,
      targetSizeKb,
      allowResize,
      idPhotoPreset,
      idPhotoDims.width,
      idPhotoDims.height,
      filenameSuffix,
    ],
  )

  useEffect(() => {
    if (busy) return

    const queued = files.filter((file) => file.status === 'queued' || file.status === 'failed')
    if (queued.length === 0) return

    if (queued.length > MAX_PREVIEW_BATCH) {
      previewRunRef.current += 1
      setFiles((current) =>
        current.map((file) =>
          (file.status === 'queued' || file.status === 'failed') && file.previewPending
            ? { ...file, previewPending: false }
            : file,
        ),
      )
      return
    }

    const previewableFiles = queued.slice(-MAX_PREVIEW_BATCH)
    const previewIds = new Set(previewableFiles.map((file) => file.id))
    const runId = previewRunRef.current + 1
    previewRunRef.current = runId
    const options = buildOptions()

    setFiles((current) =>
      current.map((file) =>
        previewIds.has(file.id)
          ? { ...file, previewPending: true, previewError: undefined }
          : file,
      ),
    )

    const timer = window.setTimeout(() => {
      void (async () => {
        for (const item of previewableFiles) {
          if (previewRunRef.current !== runId) return
          try {
            const estimate = await previewImageSize(item.file, options)
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
  }, [previewKey, busy])

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
    () => files.filter((file) => file.status === 'success').length,
    [files],
  )
  const canStart = queuedCount > 0
  const showQuality = mode === 'normal' && isLossyOutputFormat(outputFormat)
  const displayFormat = mode === 'idPhoto' ? 'JPEG' : outputFormat

  useEffect(() => {
    if (mode === 'idPhoto' && filenameSuffix === '_converted') {
      setFilenameSuffix('_idphoto')
    }
    if (mode === 'normal' && filenameSuffix === '_idphoto') {
      setFilenameSuffix('_converted')
    }
  }, [mode])

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

    const nextCount = files.length + accepted.length
    setMessages([
      ...(accepted.length > 0
        ? [
            nextCount > MAX_RENDERED_ROWS
              ? t('image.addedFilesLargeMessage', {
                  count: accepted.length,
                  shown: MAX_RENDERED_ROWS,
                })
              : t('image.addedFilesMessage', { count: accepted.length }),
            ...(nextCount > MAX_PREVIEW_BATCH ? [t('image.largeBatchNoPreview')] : []),
          ]
        : []),
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

  const runJobs = async (
    jobs: AppFile[],
    outputDir: Awaited<ReturnType<typeof pickOutputDirectory>> = null,
  ) => {
    if (!jobs.length || busy) return
    cancelRef.current = false
    setBusy(true)
    previewRunRef.current += 1
    setMessages([t('image.batchProgress', { done: 0, total: jobs.length, success: 0, failed: 0 })])

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
              previewPending: false,
            }
          : file,
      ),
    )

    const options = buildOptions()
    const keepBlobs = jobs.length <= DOWNLOAD_CHUNK
    let success = 0
    let failed = 0
    let done = 0
    let part = 0
    const pendingArtifacts: OutputArtifact[] = []
    const packs: ZipPack[] = []
    packsRef.current = []
    setPackCount(0)
    const patches = new Map<string, Partial<AppFile>>()
    let patchTimer = 0
    let sealChain = Promise.resolve()

    const flushPatches = () => {
      patchTimer = 0
      if (patches.size === 0) return
      const batch = new Map(patches)
      patches.clear()
      setFiles((current) =>
        current.map((file) => {
          const patch = batch.get(file.id)
          return patch ? { ...file, ...patch } : file
        }),
      )
    }

    const patchFile = (id: string, patch: Partial<AppFile>) => {
      patches.set(id, { ...patches.get(id), ...patch })
      if (!patchTimer) patchTimer = window.setTimeout(flushPatches, 120)
    }

    const reportProgress = () => {
      setMessages([t('image.batchProgress', { done, total: jobs.length, success, failed })])
    }

    const expectedPacks = Math.max(1, Math.ceil(jobs.length / DOWNLOAD_CHUNK))

    const sealPending = async () => {
      if (pendingArtifacts.length === 0) return
      const batch = pendingArtifacts.splice(0, pendingArtifacts.length)
      part += 1
      if (outputDir) {
        for (const item of batch) {
          await writeBlobToDirectory(outputDir, item.relativePath, item.blob)
        }
        setMessages([
          t('image.batchProgress', { done, total: jobs.length, success, failed }),
          t('image.savedToFolder', { success }),
        ])
        return
      }
      const pack = await makeZipPack(
        batch,
        jobs.length > DOWNLOAD_CHUNK
          ? `xiaowu-converted-${part}.zip`
          : `xiaowu-converted-${Date.now()}.zip`,
      )
      packs.push(pack)
      packsRef.current = packs.slice()
      setPackCount(packs.length)
      setMessages([
        t('image.batchProgress', { done, total: jobs.length, success, failed }),
        t('image.packSealed', { part, packs: expectedPacks, count: batch.length }),
      ])
    }

    const requestSeal = () => {
      sealChain = sealChain.then(async () => {
        if (pendingArtifacts.length >= DOWNLOAD_CHUNK) await sealPending()
      })
      return sealChain
    }

    await runPool(
      jobs,
      concurrency,
      async (job) => {
        if (cancelRef.current) {
          patchFile(job.id, { status: 'cancelled' })
          return
        }

        patchFile(job.id, { status: 'converting', progress: 20, error: undefined })

        try {
          const result = await convertImageFile(job.file, {
            ...options,
            onPhase: (phase, progress) => {
              patchFile(job.id, { status: phase, progress })
            },
          })

          if (cancelRef.current) {
            patchFile(job.id, { status: 'cancelled' })
            return
          }

          if (!result.blob || result.size === 0 || result.width === 0 || result.height === 0) {
            throw new Error(t('image.outputValidationFailed'))
          }

          const relativePath = buildOutputRelativePath(job.file, result.filename, options.format)
          success += 1
          done += 1
          pendingArtifacts.push({
            blob: result.blob,
            filename: result.filename,
            relativePath,
          })

          patchFile(job.id, {
            status: 'success',
            progress: 100,
            outputBlob: keepBlobs ? result.blob : undefined,
            outputName: result.filename,
            outputRelativePath: relativePath,
            outputSize: result.size,
            previewSize: result.size,
            previewPending: false,
            previewError: undefined,
            previewWarning: undefined,
            error: result.warning,
          })

          reportProgress()
          await requestSeal()
        } catch (error) {
          failed += 1
          done += 1
          patchFile(job.id, {
            status: 'failed',
            progress: 0,
            error: String(error instanceof Error ? error.message : error),
          })
          reportProgress()
        }
      },
      () => cancelRef.current,
    )

    if (patchTimer) window.clearTimeout(patchTimer)
    flushPatches()
    await sealChain
    if (!cancelRef.current) await sealPending()
    packsRef.current = packs.slice()
    setPackCount(packs.length)

    setFiles((current) => compactCompletedFiles(current))
    setBusy(false)

    if (cancelRef.current) {
      setMessages([t('image.cancelRequested')])
      return
    }

    if (outputDir) {
      setMessages([t('image.conversionComplete', { success, failed }), t('image.savedToFolder', { success })])
      return
    }

    if (autoDownload && packs.length === 1) {
      try {
        await downloadPacks(packs)
        setMessages([t('image.conversionComplete', { success, failed })])
      } catch (error) {
        setMessages([
          t('image.conversionComplete', { success, failed }),
          t('image.autoDownloadFailed', {
            error: String(error instanceof Error ? error.message : error),
          }),
        ])
      }
      return
    }

    if (packs.length > 1) {
      setMessages([
        t('image.conversionComplete', { success, failed }),
        t('image.packsReadyToDownload', { packs: packs.length }),
      ])
      return
    }

    setMessages([t('image.conversionComplete', { success, failed })])
  }

  const startConvert = async () => {
    const jobs = files.filter((file) => file.status === 'queued' || file.status === 'failed')
    let outputDir: Awaited<ReturnType<typeof pickOutputDirectory>> = null
    if (jobs.length > DOWNLOAD_CHUNK) {
      setMessages([t('image.largeBatchPickFolder', { n: DOWNLOAD_CHUNK })])
      outputDir = await pickOutputDirectory()
    }
    await runJobs(jobs, outputDir)
  }

  const retryFailed = async () => {
    const jobs = files.filter((file) => {
      if (file.status !== 'failed') return false
      if (selectedCount === 0) return true
      return file.selected
    })
    await runJobs(jobs, null)
  }

  const cancelConvert = () => {
    cancelRef.current = true
    setMessages([t('image.cancelRequested')])
  }

  const clearFiles = () => {
    if (busy) return
    setFiles([])
    packsRef.current = []
    setPackCount(0)
    setMessages([])
  }

  const downloadOutputs = async () => {
    const packs = packsRef.current
    if (packs.length > 0) {
      setBusy(true)
      try {
        setMessages([t('image.downloadingPack', { current: 1, total: packs.length })])
        const result = await downloadPacks(packs, { preferSavePicker: packs.length > 1 })
        if (result === 'cancelled') {
          setMessages([t('image.downloadSaveCancelled')])
        } else {
          setMessages([t('image.packsDownloaded', { packs: packs.length })])
        }
      } catch (error) {
        setMessages([
          t('image.downloadFailed', {
            error: String(error instanceof Error ? error.message : error),
          }),
        ])
      } finally {
        setBusy(false)
      }
      return
    }
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
            <a className="back-link" href={lh('/')}>
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
            <span>{displayFormat}</span>
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

          <div className="field">
            <span>{t('image.mode')}</span>
            <div className="segment" role="tablist" aria-label={t('image.mode')}>
              <button
                type="button"
                role="tab"
                className={mode === 'normal' ? 'is-active' : ''}
                aria-selected={mode === 'normal'}
                disabled={busy}
                onClick={() => setMode('normal')}
              >
                {t('image.modeNormal')}
              </button>
              <button
                type="button"
                role="tab"
                className={mode === 'idPhoto' ? 'is-active' : ''}
                aria-selected={mode === 'idPhoto'}
                disabled={busy}
                onClick={() => setMode('idPhoto')}
              >
                {t('image.modeIdPhoto')}
              </button>
            </div>
          </div>

          {mode === 'idPhoto' ? (
            <>
              <p className="format-hint">{t('image.idPhotoHint')}</p>

              <div className="field">
                <span>{t('image.idPhotoSize')}</span>
                <div className="segment segment-3" role="tablist" aria-label={t('image.idPhotoSize')}>
                  <button
                    type="button"
                    role="tab"
                    className={idPhotoPreset === 'inch1' ? 'is-active' : ''}
                    aria-selected={idPhotoPreset === 'inch1'}
                    disabled={busy}
                    onClick={() => setIdPhotoPreset('inch1')}
                  >
                    {t('image.idPhotoInch1Short')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={idPhotoPreset === 'inch2' ? 'is-active' : ''}
                    aria-selected={idPhotoPreset === 'inch2'}
                    disabled={busy}
                    onClick={() => setIdPhotoPreset('inch2')}
                  >
                    {t('image.idPhotoInch2Short')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={idPhotoPreset === 'custom' ? 'is-active' : ''}
                    aria-selected={idPhotoPreset === 'custom'}
                    disabled={busy}
                    onClick={() => setIdPhotoPreset('custom')}
                  >
                    {t('image.custom')}
                  </button>
                </div>
              </div>

              {idPhotoPreset === 'custom' && (
                <div className="dim-row">
                  <label className="field">
                    {t('image.idPhotoWidth')}
                    <input
                      type="number"
                      min={32}
                      max={2000}
                      value={customWidth}
                      disabled={busy}
                      onChange={(event) => setCustomWidth(Math.max(32, Number(event.target.value) || 32))}
                    />
                  </label>
                  <label className="field">
                    {t('image.idPhotoHeight')}
                    <input
                      type="number"
                      min={32}
                      max={2000}
                      value={customHeight}
                      disabled={busy}
                      onChange={(event) => setCustomHeight(Math.max(32, Number(event.target.value) || 32))}
                    />
                  </label>
                </div>
              )}

              <p className="format-hint">
                {idPhotoDims.width} × {idPhotoDims.height} px · JPEG
              </p>

              <label className="field">
                {t('image.targetSizeKb')}
                <select
                  value={[10, 20, 50, 100].includes(targetSizeKb) ? targetSizeKb : 'custom'}
                  disabled={busy}
                  onChange={(event) => {
                    if (event.target.value === 'custom') return
                    setTargetSizeKb(Number(event.target.value))
                  }}
                >
                  <option value={10}>10 KB</option>
                  <option value={20}>20 KB</option>
                  <option value={50}>50 KB</option>
                  <option value={100}>100 KB</option>
                  <option value="custom">{t('image.custom')}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={targetSizeKb}
                  disabled={busy}
                  onChange={(event) => setTargetSizeKb(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </>
          ) : (
            <>
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

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={allowResize}
                  disabled={busy}
                  onChange={(event) => setAllowResize(event.target.checked)}
                />
                {t('image.allowResize')}
              </label>
            </>
          )}

          <label className="field">
            {t('image.suffix')}
            <input
              value={filenameSuffix}
              disabled={busy}
              onChange={(event) => setFilenameSuffix(event.target.value)}
              placeholder={mode === 'idPhoto' ? '_idphoto' : '_converted'}
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
          disabled={(successCount === 0 && packCount === 0) || busy}
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
