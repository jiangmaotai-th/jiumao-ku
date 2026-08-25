import './widget.css'
import { getLocale } from '../i18n'

const MAX_LEN = 200
const HOST_ID = 'mw-note'

const CAT_IMG = `<img class="mw-note__cat" src="/note-cat.png" alt="" width="80" height="80" decoding="async">`

const PLANE_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M3.2 11.2 20.4 4.1c.7-.3 1.4.4 1.1 1.1L14.8 20.8c-.3.8-1.5.7-1.7-.2l-1.6-6.3-6.3-1.6c-.9-.2-1-1.4-.2-1.7z"/>
</svg>`

function localeTag(): string {
  try {
    return getLocale()
  } catch {
    return ''
  }
}

function setStatus(el: HTMLElement, text: string, kind: '' | 'ok' | 'err') {
  el.textContent = text
  el.classList.toggle('is-ok', kind === 'ok')
  el.classList.toggle('is-err', kind === 'err')
}

function alignToTitle(host: HTMLElement) {
  const title = document.getElementById('hero-title')
  if (!(title instanceof HTMLElement)) return
  const r = title.getBoundingClientRect()
  if (r.height < 16) return
  host.style.top = `${Math.round(Math.max(8, r.top))}px`
}

export function mountNoteWidget(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(HOST_ID)) return
  if (location.pathname.includes('/admin')) return

  const host = document.createElement('div')
  host.id = HOST_ID
  host.innerHTML = `
    <button type="button" class="mw-note__tab" aria-label="给九猫库留个小纸条" aria-expanded="false">
      ${CAT_IMG}
    </button>
    <div class="mw-note__panel" role="dialog" aria-labelledby="mw-note-title" hidden>
      <div class="mw-note__peek">${CAT_IMG}</div>
      <button type="button" class="mw-note__close" aria-label="关闭">×</button>
      <h2 id="mw-note-title" class="mw-note__title">给 <em>九猫库</em> 留个小纸条</h2>
      <p class="mw-note__hint">想说什么写在这儿就好，只有我能看见。</p>
      <form class="mw-note__form">
        <div class="mw-note__field">
          <textarea name="text" maxlength="${MAX_LEN}" placeholder="写一点你的想法吧……" required></textarea>
          <span class="mw-note__count">0 / ${MAX_LEN}</span>
        </div>
        <button type="submit" class="mw-note__send" disabled>
          ${PLANE_SVG}
          投递小纸条
        </button>
        <p class="mw-note__status" role="status"></p>
      </form>
    </div>`
  document.body.appendChild(host)
  const place = () => alignToTitle(host)
  place()
  requestAnimationFrame(place)
  window.setTimeout(place, 120)
  window.setTimeout(place, 480)
  void document.fonts?.ready.then(place)
  window.addEventListener('resize', place)

  const tab = host.querySelector<HTMLButtonElement>('.mw-note__tab')!
  const panel = host.querySelector<HTMLElement>('.mw-note__panel')!
  const closeBtn = host.querySelector<HTMLButtonElement>('.mw-note__close')!
  const form = host.querySelector<HTMLFormElement>('.mw-note__form')!
  const textarea = host.querySelector<HTMLTextAreaElement>('textarea')!
  const count = host.querySelector<HTMLElement>('.mw-note__count')!
  const send = host.querySelector<HTMLButtonElement>('.mw-note__send')!
  const status = host.querySelector<HTMLElement>('.mw-note__status')!

  const syncCount = () => {
    const n = textarea.value.length
    count.textContent = `${Math.min(n, MAX_LEN)} / ${MAX_LEN}`
    send.disabled = n < 2 || n > MAX_LEN
  }

  const open = () => {
    host.classList.add('is-open')
    panel.hidden = false
    tab.setAttribute('aria-expanded', 'true')
    setStatus(status, '', '')
    requestAnimationFrame(() => textarea.focus())
  }

  const close = () => {
    host.classList.remove('is-open')
    panel.hidden = true
    tab.setAttribute('aria-expanded', 'false')
    tab.focus()
  }

  tab.addEventListener('click', open)
  closeBtn.addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && host.classList.contains('is-open')) close()
  })
  textarea.addEventListener('input', () => {
    if (textarea.value.length > MAX_LEN) {
      textarea.value = textarea.value.slice(0, MAX_LEN)
    }
    syncCount()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = textarea.value.trim()
    if (text.length < 2) {
      setStatus(status, '再写几个字吧', 'err')
      return
    }
    send.disabled = true
    setStatus(status, '', '')
    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          text,
          path: location.pathname.slice(0, 180),
          locale: localeTag(),
        }),
      })
      if (res.status === 429) {
        setStatus(status, '写得太勤了，歇一会儿再投', 'err')
        send.disabled = false
        return
      }
      if (!res.ok) {
        setStatus(status, '没送出去，再试一次', 'err')
        send.disabled = false
        return
      }
      textarea.value = ''
      syncCount()
      setStatus(status, '收到了，谢谢你。', 'ok')
      window.setTimeout(close, 1400)
    } catch {
      setStatus(status, '没送出去，再试一次', 'err')
      send.disabled = false
    }
  })

  syncCount()
}
