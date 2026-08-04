import { getLocale, t } from './i18n'

function formatCount(n: number): string {
  return new Intl.NumberFormat(getLocale()).format(n)
}

export async function initVisitorCounter(el: HTMLElement | null) {
  if (!el) return

  try {
    const res = await fetch('/api/visit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`visit ${res.status}`)
    const data = (await res.json()) as { total?: number; today?: number }
    const total = Number(data.total) || 0
    const today = Number(data.today) || 0
    el.innerHTML = `${t('home.visitor')} <strong>${formatCount(total)}</strong><span aria-hidden="true"> · </span>${t('home.visitorToday')} <strong>${formatCount(today)}</strong>`
    el.hidden = false
  } catch {
    el.hidden = true
  }
}
