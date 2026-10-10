import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { trackUse } from '../analytics'
import { LangSwitchHost } from '../i18n/LangSwitchHost'
import { useT } from '../i18n/react'
import { chunkMarkdown, exportChunksAsFiles } from './engine/chunk'
import { convertFile } from './engine/convert'
import {
  acceptAttribute,
  formatBytes,
  isMedia,
  isSupported,
  MAX_FILE_BYTES,
  MAX_FILES,
} from './formats'

type TaskStatus = 'waiting' | 'converting' | 'completed' | 'failed'

interface Task {
  id: string
  file: File
  status: TaskStatus
  error?: string
  warning?: string
  markdown?: string
}

function uid() {
  return crypto.randomUUID()
}

function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function App() {
  const { t, lh } = useT()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(() => t('markdown.initialBanner'))
  const [draft, setDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    if (!tasks.length && !busy) setBanner(t('markdown.initialBanner'))
  }, [t, tasks.length, busy])

  const selected = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? tasks.find((task) => task.markdown),
    [tasks, selectedId],
  )

  const visibleMarkdown =
    selected?.id === selectedId || selected ? draft || selected?.markdown || '' : draft

  function syncDraftFrom(task: Task | undefined) {
    setDraft(task?.markdown ?? '')
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = [...fileList]
    const next: Task[] = [...tasksRef.current]
    const rejected: string[] = []
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        rejected.push(t('markdown.maxFiles'))
        break
      }
      if (!isSupported(file.name)) {
        rejected.push(t('markdown.unsupportedFormat', { name: file.name }))
        continue
      }
      if (isMedia(file.name)) {
        rejected.push(t('markdown.mediaDesktopOnly', { name: file.name }))
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(t('markdown.tooLarge', { name: file.name }))
        continue
      }
      if (next.some((task) => task.file.name === file.name && task.file.size === file.size)) continue
      next.push({ id: uid(), file, status: 'waiting' })
    }
    setTasks(next)
    setBanner(
      rejected.length
        ? rejected.join(t('markdown.rejectJoin'))
        : t('markdown.addedFiles', { count: next.length }),
    )
  }

  const addFilesRef = useRef(addFiles)
  addFilesRef.current = addFiles

  // Whole page: accept drops anywhere (prevent browser download/open) and feed the queue.
  useEffect(() => {
    const hasFiles = (e: globalThis.DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    const onDragOver = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragEnter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(true)
    }
    const onDragLeave = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return
      // Leaving the window / document
      if (e.target === document.documentElement || e.relatedTarget === null) {
        setDragOver(false)
      }
    }
    const onDrop = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      if (e.dataTransfer?.files?.length) addFilesRef.current(e.dataTransfer.files)
    }

    document.addEventListener('dragenter', onDragEnter, true)
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('dragleave', onDragLeave, true)
    document.addEventListener('drop', onDrop, true)
    return () => {
      document.removeEventListener('dragenter', onDragEnter, true)
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('dragleave', onDragLeave, true)
      document.removeEventListener('drop', onDrop, true)
    }
  }, [])

  async function convertAll() {
    if (busy || !tasks.length) return
    setBusy(true)
    trackUse('magic-markdown')
    try {
      for (const task of tasks) {
        setTasks((cur) =>
          cur.map((item) =>
            item.id === task.id ? { ...item, status: 'converting', error: undefined } : item,
          ),
        )
        const isImg = /\.(png|jpe?g|bmp|gif|tiff?|webp|heic|heif)$/i.test(task.file.name)
        setBanner(
          isImg
            ? t('markdown.ocrConverting', { name: task.file.name })
            : t('markdown.converting', { name: task.file.name }),
        )
        try {
          const result = await convertFile(task.file)
          if (!result.markdown && result.warning) {
            setTasks((cur) =>
              cur.map((item) =>
                item.id === task.id
                  ? { ...item, status: 'failed', error: result.warning, warning: result.warning }
                  : item,
              ),
            )
            continue
          }
          setTasks((cur) =>
            cur.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: 'completed',
                    markdown: result.markdown,
                    warning: result.warning,
                  }
                : item,
            ),
          )
          setSelectedId(task.id)
          setDraft(result.markdown)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          setTasks((cur) =>
            cur.map((item) =>
              item.id === task.id ? { ...item, status: 'failed', error: message } : item,
            ),
          )
        }
      }
      setBanner(t('markdown.convertDone'))
    } finally {
      setBusy(false)
    }
  }

  function copyMarkdown() {
    const text = draft || selected?.markdown
    if (!text) return
    void navigator.clipboard.writeText(text)
    setBanner(t('markdown.copied'))
  }

  function exportMarkdown() {
    const text = draft || selected?.markdown
    if (!text || !selected) return
    const name = selected.file.name.replace(/\.[^.]+$/, '') + '.md'
    downloadText(name, text)
    setBanner(t('markdown.exported', { name }))
  }

  async function exportChunks() {
    const text = draft || selected?.markdown
    if (!text || !selected) return
    try {
      const chunks = chunkMarkdown(text, selected.file.name)
      const { files, indexJson } = exportChunksAsFiles(chunks)
      const zip = new JSZip()
      for (const file of files) zip.file(file.name, file.content)
      zip.file('index.json', indexJson)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selected.file.name.replace(/\.[^.]+$/, '') + '-chunks.zip'
      a.click()
      URL.revokeObjectURL(url)
      setBanner(t('markdown.chunksDone', { count: chunks.length }))
    } catch (err) {
      setBanner(err instanceof Error ? err.message : t('markdown.chunkFailed'))
    }
  }

  async function exportAllMarkdown() {
    const done = tasks.filter((task) => task.markdown)
    if (!done.length) return
    if (done.length === 1) {
      downloadText(done[0].file.name.replace(/\.[^.]+$/, '') + '.md', done[0].markdown!)
      return
    }
    const zip = new JSZip()
    for (const task of done) {
      zip.file(
        task.file.name.replace(/\.[^.]+$/, '') + '.md',
        task.id === selected?.id ? draft : task.markdown!,
      )
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'markdown-batch.zip'
    a.click()
    URL.revokeObjectURL(url)
    setBanner(t('markdown.batchExported', { count: done.length }))
  }

  return (
    <div className={`page${dragOver ? ' is-page-dragover' : ''}`}>
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden>
            M↓
          </div>
          <div>
            <h1>
              {t('markdown.heroTitle')} <span className="beta">{t('markdown.beta')}</span>
            </h1>
            <p>{t('markdown.heroLead')}</p>
          </div>
        </div>
        <div className="top-actions">
          <LangSwitchHost />
          <a className="ghost" href={lh('/')}>
            {t('common.backHome')}
          </a>
        </div>
      </header>

      <main className="shell">
        <aside className="side">
          <div
            ref={dropRef}
            className={`drop${dragOver ? ' is-dragover' : ''}`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
            }}
          >
            <strong>{t('markdown.dropTitle')}</strong>
            <span>{t('markdown.formatBlurb')}</span>
            <span className="hint">{t('markdown.dropHint')}</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptAttribute()}
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          <div className="list-head">
            <strong>{t('markdown.queueTitle')}</strong>
            <span>
              {tasks.length}/{MAX_FILES}
            </span>
          </div>
          <ul className="file-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={selected?.id === task.id ? 'file active' : 'file'}
                  onClick={() => {
                    setSelectedId(task.id)
                    syncDraftFrom(task)
                  }}
                >
                  <span className={`dot ${task.status}`} />
                  <span className="meta">
                    <span className="name">{task.file.name}</span>
                    <span className="sub">
                      {formatBytes(task.file.size)}
                      {task.error ? ` · ${task.error}` : task.warning ? ` · ${task.warning}` : ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="x"
                  aria-label={t('markdown.removeAria')}
                  onClick={() => {
                    setTasks((cur) => cur.filter((item) => item.id !== task.id))
                    if (selectedId === task.id) {
                      setSelectedId(null)
                      setDraft('')
                    }
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="actions">
            <button
              type="button"
              disabled={!tasks.length || busy}
              onClick={() => {
                setTasks([])
                setDraft('')
                setSelectedId(null)
                setBanner(t('markdown.cleared'))
              }}
            >
              {t('markdown.clear')}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!tasks.length || busy}
              onClick={() => void convertAll()}
            >
              {busy ? t('markdown.processing') : t('markdown.start')}
            </button>
          </div>
        </aside>

        <section className="editor">
          <div className="toolbar">
            <button type="button" disabled={!selected?.markdown} onClick={copyMarkdown}>
              {t('markdown.copy')}
            </button>
            <button type="button" disabled={!selected?.markdown} onClick={() => void exportChunks()}>
              {t('markdown.smartChunk')}
            </button>
            <button type="button" disabled={!selected?.markdown} onClick={exportMarkdown}>
              {t('markdown.exportMd')}
            </button>
            <button
              type="button"
              disabled={!tasks.some((task) => task.markdown)}
              onClick={() => void exportAllMarkdown()}
            >
              {t('markdown.exportBatch')}
            </button>
          </div>
          <textarea
            value={visibleMarkdown}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('markdown.editorPlaceholder')}
            spellCheck={false}
          />
        </section>
      </main>

      <footer className="status">
        <span>{banner}</span>
        <span className="privacy">{t('markdown.privacyNote')}</span>
      </footer>
    </div>
  )
}
