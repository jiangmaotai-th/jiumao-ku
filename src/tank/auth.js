import { createAccountClient, gameSaveOf } from '../scratch/game/account.js'
import { g } from './i18n.js'
import { setCloudWriter } from './save.js'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

export function createTankAuth({ modalEl, button, toast, snapshot, applyCloud, persist }) {
  const accounts = createAccountClient('tank')
  let session = null

  function paintBtn() {
    if (!button) return
    const name = session?.username || ''
    button.classList.toggle('is-signed', Boolean(name))
    button.setAttribute('aria-label', name ? g('accountUser', { name }) : g('guestAccount'))
  }

  function close() {
    modalEl.hidden = true
    modalEl.innerHTML = ''
  }

  setCloudWriter((snap) => {
    if (!session) return
    return accounts.save({ tank: snap })
  })

  function showLogin() {
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card auth-card">
        <h2>${g('accountTitle')}</h2>
        <p>${g('authHintUpgrade')}</p>
        <div class="row">
          <button type="button" class="primary" data-login>${g('login')}</button>
          <button type="button" class="ghost" data-register>${g('quickRegister')}</button>
        </div>
        <button type="button" class="ghost" data-cancel>${g('close')}</button>
      </div>`
    modalEl.querySelector('[data-cancel]').addEventListener('click', close)
    modalEl.querySelectorAll('[data-login],[data-register]').forEach((button) => {
      button.addEventListener('click', () => accounts.redirectLogin())
    })
  }

  function open() {
    if (!session?.username) {
      showLogin()
      return
    }
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card auth-card">
        <h2>${g('accountTitle')}</h2>
        <p class="account-name">${escapeHtml(session.username)}</p>
        <p>${g('accountSaved')}</p>
        <div class="row">
          <button type="button" data-cancel>${g('close')}</button>
          <button type="button" class="danger" data-logout>${g('logout')}</button>
        </div>
      </div>`
    modalEl.querySelector('[data-cancel]').addEventListener('click', close)
    modalEl.querySelector('[data-logout]').addEventListener('click', async () => {
      persist()
      await accounts.logout().catch(() => {})
      session = null
      close()
      paintBtn()
      toast(g('loggedOut'))
    })
  }

  async function boot() {
    try {
      session = await accounts.current()
    } catch {
      session = null
    }
    paintBtn()
    if (!session) return
    try {
      const data = await accounts.load()
      const cloud = gameSaveOf(data.save, 'tank')
      if (cloud) applyCloud(cloud)
      else await accounts.save({ tank: snapshot() })
    } catch {
      session = null
    }
    paintBtn()
  }

  button?.addEventListener('click', open)

  return { boot, open, close, paintBtn }
}
