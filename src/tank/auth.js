import { createAccountClient, gameSaveOf } from '../scratch/game/account.js'
import { g } from './i18n.js'
import { setCloudWriter } from './save.js'

const ERRORS = {
  '账号或密码不对': 'loginBad',
  '请重新登录': 'reLogin',
  '需要游戏服务器才能发送邮箱验证码': 'needServerCode',
  '需要游戏服务器才能完成邮箱注册': 'needServerRegister',
  '账号需为 2–16 个字，可用中文、字母或数字': 'nameRule',
  '密码需为 6–32 位': 'passRule',
  '请填写正确的邮箱': 'emailRule',
  '这个账号已经有人用了': 'userTaken',
  '这个邮箱已经注册过了': 'emailTaken',
  '验证码刚发过，请稍后再获取': 'codeWait',
  '请填写 6 位邮箱验证码': 'needSixCode',
  '请先获取邮箱验证码': 'getCodeFirst',
  '请使用获取验证码时填写的账号': 'sameUser',
  '请使用获取验证码时填写的密码': 'samePass',
  '验证码已失效，请重新获取': 'codeExpired',
  '验证码不对': 'badCode',
  '这个账号或邮箱已经有人用了': 'userOrEmailTaken',
}

function gameError(message) {
  const key = ERRORS[String(message || '')]
  return key ? g(key) : (message || g('failRetry'))
}

function fieldsFrom(form) {
  const data = new FormData(form)
  return {
    username: String(data.get('username') || '').trim(),
    email: String(data.get('email') || '').trim(),
    password: String(data.get('password') || ''),
    confirm: String(data.get('confirm') || ''),
    code: String(data.get('code') || '').trim(),
  }
}

function authForm(kind) {
  if (kind === 'login') {
    return `<form class="auth-form" data-auth="login">
      <label>${g('userOrEmail')}<input name="username" maxlength="64" autocomplete="username" required></label>
      <label>${g('password')}<input name="password" type="password" maxlength="32" autocomplete="current-password" required></label>
      <p class="auth-error" data-error hidden></p>
      <button class="primary" type="submit">${g('login')}</button>
    </form>`
  }
  const codeRow = `<label>${g('code')}
      <span class="auth-code-row">
        <input name="code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required>
        <button class="ghost" type="button" data-send-code>${g('sendCode')}</button>
      </span>
    </label>`
  if (kind === 'quick') {
    return `<form class="auth-form" data-auth="quick">
      <p class="auth-hint">${g('quickHint')}</p>
      <label>${g('email')}<input name="email" type="email" maxlength="64" autocomplete="email" required></label>
      <label>${g('password')}<input name="password" type="password" maxlength="32" autocomplete="new-password" required></label>
      ${codeRow}
      <p class="auth-error" data-error hidden></p>
      <button class="primary" type="submit">${g('finishRegister')}</button>
      <button class="auth-link" type="button" data-auth-tab="register">${g('customRegister')}</button>
    </form>`
  }
  return `<form class="auth-form" data-auth="register">
    <label>${g('email')}<input name="email" type="email" maxlength="64" autocomplete="email" required></label>
    <label>${g('usernameOptional')}<input name="username" maxlength="16" autocomplete="username" placeholder="${g('usernamePlaceholder')}"></label>
    <label>${g('password')}<input name="password" type="password" maxlength="32" autocomplete="new-password" required></label>
    <label>${g('confirm')}<input name="confirm" type="password" maxlength="32" autocomplete="new-password" required></label>
    ${codeRow}
    <p class="auth-error" data-error hidden></p>
    <button class="primary" type="submit">${g('finishRegister')}</button>
    <button class="auth-link" type="button" data-auth-tab="quick">${g('backToQuick')}</button>
  </form>`
}

export function createTankAuth({ modalEl, button, toast, snapshot, applyCloud, persist }) {
  const accounts = createAccountClient()
  let session = accounts.restore()
  let codeCooldownUntil = 0
  let codeTimer = 0

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
    if (!session?.token) return
    return accounts.save(session.token, { tank: snap })
  })

  function paintCooldown(btn) {
    clearInterval(codeTimer)
    const tick = () => {
      const remain = Math.ceil((codeCooldownUntil - Date.now()) / 1000)
      if (!btn) return
      if (remain <= 0) {
        btn.disabled = false
        btn.textContent = g('sendCode')
        clearInterval(codeTimer)
        return
      }
      btn.disabled = true
      btn.textContent = g('retryIn', { n: remain })
    }
    tick()
    codeTimer = window.setInterval(tick, 250)
  }

  function bindForm(host, kind) {
    const form = host.querySelector('form')
    const error = form.querySelector('[data-error]')
    const showError = (message) => {
      error.hidden = false
      error.textContent = message
    }
    form.querySelector('[data-send-code]')?.addEventListener('click', async (event) => {
      const btn = event.currentTarget
      const fields = fieldsFrom(form)
      error.hidden = true
      if (kind === 'register' && fields.password !== fields.confirm) {
        showError(g('passwordMismatch'))
        return
      }
      btn.disabled = true
      try {
        const data = await accounts.sendCode(fields.username, fields.email, fields.password)
        codeCooldownUntil = Date.now() + 60000
        paintCooldown(btn)
        toast(data?.username ? g('codeSentAs', { name: data.username }) : g('codeSent'))
      } catch (err) {
        showError(gameError(err.message) || g('codeFail'))
        btn.disabled = false
      }
    })
    const sendBtn = form.querySelector('[data-send-code]')
    if (sendBtn && codeCooldownUntil > Date.now()) paintCooldown(sendBtn)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fields = fieldsFrom(form)
      const btn = form.querySelector('button[type=submit]')
      error.hidden = true
      if (kind === 'register' && fields.password !== fields.confirm) {
        showError(g('passwordMismatch'))
        return
      }
      btn.disabled = true
      try {
        if (kind === 'login') {
          const data = await accounts.login(fields.username, fields.password)
          session = { username: data.username, token: data.token }
          const cloud = gameSaveOf(data.save, 'tank')
          if (cloud) applyCloud(cloud)
          else persist()
          close()
          paintBtn()
          toast(g('welcomeBack', { name: data.username }))
          return
        }
        const data = await accounts.register(fields.username, fields.password, { tank: snapshot() }, {
          email: fields.email,
          code: fields.code,
        })
        session = { username: data.username, token: data.token }
        persist()
        close()
        paintBtn()
        toast(g('accountCreated', { name: data.username }))
      } catch (err) {
        showError(gameError(err.message) || g('failRetry'))
        btn.disabled = false
      }
    })
  }

  function showAuth(kind = 'quick') {
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card auth-card">
        <h2>${g('accountTitle')}</h2>
        <p>${g('authHintUpgrade')}</p>
        <div class="auth-tabs">
          <button type="button" class="${kind === 'login' ? 'primary' : 'ghost'}" data-auth-tab="login">${g('login')}</button>
          <button type="button" class="${kind === 'login' ? 'ghost' : 'primary'}" data-auth-tab="quick">${g('quickRegister')}</button>
        </div>
        <div data-auth-panel>${authForm(kind)}</div>
        <button type="button" class="ghost" data-cancel>${g('close')}</button>
      </div>`
    const panel = modalEl.querySelector('[data-auth-panel]')
    const show = (next) => {
      modalEl.querySelectorAll('.auth-tabs [data-auth-tab]').forEach((tab) => {
        tab.className = tab.dataset.authTab === (next === 'login' ? 'login' : 'quick') ? 'primary' : 'ghost'
      })
      panel.innerHTML = authForm(next)
      bindForm(modalEl, next)
      panel.querySelector('[data-auth-tab]')?.addEventListener('click', (event) => {
        show(event.currentTarget.dataset.authTab)
      })
    }
    modalEl.querySelectorAll('.auth-tabs [data-auth-tab]').forEach((tab) => {
      tab.addEventListener('click', () => show(tab.dataset.authTab))
    })
    modalEl.querySelector('[data-cancel]').addEventListener('click', close)
    show(kind)
  }

  function open() {
    if (!session?.username) {
      showAuth('quick')
      return
    }
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card auth-card">
        <h2>${g('accountTitle')}</h2>
        <p class="account-name">${session.username}</p>
        <p>${g('accountSaved')}</p>
        <div class="row">
          <button type="button" data-cancel>${g('close')}</button>
          <button type="button" class="danger" data-logout>${g('logout')}</button>
        </div>
      </div>`
    modalEl.querySelector('[data-cancel]').addEventListener('click', close)
    modalEl.querySelector('[data-logout]').addEventListener('click', async () => {
      persist()
      if (session?.token) await accounts.logout(session.token)
      session = null
      close()
      paintBtn()
      toast(g('loggedOut'))
    })
  }

  async function boot() {
    paintBtn()
    if (!session?.token) return
    try {
      const data = await accounts.load(session.token)
      session = { username: data.username, token: data.token || session.token }
      const cloud = gameSaveOf(data.save, 'tank')
      if (cloud) applyCloud(cloud)
      else persist()
    } catch {
      session = null
    }
    paintBtn()
  }

  button?.addEventListener('click', open)

  return { boot, open, close, paintBtn }
}
