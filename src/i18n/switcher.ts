import './switcher.css'
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  getLocale,
  setLocale,
  t,
  type Locale,
} from './index'

export function mountLanguageSwitcher(host: HTMLElement | null): void {
  if (!host) return

  const current = getLocale()
  host.classList.add('lang-switch')
  host.innerHTML = `
    <button type="button" class="lang-switch__btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('common.languageLabel')}">
      <svg class="lang-switch__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.3 3.6 8.5s-1.2 5.9-3.6 8.5M12 3.5C9.6 6.1 8.4 8.8 8.4 12s1.2 5.9 3.6 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span class="lang-switch__current">${LOCALE_NATIVE_NAMES[current]}</span>
      <span class="lang-switch__caret" aria-hidden="true"></span>
    </button>
    <ul class="lang-switch__menu" role="listbox" hidden>
      ${LOCALES.map(
        (locale) => `
        <li role="none">
          <button
            type="button"
            class="lang-switch__option${locale === current ? ' is-active' : ''}"
            role="option"
            data-locale="${locale}"
            aria-selected="${locale === current}"
          >${LOCALE_NATIVE_NAMES[locale]}</button>
        </li>`,
      ).join('')}
    </ul>
  `

  const btn = host.querySelector<HTMLButtonElement>('.lang-switch__btn')
  const menu = host.querySelector<HTMLElement>('.lang-switch__menu')
  if (!btn || !menu) return

  const close = () => {
    menu.hidden = true
    btn.setAttribute('aria-expanded', 'false')
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = menu.hidden
    menu.hidden = !open
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })

  menu.addEventListener('click', (e) => {
    const option = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-locale]')
    if (!option?.dataset.locale) return
    const locale = option.dataset.locale as Locale
    if (locale === getLocale()) {
      close()
      return
    }
    setLocale(locale, { reload: true })
  })

  document.addEventListener(
    'click',
    (e) => {
      if (!host.contains(e.target as Node)) close()
    },
    { capture: true },
  )

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}
