import { useMemo, useRef, useState, type DragEvent } from 'react'
import JSZip from 'jszip'
import { trackUse } from '../analytics'
import { chunkMarkdown, exportChunksAsFiles } from './engine/chunk'
import { convertFile } from './engine/convert'
import {
  acceptAttribute,
  FORMAT_SUPPORT_BLURB,
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(
    '拖入最多 20 个文件（单文件 ≤ 200 MB）。转换在浏览器本地完成，原文件不上传。',
  )
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? tasks.find((t) => t.markdown),
    [tasks, selectedId],
  )

  const visibleMarkdown = selected?.id === selectedId || selected ? draft || selected?.markdown || '' : draft

  function syncDraftFrom(task: Task | undefined) {
    setDraft(task?.markdown ?? '')
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = [...fileList]
    const next: Task[] = [...tasks]
    const rejected: string[] = []
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        rejected.push('最多 20 个文件')
        break
      }
      if (!isSupported(file.name)) {
        rejected.push(`${file.name}：暂不支持此格式`)
        continue
      }
      if (isMedia(file.name)) {
        rejected.push(`${file.name}：音视频转写仅桌面版支持`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name}：超过 200 MB`)
        continue
      }
      if (next.some((t) => t.file.name === file.name && t.file.size === file.size)) continue
      next.push({ id: uid(), file, status: 'waiting' })
    }
    setTasks(next)
    setBanner(rejected.length ? rejected.join('；') : `已加入 ${next.length} 个文件`)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  async function convertAll() {
    if (busy || !tasks.length) return
    setBusy(true)
    trackUse('magic-markdown')
    try {
      for (const task of tasks) {
        setTasks((cur) =>
          cur.map((t) => (t.id === task.id ? { ...t, status: 'converting', error: undefined } : t)),
        )
        const isImg = /\.(png|jpe?g|bmp|gif|tiff?|webp|heic|heif)$/i.test(task.file.name)
        setBanner(isImg ? `正在识别图片文字：${task.file.name}（首次需加载 OCR 模型）` : `正在转换：${task.file.name}`)
        try {
          const result = await convertFile(task.file)
          if (!result.markdown && result.warning) {
            setTasks((cur) =>
              cur.map((t) =>
                t.id === task.id
                  ? { ...t, status: 'failed', error: result.warning, warning: result.warning }
                  : t,
              ),
            )
            continue
          }
          setTasks((cur) =>
            cur.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'completed',
                    markdown: result.markdown,
                    warning: result.warning,
                  }
                : t,
            ),
          )
          setSelectedId(task.id)
          setDraft(result.markdown)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          setTasks((cur) =>
            cur.map((t) => (t.id === task.id ? { ...t, status: 'failed', error: message } : t)),
          )
        }
      }
      const failures = tasks.filter(() => true)
      setBanner('转换完成（浏览器本地，未上传原文件）')
      void failures
    } finally {
      setBusy(false)
    }
  }

  function copyMarkdown() {
    const text = draft || selected?.markdown
    if (!text) return
    void navigator.clipboard.writeText(text)
    setBanner('Markdown 已复制')
  }

  function exportMarkdown() {
    const text = draft || selected?.markdown
    if (!text || !selected) return
    const name = selected.file.name.replace(/\.[^.]+$/, '') + '.md'
    downloadText(name, text)
    setBanner(`已导出 ${name}`)
  }

  async function exportChunks() {
    const text = draft || selected?.markdown
    if (!text || !selected) return
    try {
      const chunks = chunkMarkdown(text, selected.file.name)
      const { files, indexJson } = exportChunksAsFiles(chunks)
      const zip = new JSZip()
      for (const f of files) zip.file(f.name, f.content)
      zip.file('index.json', indexJson)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selected.file.name.replace(/\.[^.]+$/, '') + '-chunks.zip'
      a.click()
      URL.revokeObjectURL(url)
      setBanner(`智能切片完成 · ${chunks.length} 片`)
    } catch (err) {
      setBanner(err instanceof Error ? err.message : '切片失败')
    }
  }

  async function exportAllMarkdown() {
    const done = tasks.filter((t) => t.markdown)
    if (!done.length) return
    if (done.length === 1) {
      downloadText(done[0].file.name.replace(/\.[^.]+$/, '') + '.md', done[0].markdown!)
      return
    }
    const zip = new JSZip()
    for (const t of done) {
      zip.file(t.file.name.replace(/\.[^.]+$/, '') + '.md', t.id === selected?.id ? draft : t.markdown!)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'markdown-batch.zip'
    a.click()
    URL.revokeObjectURL(url)
    setBanner(`已批量导出 ${done.length} 个 Markdown`)
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden>
            M↓
          </div>
          <div>
                <h1>
                  一键转 Markdown <span className="beta">测试版</span>
                </h1>
                <p>PDF / Word / Pages / Numbers / Keynote / 图片OCR · 智能切片 · 音视频需桌面版</p>
          </div>
        </div>
        <a className="ghost" href="/">
          返回九猫库
        </a>
      </header>

      <main className="shell">
        <aside className="side">
          <div
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
            }}
          >
            <strong>拖入文件开始</strong>
            <span>{FORMAT_SUPPORT_BLURB}</span>
            <span className="hint">原文件不上传 · 单文件 ≤ 200 MB · 最多 20 个</span>
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
            <strong>待处理文件</strong>
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
                  aria-label="移除"
                  onClick={() => {
                    setTasks((cur) => cur.filter((t) => t.id !== task.id))
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
            <button type="button" disabled={!tasks.length || busy} onClick={() => { setTasks([]); setDraft(''); setSelectedId(null); setBanner('已清空') }}>
              清空
            </button>
            <button type="button" className="primary" disabled={!tasks.length || busy} onClick={() => void convertAll()}>
              {busy ? '处理中…' : '开始转换'}
            </button>
          </div>
        </aside>

        <section className="editor">
          <div className="toolbar">
            <button type="button" disabled={!selected?.markdown} onClick={copyMarkdown}>
              复制
            </button>
            <button type="button" disabled={!selected?.markdown} onClick={() => void exportChunks()}>
              智能切片
            </button>
            <button type="button" disabled={!selected?.markdown} onClick={exportMarkdown}>
              导出 .md
            </button>
            <button type="button" disabled={!tasks.some((t) => t.markdown)} onClick={() => void exportAllMarkdown()}>
              批量导出
            </button>
          </div>
          <textarea
            value={visibleMarkdown}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="转换结果会显示在这里。"
            spellCheck={false}
          />
        </section>
      </main>

      <footer className="status">
        <span>{banner}</span>
        <span className="privacy">本地处理 · DOC/OCR/音视频请用 macOS 版</span>
      </footer>
    </div>
  )
}
