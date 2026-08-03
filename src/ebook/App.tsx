import { useMemo, useRef, useState } from 'react'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import {
  FORMAT_LABEL,
  acceptFor,
  detectFormat,
  type EbookFormat,
} from './formats'
import { convertEbook, downloadBlob, formatBytes } from './engine/convert'
import { convertEbookRemote, needsRemoteConvert, shouldUseRemote } from './engine/remoteConvert'

type TaskStatus = 'ready' | 'running' | 'completed' | 'failed'

interface Task {
  id: string
  file: File
  from: EbookFormat
  to: EbookFormat
  status: TaskStatus
  error?: string
  warning?: string
  outputBlob?: Blob
  outputName?: string
  outputSize?: number
}

const OUTPUT_OPTIONS: EbookFormat[] = ['epub', 'pdf', 'txt', 'azw3', 'mobi']
const INPUT_OPTIONS: EbookFormat[] = ['epub', 'pdf', 'txt', 'docx', 'mobi', 'azw3', 'html']

const QUICK_PRESETS: Array<{ id: string; from: EbookFormat; to: EbookFormat; label: string }> = [
  { id: 'epub-pdf', from: 'epub', to: 'pdf', label: 'EPUB → PDF' },
  { id: 'pdf-epub', from: 'pdf', to: 'epub', label: 'PDF → EPUB' },
  { id: 'mobi-epub', from: 'mobi', to: 'epub', label: 'MOBI → EPUB' },
  { id: 'mobi-pdf', from: 'mobi', to: 'pdf', label: 'MOBI → PDF' },
  { id: 'epub-mobi', from: 'epub', to: 'mobi', label: 'EPUB → MOBI' },
  { id: 'pdf-mobi', from: 'pdf', to: 'mobi', label: 'PDF → MOBI' },
  { id: 'epub-azw3', from: 'epub', to: 'azw3', label: 'EPUB → AZW3' },
  { id: 'azw3-epub', from: 'azw3', to: 'epub', label: 'AZW3 → EPUB' },
  { id: 'txt-epub', from: 'txt', to: 'epub', label: 'TXT → EPUB' },
  { id: 'epub-txt', from: 'epub', to: 'txt', label: 'EPUB → TXT' },
  { id: 'pdf-txt', from: 'pdf', to: 'txt', label: 'PDF → TXT' },
  { id: 'docx-epub', from: 'docx', to: 'epub', label: 'DOCX → EPUB' },
]

function uid() {
  return crypto.randomUUID()
}

export function App() {
  const { t } = useT()
  const [from, setFrom] = useState<EbookFormat | 'auto'>('auto')
  const [to, setTo] = useState<EbookFormat>('epub')
  const [presetId, setPresetId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [banner, setBanner] = useState(() => t('ebook.heroLead'))
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = useMemo(
    () => (from === 'auto' ? acceptFor(null) : acceptFor(from)),
    [from],
  )

  const applyPreset = (id: string) => {
    const preset = QUICK_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setFrom(preset.from)
    setTo(preset.to)
    const remote = needsRemoteConvert(preset.from, preset.to)
    setBanner(
      remote
        ? t('ebook.bannerPresetRemote', { label: preset.label })
        : t('ebook.bannerPreset', { label: preset.label }),
    )
  }

  const swap = () => {
    if (from === 'auto') return
    if (!OUTPUT_OPTIONS.includes(from as EbookFormat)) {
      setBanner(t('ebook.bannerSwapUnsupported'))
      return
    }
    const nextFrom = to
    const nextTo = from as EbookFormat
    setFrom(nextFrom)
    setTo(OUTPUT_OPTIONS.includes(nextTo) ? nextTo : 'epub')
    setPresetId(null)
  }

  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list)
    if (!files.length) return

    const created: Task[] = []
    for (const file of files) {
      const detected = detectFormat(file.name)
      if (!detected) {
        setBanner(t('ebook.bannerUnknownFormat', { file: file.name }))
        continue
      }
      const inputFormat = from === 'auto' ? detected : from
      if (from !== 'auto' && detected !== from) {
        setBanner(
          t('ebook.bannerSelectFormatFile', {
            format: FORMAT_LABEL[from],
            file: file.name,
          }),
        )
        continue
      }
      if (inputFormat === to) {
        setBanner(t('ebook.bannerSameFormat'))
        continue
      }
      created.push({
        id: uid(),
        file,
        from: inputFormat,
        to,
        status: 'ready',
      })
    }

    if (!created.length) return
    setTasks((prev) => [...created, ...prev])
    const remoteFlags = await Promise.all(
      created.map((t) => shouldUseRemote(t.file, t.from, t.to)),
    )
    const anyRemote = remoteFlags.some(Boolean)
    const anyOcr = created.some(
      (t, i) => remoteFlags[i] && t.from === 'pdf' && !needsRemoteConvert(t.from, t.to),
    )
    setBanner(
      anyOcr
        ? t('ebook.bannerAddedOcr', { count: created.length })
        : anyRemote
          ? t('ebook.bannerAddedRemote', { count: created.length })
          : t('ebook.bannerAddedLocal', { count: created.length }),
    )
    for (const task of created) {
      await runTask(task)
    }
  }

  const runTask = async (task: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'running', error: undefined } : t)),
    )
    try {
      const remote = await shouldUseRemote(task.file, task.from, task.to)
      const result = remote
        ? await convertEbookRemote(task.file, task.from, task.to)
        : await convertEbook(task.file, task.from, task.to)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'completed',
                outputBlob: result.blob,
                outputName: result.fileName,
                outputSize: result.blob.size,
                warning: result.warnings[0],
              }
            : t,
        ),
      )
      setBanner(t('ebook.bannerCompleted'))
    } catch (e) {
      const message = e instanceof Error ? e.message : t('ebook.bannerFailed')
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'failed',
                error: message,
              }
            : t,
        ),
      )
      setBanner(message)
    }
  }

  const statusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return t('ebook.statusRunning')
      case 'completed':
        return t('ebook.statusDone')
      case 'failed':
        return t('ebook.statusFailed')
      case 'ready':
      default:
        return t('ebook.statusIdle')
    }
  }

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="shell">
        <header className="topbar">
          <div className="brand-block">
            <a className="brand" href="/">
              {t('common.brand')}
            </a>
            <p className="brand-domain">maotaiworks.com</p>
          </div>
          <div className="site-header__right">
            <a className="back" href="/">
              {t('common.backHome')}
            </a>
            <LangSwitchHost />
          </div>
        </header>

        <section className="hero">
          <h1 className="product">{t('ebook.heroTitle')}</h1>
          <p className="hero-line">{t('ebook.heroLead')}</p>

          <div
            className={`drop ${dragOver ? 'dragover' : ''}`}
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
            <div>
              <strong>{t('ebook.dropTitle')}</strong>
              <span>{t('ebook.dropHint')}</span>
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
          </div>
        </section>

        <section className="controls" aria-label={t('ebook.directionAria')}>
          <div className="field">
            <label htmlFor="from">{t('ebook.fromLabel')}</label>
            <select
              id="from"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value as EbookFormat | 'auto')
                setPresetId(null)
              }}
            >
              <option value="auto">{t('ebook.autoDetect')}</option>
              {INPUT_OPTIONS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {FORMAT_LABEL[fmt]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="swap"
            onClick={swap}
            title={t('ebook.swapTitle')}
            aria-label={t('ebook.swapAria')}
          >
            ↔
          </button>

          <div className="field">
            <label htmlFor="to">{t('ebook.toLabel')}</label>
            <select
              id="to"
              value={to}
              onChange={(e) => {
                setTo(e.target.value as EbookFormat)
                setPresetId(null)
              }}
            >
              {OUTPUT_OPTIONS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {FORMAT_LABEL[fmt]}
                </option>
              ))}
            </select>
          </div>
        </section>

        <p className="section-label">{t('ebook.quickDirections')}</p>
        <div className="quick-row">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`quick ${presetId === preset.id ? 'active' : ''}`}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <p className="section-label">{t('ebook.results')}</p>
        {tasks.length === 0 ? (
          <p className="empty">{t('ebook.emptyState')}</p>
        ) : (
          <div className="tasks">
            {tasks.map((task) => {
              const done = task.status === 'completed' && task.outputName
              return (
                <article key={task.id} className="task">
                  <div>
                    <p className="task-name">{done ? task.outputName : task.file.name}</p>
                    <p className="task-meta">
                      {done
                        ? `${formatBytes(task.outputSize ?? 0)} · ${t('ebook.outputMetaLabel')} · ${FORMAT_LABEL[task.from]} → ${FORMAT_LABEL[task.to]}`
                        : `${formatBytes(task.file.size)} · ${FORMAT_LABEL[task.from]} → ${FORMAT_LABEL[task.to]}`}
                      {task.warning ? ` · ${task.warning}` : ''}
                      {task.error ? ` · ${task.error}` : ''}
                    </p>
                  </div>
                  <div className="task-actions">
                    <span
                      className={`status ${
                        task.status === 'completed'
                          ? 'ok'
                          : task.status === 'failed'
                            ? 'bad'
                            : task.status === 'running'
                              ? 'run'
                              : ''
                      }`}
                    >
                      {statusLabel(task.status)}
                    </span>
                    {done ? (
                      <button
                        type="button"
                        className="btn solid"
                        onClick={() => {
                          if (task.outputBlob && task.outputName) {
                            downloadBlob(task.outputBlob, task.outputName)
                          }
                        }}
                      >
                        {t('ebook.download')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                    >
                      {t('ebook.remove')}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="hint">{banner}</p>

        <p className="privacy">
          <span className="local-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
              <path d="M5 14.2h6M8 11.5v2.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
              <circle cx="8" cy="7" r="1.35" fill="currentColor" />
            </svg>
          </span>
          {t('ebook.privacyNote')}
        </p>

        <footer className="foot">
          <span>
            {t('ebook.heroTitle')} · {t('common.brand')}
          </span>
          <a href="/moyee/">{t('ebook.moyeeLink')}</a>
          <a href="/legal/#privacy">{t('common.privacy')}</a>
          <a href="/legal/#terms">{t('common.terms')}</a>
        </footer>
      </div>
    </>
  )
}
