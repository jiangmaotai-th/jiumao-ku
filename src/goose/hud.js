import { LEVELS } from './levels.js'
import { g } from './i18n.js'
import { localizedHref } from '../i18n'

function siteHomeHref() {
  if (typeof location === 'undefined') return 'https://maotaiworks.com/'
  const host = location.hostname
  if (
    host === 'maotaiworks.com' ||
    host === 'www.maotaiworks.com' ||
    host === 'localhost' ||
    host === '127.0.0.1'
  ) {
    return localizedHref('/')
  }
  return 'https://maotaiworks.com/'
}

const SAVE_UNLOCK = 'quanyun_level'
const SAVE_MUTE = 'quanyun_mute'
const SAVE_ENDLESS = 'quanyun_endless_best'

function buildMarqueePts(n) {
  const L = 0.3
  const R = 0.7
  const T = 0.016
  const B = 0.126
  const rx = 0.058
  const ry = 0.05
  const nEdge = 32
  const nArc = 18
  const pts = []
  const push = (x, y) => {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(x - last[0], y - last[1]) > 1e-5) pts.push([x, y])
  }
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= nArc; i++) {
      const a = a0 + (a1 - a0) * (i / nArc)
      push(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
    }
  }
  for (let i = 0; i <= nEdge; i++) {
    const u = i / nEdge
    const x = L + rx + (R - L - 2 * rx) * u
    const bump = 0.0075 * Math.abs(Math.sin(3 * Math.PI * u))
    const peak = 0.006 * Math.exp(-(((u - 0.5) / 0.16) ** 2))
    push(x, T - bump - peak)
  }
  arc(R - rx, T + ry, -Math.PI / 2, 0)
  for (let i = 1; i < nEdge; i++) {
    const u = i / nEdge
    push(R, T + ry + (B - T - 2 * ry) * u)
  }
  arc(R - rx, B - ry, 0, Math.PI / 2)
  for (let i = 1; i <= nEdge; i++) {
    const u = i / nEdge
    const x = R - rx - (R - L - 2 * rx) * u
    const bump = 0.006 * Math.abs(Math.sin(3 * Math.PI * u))
    push(x, B + bump)
  }
  arc(L + rx, B - ry, Math.PI / 2, Math.PI)
  for (let i = 1; i < nEdge; i++) {
    const u = i / nEdge
    push(L, B - ry - (B - T - 2 * ry) * u)
  }
  arc(L + rx, T + ry, Math.PI, Math.PI * 1.5)

  const dist = [0]
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i % pts.length]
    dist.push(dist[dist.length - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const tot = dist[dist.length - 1] || 1
  const out = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const target = (tot * i) / n
    while (j + 1 < dist.length && dist[j + 1] < target) j++
    const a = pts[j % pts.length]
    const b = pts[(j + 1) % pts.length]
    const seg = dist[j + 1] - dist[j] || 1
    const u = (target - dist[j]) / seg
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
  }
  return out
}

export function createHud(root) {
  const el = document.createElement('div')
  el.className = 'goose-hud'
  el.innerHTML = `
    <div class="gh-top-left">
      <div class="gh-coins-bar" data-coins-bar>
        <i class="gh-coin"></i>
        <b data-coins>0</b>
        <button type="button" class="gh-plus" data-coin-plus aria-label="shop">+</button>
      </div>
      <button type="button" class="gh-mute" data-mute-fab aria-label="${g('soundOff')}">
        <span data-mute-icon>🔊</span>
      </button>
    </div>
    <aside class="gh-catch-rail" data-catch-rail>
      <div class="gh-catch-rail-head" data-catch-head>
        <small>${g('lootTitle')}</small>
        <b data-catch-count>0</b>
      </div>
      <div class="gh-catch-pole" aria-hidden="true"></div>
      <ol class="gh-catch-list" data-catch-list></ol>
    </aside>
    <div class="gh-marquee" data-marquee aria-hidden="true"></div>
    <button type="button" class="gh-hit" data-pick-open aria-label="${g('pickLevel')}"></button>
    <button type="button" class="gh-hit" data-settings aria-label="${g('settings')}"></button>
    <button type="button" class="gh-hit" data-pause aria-label="${g('paused')}"></button>
    <div class="gh-play-stack" data-play-stack>
      <div class="gh-modes">
        <button type="button" class="gh-mode is-story" data-mode="story">
          <strong>${g('storyMode')}</strong>
          <span data-story-sub></span>
        </button>
        <button type="button" class="gh-mode is-endless" data-mode="endless">
          <strong>${g('endlessMode')}</strong>
          <span data-endless-sub></span>
        </button>
      </div>
      <div class="gh-remain-plaque">
        <div class="gh-remain-main" data-remain-main></div>
        <div class="gh-remain-sub" data-remain-sub></div>
        <div class="gh-remain-score" data-score></div>
      </div>
    </div>
    <aside class="gh-wind-card" data-wind-card>
      <h3>${g('windTitle')}</h3>
      <div class="gh-wind-arrow" data-wind-arrow>➤</div>
      <div class="gh-wind-dir" data-wind-dir></div>
      <div class="gh-wind-lv" data-wind-lv></div>
      <div class="gh-wind-meter" data-wind-meter></div>
    </aside>
    <div class="gh-catch-pop" data-catch-pop hidden>
      <div class="gh-catch-fx" aria-hidden="true">
        <span class="gh-catch-burst is-a"><img src="/goose/catch-burst.png" alt=""></span>
        <span class="gh-catch-burst is-b"><img src="/goose/catch-burst.png" alt=""></span>
        <span class="gh-catch-sparks">
          ${Array.from({ length: 10 }, () => '<i></i>').join('')}
        </span>
      </div>
      <div class="gh-catch-hero">
        <img class="gh-catch-art" src="/goose/catch-grab.png" alt="" draggable="false">
      </div>
      <img class="gh-catch-title" data-catch-title src="/goose/catch-title.png?v=2" alt="恭喜套中" draggable="false">
      <div class="gh-catch-foot">
        <b class="gh-catch-score" data-catch-score></b>
        <span class="gh-catch-extra" data-catch-extra hidden></span>
        <span class="gh-catch-tap" data-catch-tap>${g('catchTap')}</span>
      </div>
    </div>
    <div class="gh-line" data-line hidden></div>
    <div class="gh-level-sheet" data-picks hidden></div>
    <div class="gh-settings" data-settings-panel hidden>
      <div class="gh-card">
        <h2>${g('settings')}</h2>
        <button type="button" class="gh-btn" data-mute>${g('soundOn')}</button>
        <div class="gh-diff" data-diff>
          <button type="button" data-diff="easy">${g('easy')}</button>
          <button type="button" data-diff="normal" class="on">${g('normal')}</button>
          <button type="button" data-diff="hard">${g('hard')}</button>
        </div>
        <button type="button" class="gh-btn" data-board>${g('board')}</button>
        <a class="gh-btn" data-home href="${siteHomeHref()}">${g('home')}</a>
        <button type="button" class="gh-btn ghost" data-settings-close>${g('resume')}</button>
      </div>
    </div>
    <div class="gh-pause" data-paused hidden>
      <div class="gh-card">
        <h2>${g('paused')}</h2>
        <button type="button" class="gh-btn" data-resume>${g('resume')}</button>
      </div>
    </div>
    <div class="gh-shop" data-shop hidden></div>
    <div class="gh-board" data-board-box hidden></div>
    <div class="gh-result" data-result hidden></div>
    <div class="gh-rotate" data-rotate hidden><p>${g('rotate')}</p></div>
  `
  root.appendChild(el)

  const picks = el.querySelector('[data-picks]')
  picks.innerHTML = `
    <div class="gh-card gh-card-wide">
      <h2>${g('pickLevel')}</h2>
      <div class="gh-level-grid">
        ${LEVELS.map((lv) => `<button type="button" data-pick="${lv.id}"><b>${lv.id}</b>${lv.name}</button>`).join('')}
      </div>
      <button type="button" class="gh-btn ghost" data-picks-close>${g('resume')}</button>
    </div>`

  function unlocked() {
    try { return Math.max(1, Number(localStorage.getItem(SAVE_UNLOCK) || 1)) } catch { return 1 }
  }

  function endlessBest() {
    try { return Math.max(0, Number(localStorage.getItem(SAVE_ENDLESS) || 0)) } catch { return 0 }
  }

  function windGrade(str) {
    const a = Math.abs(Number(str) || 0)
    if (a < 0.05) return 0
    if (a < 1) return 1
    if (a < 2) return 2
    if (a < 2.8) return 3
    if (a < 3.5) return 4
    return 5
  }

  function paint(state) {
    const lv = state.storyLevel || state.level
    const endless = state.mode === 'endless'
    el.querySelector('[data-coins]').textContent = String(state.coins || 0)
    el.querySelector('[data-story-sub]').textContent = g('levelLine', { n: lv.id, name: lv.name })
    el.querySelector('[data-endless-sub]').textContent = endless
      ? `${g('geeseCaught', { n: state.geese || 0 })}${state.weapon ? ` · ${state.weapon}` : ''}`
      : g('endlessBest', { n: endlessBest() })
    el.querySelector('[data-mode="story"]').classList.toggle('on', !endless)
    el.querySelector('[data-mode="endless"]').classList.toggle('on', endless)

    const left = state.ringsLeft
    el.querySelector('[data-remain-main]').innerHTML = g('remainTimes', { n: `<b>${left}</b>` })
    el.querySelector('[data-remain-sub]').textContent = g('remainRings', { n: left })
    el.querySelector('[data-remain-main]').classList.toggle('is-last', left === 1)
    el.querySelector('[data-score]').textContent = endless
      ? g('shopIn', { n: ((state.catchN || 0) % 3) === 0 ? 3 : 3 - ((state.catchN || 0) % 3) })
      : `${g('score', { n: state.score })} · ${g('target', { n: state.level.target })}`

    const grade = windGrade(state.windStr)
    const dir = Number(state.windNow) || 0
    const east = dir >= 0
    el.querySelector('[data-wind-dir]').textContent = grade ? (east ? g('windEast') : g('windWest')) : g('windNone')
    el.querySelector('[data-wind-lv]').textContent = g('windLv', { n: grade })
    const arrow = el.querySelector('[data-wind-arrow]')
    arrow.textContent = grade ? '➤' : '○'
    arrow.classList.toggle('is-west', grade > 0 && !east)
    arrow.classList.toggle('is-calm', grade === 0)
    el.querySelector('[data-wind-meter]').innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<i class="${i < grade ? 'on' : ''}"></i>`).join('')

    el.querySelector('[data-mute]').textContent = state.muted ? g('soundOff') : g('soundOn')
    const muteFab = el.querySelector('[data-mute-fab]')
    if (muteFab) {
      muteFab.classList.toggle('is-off', !!state.muted)
      muteFab.setAttribute('aria-label', state.muted ? g('soundOn') : g('soundOff'))
      const icon = muteFab.querySelector('[data-mute-icon]')
      if (icon) icon.textContent = state.muted ? '🔇' : '🔊'
    }
    picks.querySelectorAll('[data-pick]').forEach((btn) => {
      const id = Number(btn.dataset.pick)
      btn.disabled = id > unlocked()
      btn.classList.toggle('on', !endless && id === state.level.id)
    })
    el.querySelectorAll('[data-diff] [data-diff]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.diff === (state.diff || 'normal'))
    })
    const line = el.querySelector('[data-line]')
    if (state.bossLine) {
      line.hidden = false
      line.textContent = state.bossLine
    } else line.hidden = true
  }

  function toggleLevels(on) {
    const sheet = el.querySelector('[data-picks]')
    sheet.hidden = typeof on === 'boolean' ? !on : !sheet.hidden
    if (!sheet.hidden) el.querySelector('[data-settings-panel]').hidden = true
  }

  function toggleSettings(on) {
    const panel = el.querySelector('[data-settings-panel]')
    panel.hidden = typeof on === 'boolean' ? !on : !panel.hidden
    if (!panel.hidden) el.querySelector('[data-picks]').hidden = true
  }

  function showResult(state, onNext, onJump, onRetry) {
    const box = el.querySelector('[data-result]')
    const win = state.score >= state.level.target
    const bestKey = `quanyun_best_L${state.level.id}`
    let best = 0
    try { best = Number(localStorage.getItem(bestKey) || 0) } catch { /* */ }
    if (state.score > best) {
      best = state.score
      try { localStorage.setItem(bestKey, String(best)) } catch { /* */ }
    }
    if (win) {
      try { localStorage.setItem(SAVE_UNLOCK, String(Math.max(unlocked(), state.level.id + 1))) } catch { /* */ }
    }
    const list = (state.hits || []).map((h) => `<li>${h.name} +${h.score}</li>`).join('') || `<li>${g('noHit')}</li>`
    box.hidden = false
    box.innerHTML = `
      <div class="gh-card">
        <h2>${win ? g('win') : g('lose')}</h2>
        <p>${g('total', { n: state.score })} · ${g('best', { n: best })}</p>
        <ul>${list}</ul>
        <div class="gh-actions">
          <button type="button" class="gh-btn" data-retry>${g('retry')}</button>
          ${win && state.level.id < 6 ? `<button type="button" class="gh-btn primary" data-next>${g('next')}</button>` : ''}
          <button type="button" class="gh-btn ghost" data-jump>${g('jump')}</button>
        </div>
      </div>`
    box.querySelector('[data-retry]').onclick = () => { box.hidden = true; onRetry() }
    box.querySelector('[data-next]')?.addEventListener('click', () => { box.hidden = true; onNext() })
    box.querySelector('[data-jump]').onclick = () => { box.hidden = true; onJump() }
  }

  function showEndlessResult(state, onRetry, onStory, onSubmit, onBoard) {
    try {
      const best = Math.max(endlessBest(), state.geese || 0)
      localStorage.setItem(SAVE_ENDLESS, String(best))
    } catch { /* */ }
    const box = el.querySelector('[data-result]')
    box.hidden = false
    box.innerHTML = `
      <div class="gh-card gh-card-wide">
        <h2>${g('endlessOver')}</h2>
        <p>${g('geeseCaught', { n: state.geese })} · ${g('total', { n: state.score })}</p>
        <form data-submit class="gh-name">
          <input name="name" maxlength="12" placeholder="${g('nameHint')}" autocomplete="nickname" />
          <button type="submit" class="gh-btn primary">${g('submitBoard')}</button>
        </form>
        <ol data-ranks class="gh-ranks"></ol>
        <div class="gh-actions">
          <button type="button" class="gh-btn" data-retry>${g('retry')}</button>
          <button type="button" class="gh-btn ghost" data-story>${g('jump')}</button>
        </div>
      </div>`
    const ranks = box.querySelector('[data-ranks]')
    const paintBoard = (list) => {
      ranks.innerHTML = (list || []).slice(0, 12).map((row, i) =>
        `<li><b>${i + 1}</b> ${esc(row.name)} · ${row.geese}${g('geeseUnit')} · ${row.score}</li>`).join('') || `<li>${g('emptyBoard')}</li>`
    }
    onBoard?.().then(paintBoard)
    box.querySelector('[data-submit]').onsubmit = async (e) => {
      e.preventDefault()
      const name = new FormData(e.target).get('name') || g('anon')
      const list = await onSubmit(String(name))
      paintBoard(list)
    }
    box.querySelector('[data-retry]').onclick = () => { box.hidden = true; onRetry() }
    box.querySelector('[data-story]').onclick = () => { box.hidden = true; onStory() }
  }

  function showShop({ coins, ringsLeft, lastChance, items, onBuy, onClose }) {
    const box = el.querySelector('[data-shop]')
    box.hidden = false
    const kindKey = { ammo: 'kindAmmo', weapon: 'kindWeapon', buff: 'kindBuff' }
    box.innerHTML = `
      <div class="gh-card gh-card-wide">
        <h2>${lastChance ? g('lastShop') : g('shop')}</h2>
        <p>${g('shopHint')}</p>
        <p>${g('coins', { n: coins })} · ${g('remainRings', { n: ringsLeft })}</p>
        <div class="gh-shop-grid">
          ${items.map((it) => `
            <button type="button" class="gh-item${coins < it.cost ? ' is-poor' : ''}" data-id="${it.id}">
              <small>${g(kindKey[it.kind] || 'kindBuff')}</small>
              <strong>${it.title}</strong>
              <span>${it.blurb}</span>
              <em>${g('cost', { n: it.cost })}</em>
            </button>`).join('')}
        </div>
        <button type="button" class="gh-btn" data-close>${lastChance ? g('giveUp') : g('shopClose')}</button>
      </div>`
    box.querySelectorAll('[data-id]').forEach((btn) => {
      btn.onclick = () => {
        const item = items.find((i) => i.id === btn.dataset.id)
        if (!item) return
        if (onBuy(item)) onClose()
        else {
          btn.classList.add('is-poor')
          const coinsEl = box.querySelector('p:nth-of-type(2)')
          if (coinsEl) coinsEl.textContent = `${g('noCoin')} · ${g('coins', { n: coins })}`
        }
      }
    })
    box.querySelector('[data-close]').onclick = () => onClose()
  }

  function hideShop() {
    el.querySelector('[data-shop]').hidden = true
  }

  async function showBoard(loader) {
    const box = el.querySelector('[data-board-box]')
    box.hidden = false
    box.innerHTML = `<div class="gh-card gh-card-wide"><h2>${g('board')}</h2><ol class="gh-ranks">${g('loading')}</ol><button type="button" class="gh-btn" data-close>${g('shopClose')}</button></div>`
    const list = await loader()
    box.querySelector('.gh-ranks').innerHTML = (list || []).slice(0, 15).map((row, i) =>
      `<li><b>${i + 1}</b> ${esc(row.name)} · ${row.geese}${g('geeseUnit')}</li>`).join('') || `<li>${g('emptyBoard')}</li>`
    box.querySelector('[data-close]').onclick = () => { box.hidden = true }
  }

  function hideResult() {
    el.querySelector('[data-result]').hidden = true
  }

  const catchPop = el.querySelector('[data-catch-pop]')
  const catchQueue = []
  let catchBusy = false
  let catchCurrent = null
  let catchClosing = false
  const popTimers = []
  const CATCH_OUT_MS = 280

  function later(fn, ms) {
    const id = window.setTimeout(fn, ms)
    popTimers.push(id)
    return id
  }

  function playCatchPop(info) {
    catchBusy = true
    catchClosing = false
    catchCurrent = info
    const scoreEl = catchPop.querySelector('[data-catch-score]')
    const extra = catchPop.querySelector('[data-catch-extra]')
    if (info.coinsOnly) {
      scoreEl.textContent = g('caughtCoins', { n: info.coins || 0 })
      scoreEl.classList.add('is-coins')
      extra.hidden = true
    } else {
      scoreEl.textContent = g('caughtScore', { n: info.score })
      scoreEl.classList.remove('is-coins')
      if (info.coins) {
        extra.hidden = false
        extra.textContent = g('caughtCoins', { n: info.coins })
      } else {
        extra.hidden = true
      }
    }
    catchPop.hidden = false
    catchPop.classList.remove('is-out')
    void catchPop.offsetWidth
    catchPop.classList.add('is-in')
    info.onShow?.()
  }

  function finishCatchPop() {
    const info = catchCurrent
    catchCurrent = null
    catchBusy = false
    catchClosing = false
    const next = catchQueue.shift()
    if (next) playCatchPop(next)
    else {
      catchPop.hidden = true
      catchPop.classList.remove('is-in', 'is-out')
    }
    info?.onDone?.()
  }

  function dismissCatchPop() {
    if (!catchBusy || catchClosing || catchPop.hidden) return
    catchClosing = true
    catchPop.classList.add('is-out')
    later(finishCatchPop, CATCH_OUT_MS)
  }

  function showCatchPop(info) {
    if (catchBusy) catchQueue.push(info)
    else playCatchPop(info)
  }

  function hideCatchPop() {
    catchQueue.length = 0
    catchCurrent = null
    catchBusy = false
    catchClosing = false
    while (popTimers.length) window.clearTimeout(popTimers.pop())
    catchPop.hidden = true
    catchPop.classList.remove('is-in', 'is-out')
  }

  catchPop.addEventListener('pointerup', (e) => {
    e.preventDefault()
    e.stopPropagation()
    dismissCatchPop()
  })

  const rail = el.querySelector('[data-catch-rail]')
  const railList = el.querySelector('[data-catch-list]')
  const railHead = el.querySelector('[data-catch-head]')
  const railCount = el.querySelector('[data-catch-count]')

  function restackRail() {
    const n = railList.children.length
    rail.dataset.n = String(n)
    rail.classList.toggle('is-on', n > 0)
    railCount.textContent = `${n}${g('geeseUnit')}`
    const step = n <= 4 ? 0.84 : n <= 8 ? 0.64 : Math.max(0.36, 0.84 - (n - 4) * 0.06)
    rail.style.setProperty('--step', String(step))
  }

  function addCatch(info = {}) {
    const kind = ['gosling', 'goose', 'gander', 'boss'].includes(info.kind) ? info.kind : 'goose'
    const item = document.createElement('li')
    item.className = `gh-trophy kind-${kind} is-fly`
    item.innerHTML = trophyMarkup(kind)
    railList.prepend(item)
    restackRail()
    railHead.classList.remove('is-pop')
    void railHead.offsetWidth
    railHead.classList.add('is-pop')
    item.addEventListener('animationend', (e) => {
      if (e.animationName === 'trophyFly') item.classList.remove('is-fly')
    })
  }

  function clearCatches() {
    railList.innerHTML = ''
    railHead.classList.remove('is-pop')
    restackRail()
  }

  if (import.meta.env.DEV) {
    el.__addCatch = addCatch
    el.__clearCatches = clearCatches
  }

  el.querySelector('[data-settings]').addEventListener('click', () => toggleSettings())
  el.querySelector('[data-settings-close]').addEventListener('click', () => toggleSettings(false))
  el.querySelector('[data-picks-close]').addEventListener('click', () => toggleLevels(false))
  el.querySelector('[data-board]').addEventListener('click', () => {
    toggleSettings(false)
  })

  const HIT = {
    pick: [0.385, 0.136, 0.23, 0.042],
    settings: [0.768, 0.012, 0.095, 0.108],
    pause: [0.872, 0.012, 0.095, 0.108],
  }

  const MARQUEE_N = 48
  const marquee = el.querySelector('[data-marquee]')
  const MARQUEE_PTS = buildMarqueePts(MARQUEE_N)
  marquee.innerHTML = MARQUEE_PTS.map((_, i) => `<i style="--i:${i}"></i>`).join('')
  const marqueeBulbs = [...marquee.children]

  function layoutHits(img) {
    const host = el.parentElement
    if (!host) return
    const sw = host.clientWidth
    const sh = host.clientHeight
    const iw = img?.naturalWidth || 950
    const ih = img?.naturalHeight || 1024
    const scale = Math.max(sw / iw, sh / ih)
    const dw = iw * scale
    const dh = ih * scale
    const ox = (sw - dw) / 2
    const oy = 0
    const nodes = {
      pick: el.querySelector('[data-pick-open]'),
      settings: el.querySelector('[data-settings]'),
      pause: el.querySelector('[data-pause]'),
    }
    for (const [key, box] of Object.entries(HIT)) {
      const n = nodes[key]
      if (!n) continue
      n.style.left = `${ox + dw * box[0]}px`
      n.style.top = `${oy + dh * box[1]}px`
      n.style.width = `${dw * box[2]}px`
      n.style.height = `${dh * box[3]}px`
    }

    const bulb = Math.max(5, Math.min(11, dw * 0.0096))
    for (let i = 0; i < marqueeBulbs.length; i++) {
      const [x, y] = MARQUEE_PTS[i]
      const node = marqueeBulbs[i]
      node.style.left = `${ox + dw * x}px`
      node.style.top = `${oy + dh * y}px`
      node.style.width = `${bulb}px`
      node.style.height = `${bulb}px`
    }

    const pick = HIT.pick
    const belowPick = oy + dh * (pick[1] + pick[3]) + Math.max(8, dh * 0.012)
    const stack = el.querySelector('[data-play-stack]')
    if (stack) stack.style.top = `${belowPick}px`
    const wind = el.querySelector('[data-wind-card]')
    if (wind) wind.style.top = `${belowPick}px`
    const coins = el.querySelector('[data-coins-bar]')
    if (coins && rail) {
      rail.style.top = `${coins.offsetTop + coins.offsetHeight + 8}px`
      rail.style.left = `${Math.max(6, coins.offsetLeft)}px`
    }
  }

  return {
    el,
    paint,
    showResult,
    showEndlessResult,
    showShop,
    hideShop,
    showBoard,
    hideResult,
    showCatchPop,
    hideCatchPop,
    addCatch,
    clearCatches,
    toggleLevels,
    toggleSettings,
    layoutHits,
    unlocked,
    muteBtn: el.querySelector('[data-mute]'),
    muteFab: el.querySelector('[data-mute-fab]'),
    pauseBtn: el.querySelector('[data-pause]'),
    resumeBtn: el.querySelector('[data-resume]'),
    pausedEl: el.querySelector('[data-paused]'),
    rotateEl: el.querySelector('[data-rotate]'),
    picks,
    diffs: el.querySelector('[data-diff]'),
    settingsBtn: el.querySelector('[data-settings]'),
    coinPlus: el.querySelector('[data-coin-plus]'),
    modeStory: el.querySelector('[data-mode="story"]'),
    modeEndless: el.querySelector('[data-mode="endless"]'),
    pickOpen: el.querySelector('[data-pick-open]'),
    boardBtn: el.querySelector('[data-board]'),
    home: el.querySelector('[data-home]'),
    saveMute: SAVE_MUTE,
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function trophyMarkup(kind) {
  const crown = kind === 'boss'
    ? '<path class="crown" d="M18 11 L22 2 L28 8 L32 1 L36 8 L42 2 L46 11 Z"/>'
    : ''
  return `
    <i class="gh-trophy-twine"></i>
    <span class="gh-trophy-bob">
      <svg viewBox="0 0 64 88" aria-hidden="true">
        ${crown}
        <ellipse class="ring-back" cx="32" cy="30" rx="16" ry="6.5"/>
        <ellipse class="ring" cx="32" cy="30" rx="16" ry="6.5"/>
        <ellipse class="body" cx="32" cy="62" rx="18" ry="15"/>
        <path class="neck" d="M32 48 C29 40 28 34 32 22"/>
        <circle class="head" cx="32" cy="16" r="9"/>
        <path class="beak" d="M26 18 L38 18 L32 26 Z"/>
        <circle class="eye l" cx="28.2" cy="14" r="1.5"/>
        <circle class="eye r" cx="35.8" cy="14" r="1.5"/>
      </svg>
    </span>`
}

function icon(kind) {
  if (kind === 'pause') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
  if (kind === 'gear') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>'
  if (kind === 'audioOff') return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>'
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/></svg>'
}
