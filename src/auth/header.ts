import { t } from '../i18n'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string))
}

function identityOf(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const row = data as Record<string, unknown>
  const user = row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : row
  const email = typeof user.email === 'string' ? user.email.trim() : ''
  const name = typeof user.name === 'string' ? user.name.trim() : ''
  return email || name
}

function loginHref(): string {
  const back = encodeURIComponent(location.href)
  return `/api/auth/login?return=${back}`
}

function loggedOutMarkup(): string {
  return `<a class="header-auth__login" href="${escapeHtml(loginHref())}">${escapeHtml(t('common.loginSignup'))}</a>`
}

function loggedInMarkup(who: string): string {
  const name = who
    ? `<span class="header-auth__name" title="${escapeHtml(who)}">${escapeHtml(who)}</span>`
    : ''
  return `<span class="header-auth__user">${name}<button type="button" class="header-auth__logout" data-auth-logout>${escapeHtml(t('common.logout'))}</button></span>`
}

async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } finally {
    location.reload()
  }
}

/** Place a login / account control immediately before a header anchor (usually #lang-switch). */
export function mountHeaderAuth(anchor: HTMLElement | null): void {
  const parent = anchor?.parentElement
  if (!anchor || !parent) return

  let slot = parent.querySelector<HTMLElement>(':scope > .header-auth')
  if (!slot) {
    slot = document.createElement('div')
    slot.className = 'header-auth'
    anchor.insertAdjacentElement('beforebegin', slot)
    slot.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-auth-logout]')
      if (!button || !slot?.contains(button)) return
      event.preventDefault()
      button.disabled = true
      void logout()
    })
  }

  const seq = Number(slot.dataset.seq || '0') + 1
  slot.dataset.seq = String(seq)
  slot.innerHTML = loggedOutMarkup()

  void fetch('/api/auth/me', { credentials: 'include' })
    .then(async (res) => {
      if (slot?.dataset.seq !== String(seq)) return
      const type = res.headers.get('content-type') || ''
      if (res.status !== 200 || !type.includes('json')) {
        slot.innerHTML = loggedOutMarkup()
        return
      }
      const data = await res.json().catch(() => null)
      slot.innerHTML = loggedInMarkup(identityOf(data))
    })
    .catch(() => {
      if (slot?.dataset.seq !== String(seq)) return
      slot.innerHTML = loggedOutMarkup()
    })
}
