import { FISH, TANKS, LIGHTS, SHOP_PACKS, SAVE_KEY, RARITIES, aquariumLevel, xpIntoLevel, fishById, rarityOf, isCrustacean, uid } from './data.js'
import { loadState, persistState, resetState, snapshotState, sanitize, setSkipCloud, setSkipSave } from './save.js'
import {
  tankRate,
  fishYield,
  applySeconds,
  settleOffline,
  canFeed,
  doFeed,
  feedRemain,
  cooldownRemain,
  buyFryPack,
  buyTank,
  buyLight,
  boxFish,
  releaseBoxed,
  placeStock,
  collectBubble,
  spawnBubble,
  pruneBubbles,
  refreshHappy,
  shortGoal,
  tankCap,
  uniqueTags,
  isSated,
  tickHatch,
  tickChests,
  openChest,
  tickGrowth,
} from './sim.js'
import { createWorld } from './world.js'
import { createTankAudio } from './audio.js'
import { createTankAuth } from './auth.js'
import { g, fishName, tagText, tankName, lightName, packName, rarityName, packOddsLine, formatDuration, lifeText } from './i18n.js'
import { growthOf, GROW_LARGE_MS, newLookSeed, ensureFishIdentity } from './look.js'
import { getLocale, localizedHref, onLocaleChange, t } from '../i18n'
import { mountLanguageSwitcher } from '../i18n/switcher'
import { createTour } from './tour.js'

const TANK_LOCALES = ['zh-CN', 'en', 'ja', 'ko']
const SHOP_PANELS = new Set(['shopFish', 'shopTank', 'shopLight'])
const EDIT_PANELS = new Set(['editTank', 'editLight', 'editBox'])
const MINI_NAME = 'jiumao-tank'
const MINI_BUS = 'jiumao-idle-tank'
const MINI_DOCK_ASPECT = 170 / 1004
const MINI_GLASS_ASPECT = 1.32
const LEADER_KEY = 'jiumao-idle-tank-leader'
const LEADER_STALE_MS = 3500
const INSTANCE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function isMiniMode() {
  return new URLSearchParams(location.search).get('mini') === '1'
}

function miniHref() {
  const url = new URL(location.href)
  url.searchParams.set('mini', '1')
  return url.toString()
}

function dockArtLocale(loc = getLocale()) {
  if (loc === 'en' || loc === 'ja' || loc === 'ko') return loc
  if (String(loc).startsWith('zh')) return 'zh-CN'
  return 'en'
}

function fmt(n) {
  const x = Number(n) || 0
  if (Math.abs(x) >= 1000) return `${Math.floor(x).toLocaleString()}`
  if (Math.abs(x) < 0.1) return x.toFixed(3)
  if (Math.abs(x) < 10) return x.toFixed(2)
  return String(Math.round(x))
}

function el(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

function wipeLocalProgress() {
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem('jiumao-idle-tank-tour')
    localStorage.removeItem('jiumao-idle-tank-leader')
  } catch { /* ignore */ }
}

function loadCrawlerDemo() {
  const now = Date.now()
  const xs = [0.22, 0.5, 0.78]
  return {
    ...loadState(),
    guide: false,
    chest: null,
    fish: xs.map((x, i) => ensureFishIdentity({
      id: uid('crawler'),
      species: 'goby',
      x,
      y: 0.84,
      vx: i === 1 ? 0.018 : i === 0 ? 0.02 : -0.02,
      vy: 0,
      mystery: false,
      quality: 'fine',
      bornAt: now - GROW_LARGE_MS,
      growBonusMs: 0,
      grownMs: GROW_LARGE_MS,
      lookSeed: newLookSeed(),
      entering: false,
      satedUntil: now + 60 * 60 * 1000,
      nextBubble: now + 40000,
      happyUntil: now + 60000,
      _crawlerDemo: true,
      demoHopAt: 1.8 + i * 4.2,
    }, i)),
  }
}

export async function startTank(mount) {
  const url = new URL(location.href)
  const crawlerDemo = url.searchParams.get('crawler') === '1'
  const fresh = url.searchParams.get('fresh') === '1'
  const grantCoins = Math.floor(Number(url.searchParams.get('coins')))
  if (fresh) {
    wipeLocalProgress()
    url.searchParams.delete('fresh')
    setSkipCloud(true)
  }
  if (crawlerDemo) {
    setSkipCloud(true)
    setSkipSave(true)
  }
  if (Number.isFinite(grantCoins) && grantCoins > 0) url.searchParams.delete('coins')
  if (fresh || (Number.isFinite(grantCoins) && grantCoins > 0)) {
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }
  const homeHref = localizedHref('/')
  const homeLabel = t('common.backHome')
  const audio = createTankAudio()
  let state = crawlerDemo ? loadCrawlerDemo() : loadState()
  if (Number.isFinite(grantCoins) && grantCoins > 0) {
    state.coins = Math.max(state.coins, grantCoins)
    persistState(state)
  }
  let displayed = state.coins
  let hudSig = ''
  let panel = null
  let tagTimer = 0
  let lastTick = performance.now()
  let acc = 0
  let saveAcc = 0
  let shakeId = ''
  let offline = null
  refreshHappy(state)

  const shell = el(`
    <section class="tank-shell">
      <header class="tank-hud">
        <a class="home-link" href="${homeHref}" aria-label="${homeLabel}" title="${homeLabel}">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.6 11.2 12 4.8l7.4 6.4"/>
            <path d="M6.4 10.6V19a1.2 1.2 0 0 0 1.2 1.2h3.2v-5h2.4v5h3.2A1.2 1.2 0 0 0 17.6 19v-8.4"/>
          </svg>
          <span>${homeLabel}</span>
        </a>
        <div class="hud-mid">
          <div class="lv-block">
            <div class="lv-row">
              <span data-lv></span>
              <span class="goal" data-goal></span>
            </div>
            <div class="xp"><i data-xp></i></div>
          </div>
        </div>
        <div class="wallet" data-wallet>
          <span class="shell-mark">🪙</span>
          <strong data-coins>0</strong>
          <small data-rate></small>
        </div>
        <div class="hud-end">
          <div id="lang-switch"></div>
          <button type="button" class="text-btn" data-popout>${g('popout')}</button>
          <button type="button" class="icon-btn" data-music aria-label="${g('musicOn')}"></button>
          <button type="button" class="icon-btn" data-mute aria-label="${g('mute')}"></button>
          <button type="button" class="icon-btn" data-manual aria-label="${g('manual')}">?</button>
          <button type="button" class="icon-btn" data-account aria-label="${g('guestAccount')}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <g class="icon-guest" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="3.15"/>
                <path d="M5.6 19.2c.7-3.5 3.2-5.3 6.4-5.3s5.7 1.8 6.4 5.3"/>
              </g>
              <g class="icon-signed" fill="currentColor">
                <circle cx="12" cy="8" r="3.3"/>
                <path d="M5.4 19.4c.4-3.8 3.3-5.7 6.6-5.7s6.2 1.9 6.6 5.7C16.8 20.6 7.2 20.6 5.4 19.4Z"/>
              </g>
            </svg>
          </button>
          <button type="button" class="icon-btn" data-settings aria-label="${g('settings')}">⚙</button>
        </div>
      </header>
      <div class="tank-stage">
        <div class="cabinet">
          <div class="glass">
            <canvas data-canvas></canvas>
            <div class="fish-tag" data-tag hidden></div>
            <div class="toast" data-toast hidden></div>
          </div>
          <footer class="dock" data-dock>
            <button type="button" class="dock-slot is-feed" data-feed aria-label="${g('feed')}">
              <small data-feed-cd></small>
            </button>
            <button type="button" class="dock-slot is-shop" data-open="shopFish" aria-label="${g('shop')}"></button>
            <button type="button" class="dock-slot is-tank" data-open="editTank" aria-label="${g('tankShop')}"></button>
            <button type="button" class="dock-slot is-album" data-open="album" aria-label="${g('album')}"></button>
          </footer>
        </div>
        <div class="fly-layer" data-fly></div>
      </div>
      <div class="panel" data-panel hidden></div>
      <div class="pack-reveal" data-reveal hidden>
        <div class="pack-reveal-vignette"></div>
        <div class="pack-reveal-bloom"></div>
        <div class="pack-reveal-ring"></div>
        <div class="pack-reveal-ring is-late"></div>
        <div class="pack-reveal-beam"></div>
        <div class="pack-reveal-beam is-alt"></div>
        <div class="pack-reveal-sparks" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
          <i></i><i></i><i></i><i></i>
        </div>
        <div class="pack-reveal-bag" data-reveal-open><img data-reveal-bag alt=""></div>
        <p data-reveal-wait></p>
        <div class="pack-got" data-reveal-got hidden>
          <p class="pack-got-kicker" data-got-kicker></p>
          <div class="pack-got-stars" data-got-stars></div>
          <img class="pack-got-art" data-got-img alt="">
          <h2 data-got-name></h2>
          <p class="pack-got-sub" data-got-sub></p>
          <div class="pack-got-actions" data-got-actions hidden>
            <button type="button" class="primary" data-got-tank></button>
            <button type="button" class="ghost" data-got-stock></button>
          </div>
          <button type="button" class="primary" data-got-ok></button>
        </div>
      </div>
      <div class="modal" data-modal hidden></div>
      <div class="park-mask" data-park hidden>
        <div class="park-card">
          <h2 data-park-title></h2>
          <p data-park-body></p>
          <button type="button" class="primary" data-park-focus></button>
        </div>
      </div>
    </section>
  `)
  mount.replaceChildren(shell)
  mountLanguageSwitcher(document.getElementById('lang-switch'), { locales: TANK_LOCALES })
  const mini = isMiniMode()
  document.body.classList.toggle('is-mini', mini)
  if (mini) document.title = g('tankShop')

  const canvas = shell.querySelector('[data-canvas]')
  const world = createWorld(canvas)
  const stageEl = shell.querySelector('.tank-stage')
  const cabinetEl = shell.querySelector('.cabinet')

  function layoutMini() {
    if (!mini || !stageEl || !cabinetEl) return
    const stageW = stageEl.clientWidth
    const stageH = stageEl.clientHeight
    if (stageW < 8 || stageH < 8) return
    const unit = 1 / MINI_GLASS_ASPECT + MINI_DOCK_ASPECT
    let width = stageW
    let height = width * unit
    if (height > stageH) {
      height = stageH
      width = height / unit
    }
    cabinetEl.style.width = `${Math.max(1, Math.floor(width))}px`
    cabinetEl.style.height = `${Math.max(1, Math.floor(height))}px`
    cabinetEl.style.setProperty('--dock-h', `${Math.max(1, Math.round(width * MINI_DOCK_ASPECT))}px`)
  }

  await world.warm(state)
  layoutMini()
  world.resize()
  world.prefetch(state)
  if (crawlerDemo) {
    state.feedUntil = 0
    state.feedReadyAt = 0
    if (doFeed(state)) world.spawnPellets()
  }

  const coinsEl = shell.querySelector('[data-coins]')
  const rateEl = shell.querySelector('[data-rate]')
  const lvEl = shell.querySelector('[data-lv]')
  const xpEl = shell.querySelector('[data-xp]')
  const goalEl = shell.querySelector('[data-goal]')
  const dockEl = shell.querySelector('[data-dock]')
  const feedBtn = shell.querySelector('[data-feed]')
  const shopBtn = shell.querySelector('[data-open="shopFish"]')
  const tankBtn = shell.querySelector('[data-open="editTank"]')
  const albumBtn = shell.querySelector('[data-open="album"]')
  const feedCd = shell.querySelector('[data-feed-cd]')
  const muteBtn = shell.querySelector('[data-mute]')
  const musicBtn = shell.querySelector('[data-music]')
  const panelEl = shell.querySelector('[data-panel]')
  const modalEl = shell.querySelector('[data-modal]')
  const tagEl = shell.querySelector('[data-tag]')
  const toastEl = shell.querySelector('[data-toast]')
  const flyEl = shell.querySelector('[data-fly]')
  const walletEl = shell.querySelector('[data-wallet]')
  const parkEl = shell.querySelector('[data-park]')
  const parkTitleEl = shell.querySelector('[data-park-title]')
  const parkBodyEl = shell.querySelector('[data-park-body]')
  const parkFocusBtn = shell.querySelector('[data-park-focus]')
  const revealEl = shell.querySelector('[data-reveal]')
  const revealBag = shell.querySelector('[data-reveal-bag]')
  const revealWait = shell.querySelector('[data-reveal-wait]')
  const gotEl = shell.querySelector('[data-reveal-got]')
  const gotImg = shell.querySelector('[data-got-img]')
  const gotName = shell.querySelector('[data-got-name]')
  const gotSub = shell.querySelector('[data-got-sub]')
  const gotKicker = shell.querySelector('[data-got-kicker]')
  const gotStars = shell.querySelector('[data-got-stars]')
  const gotOk = shell.querySelector('[data-got-ok]')
  const gotActions = shell.querySelector('[data-got-actions]')
  let revealBusy = false
  let revealTimer = 0
  const revealQueue = []
  let parked = false
  let everLed = false
  let bus = null
  try { bus = new BroadcastChannel(MINI_BUS) } catch { /* ignore */ }
  const tour = createTour({
    root: shell,
    g,
    skip: () => mini || parked,
    onLock() {
      closePanel()
      closeModal()
      if (tagEl) tagEl.hidden = true
    },
  })

  function toast(msg, ms = 1800) {
    toastEl.hidden = false
    toastEl.textContent = msg
    clearTimeout(toastEl._t)
    toastEl._t = setTimeout(() => { toastEl.hidden = true }, ms)
  }

  function playPackOpen(quality, after, extra = {}) {
    const q = RARITIES.includes(quality) ? quality : 'common'
    if (revealBusy) {
      revealQueue.push(() => playPackOpen(q, after, extra))
      return
    }
    revealBusy = true
    const big = q === 'legend' || q === 'myth'
    const epic = q === 'epic'
    const bagBtn = revealEl.querySelector('[data-reveal-open]')
    revealEl.className = `pack-reveal q-${q} is-wait`
    if (revealBag) revealBag.src = `/tank/packs/${q}.png`
    if (revealWait) revealWait.textContent = g('packTap')
    if (gotEl) gotEl.hidden = true
    revealEl.hidden = false
    syncCovered()
    const finish = () => {
      window.clearTimeout(revealTimer)
      revealEl.onclick = null
      if (bagBtn) bagBtn.onclick = null
      if (gotOk) gotOk.onclick = null
      revealEl.classList.remove('is-play', 'is-wait', 'is-got')
      if (gotEl) gotEl.hidden = true
      if (gotActions) gotActions.hidden = true
      revealEl.hidden = true
      revealBusy = false
      syncCovered()
      try { after?.() } catch { /* ignore */ }
      const next = revealQueue.shift()
      if (next) next()
    }
    const showGot = () => {
      window.clearTimeout(revealTimer)
      revealEl.onclick = null
      revealEl.classList.remove('is-play', 'is-wait')
      revealEl.classList.add('is-got')
      if (gotEl) gotEl.hidden = false
      if (gotActions) gotActions.hidden = true
      if (gotKicker) gotKicker.textContent = g('packGot')
      if (gotName) gotName.textContent = packName(q)
      if (gotSub) gotSub.textContent = extra.sub || g('packGotMystery')
      if (gotImg) gotImg.src = `/tank/packs/${q}.png`
      if (gotStars) {
        const n = Math.max(1, RARITIES.indexOf(q) + 1)
        gotStars.textContent = '★'.repeat(n)
      }
      if (gotOk) {
        gotOk.hidden = false
        gotOk.textContent = g('packGotOk')
        gotOk.onclick = (e) => {
          e.stopPropagation()
          finish()
        }
      }
      try { audio.stamp() } catch { /* ignore */ }
    }
    const beginOpen = () => {
      if (!revealEl.classList.contains('is-wait')) return
      revealEl.classList.remove('is-wait')
      void revealEl.offsetWidth
      revealEl.classList.add('is-play')
      if (revealWait) revealWait.textContent = g('packReveal')
      try { audio.reveal(q) } catch { /* ignore */ }
      const ms = big ? 4200 : epic ? 3400 : 3000
      revealTimer = window.setTimeout(showGot, ms)
    }
    if (bagBtn) bagBtn.onclick = (e) => {
      e.stopPropagation()
      beginOpen()
    }
    revealEl.onclick = null
  }

  function flashWallet() {
    walletEl.classList.remove('flash')
    void walletEl.offsetWidth
    walletEl.classList.add('flash')
  }

  function flyCoin(from, amount) {
    const start = from || canvas.getBoundingClientRect()
    const end = coinsEl.getBoundingClientRect()
    const node = document.createElement('div')
    node.className = 'fly-num'
    node.textContent = `+${fmt(amount)}`
    node.style.left = `${start.left + start.width / 2}px`
    node.style.top = `${start.top}px`
    flyEl.append(node)
    requestAnimationFrame(() => {
      node.style.transform = `translate(${end.left - start.left}px, ${end.top - start.top}px) scale(.6)`
      node.style.opacity = '0'
    })
    setTimeout(() => node.remove(), 700)
    flashWallet()
  }

  function applyDock() {
    const loc = dockArtLocale()
    dockEl.style.backgroundImage = `url('/tank/ui/dock-${loc}.png')`
    feedBtn.setAttribute('aria-label', g('feed'))
    shopBtn.setAttribute('aria-label', g('shop'))
    tankBtn.setAttribute('aria-label', g('tankShop'))
    albumBtn.setAttribute('aria-label', g('album'))
  }

  function renderMute() {
    muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊'
    muteBtn.setAttribute('aria-label', audio.isMuted() ? g('unmute') : g('mute'))
    musicBtn.textContent = '🎵'
    musicBtn.setAttribute('aria-label', audio.isMusicOn() ? g('musicOn') : g('musicOff'))
    musicBtn.classList.toggle('is-off', !audio.isMusicOn())
    const sm = panelEl.querySelector('[data-settings-music]')
    const sz = panelEl.querySelector('[data-settings-mute]')
    if (sm) sm.textContent = audio.isMusicOn() ? g('musicOn') : g('musicOff')
    if (sz) sz.textContent = audio.isMuted() ? g('unmute') : g('mute')
  }

  function renderHud() {
    const now = Date.now()
    const coins = fmt(displayed)
    const rate = `${fmt(tankRate(state))} ${g('perSec')}`
    const xp = xpIntoLevel(state.xp)
    const lv = g('lv', { n: xp.lv }) + (state.starTide ? ` · ${g('starTide')}` : '')
    const xpW = `${Math.round(xp.t * 100)}%`
    const goal = shortGoal(state)
    const goalText = g(`goal_${goal.id}`, { have: goal.have })
    let feedMode = 'ready'
    let feedText = ''
    if (now < state.feedUntil) {
      feedMode = 'on'
      feedText = g('feeding', { n: feedRemain(state, now) })
    } else if (!canFeed(state, now)) {
      feedMode = 'cd'
      feedText = g('cooldown', { n: cooldownRemain(state, now) })
    } else if (state.guide) feedMode = 'pulse'
    const sig = `${coins}|${rate}|${lv}|${xpW}|${goalText}|${feedMode}|${feedText}`
    if (sig === hudSig) return
    hudSig = sig
    coinsEl.textContent = coins
    rateEl.textContent = rate
    lvEl.textContent = lv
    xpEl.style.width = xpW
    goalEl.textContent = goalText
    feedBtn.classList.toggle('is-on', feedMode === 'on')
    feedBtn.classList.toggle('is-pulse', feedMode === 'pulse')
    feedCd.textContent = feedText
  }

  function closePanel() {
    panel = null
    panelEl.hidden = true
    panelEl.innerHTML = ''
    syncCovered()
  }

  function closeModal() {
    modalEl.hidden = true
    modalEl.innerHTML = ''
    syncCovered()
  }

  function syncCovered() {
    const busy = !modalEl.hidden || !revealEl.hidden
    world.setCovered(busy)
  }

  let pendingBuyRec = null

  function openSealedFry(rec) {
    if (!rec) return
    if (state.fish.length >= tankCap(state).fish) {
      toast(g('fullHint'))
      return
    }
    const quality = rec.quality || 'common'
    closePanel()
    playPackOpen(quality, () => {
      const i = state.pack.indexOf(rec)
      const result = placeStock(state, i)
      if (!result.ok) { toast(g('fullHint')); return }
      if (result.fish?.species) void world.ensureFish(result.fish.species)
      persistState(state)
      renderHud()
      world.setIntro(result.fish)
    }, { sub: g('packGotTank') })
  }

  function showBuyGot(id, rec) {
    const q = RARITIES.includes(id) ? id : 'common'
    pendingBuyRec = rec || null
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card buy-card q-${q}">
        <img class="buy-icon" src="/tank/packs/${q}.png" alt="">
        <h2>${g('buyGot')}</h2>
        <p class="buy-name">${packName(q)}</p>
        <div class="buy-actions">
          <button type="button" class="primary" data-buy-open>${g('buyOpenFry')}</button>
          <button type="button" class="ghost" data-buy-stock>${g('packGotStockBtn')}</button>
        </div>
      </div>`
    syncCovered()
  }

  function cardShortage(id, need) {
    shakeId = id
    toast(g('short', { n: fmt(Math.ceil(need)) }))
    setTimeout(() => { if (shakeId === id) shakeId = '' }, 500)
    if (panel) openPanel(panel)
  }

  function packCard(spec) {
    const locked = aquariumLevel(state.xp) < spec.unlock
    const short = state.coins < spec.price
    return `
      <article class="shop-card pack q-${spec.id}${shakeId === spec.id ? ' shake short' : ''}${locked ? ' locked' : ''}" data-buy-pack="${spec.id}">
        <span class="pack-icon"><img src="${spec.icon}" alt=""></span>
        <div>
          <h3>${packName(spec.id)}</h3>
          <p class="odds r-${spec.id}">${packOddsLine(spec)}</p>
          <p>${g(`packHint_${spec.id}`)}</p>
          <p>${g('packLuck')}</p>
          ${locked ? `<p class="warn">${g('locked', { n: spec.unlock })}</p>` : ''}
        </div>
        <button type="button" ${locked ? 'disabled' : ''} class="${short && !locked ? 'dear' : ''}">${g('buyFry')} ${fmt(spec.price)}</button>
      </article>`
  }

  function stockCards() {
    const pack = state.pack || []
    if (!pack.length) {
      return `<p>${g('stockEmpty')}</p><p><button type="button" class="ghost" data-go-shop="shopFish">${g('goShop')}</button></p>`
    }
    return pack.map((rec, i) => {
      const quality = rec.quality || 'common'
      return `
        <article class="shop-card" data-place-stock="${i}">
          <span class="fry-mark r-${quality}">苗</span>
          <div><h3>${g('mysteryFry')}</h3><p>${packName(quality)} · ${g('stockKeep')}</p></div>
          <button type="button">${g('stockPlace')}</button>
        </article>`
    }).join('')
  }

  function boxedCards() {
    if (!state.boxed.length) return `<p>${g('boxedEmpty')}</p>`
    return state.boxed.map((rec, i) => {
      const species = typeof rec === 'string' ? rec : rec.species
      const mystery = typeof rec === 'object' && rec.mystery
      const quality = typeof rec === 'object' ? rec.quality || 'common' : 'common'
      const rarity = rarityOf(species)
      return `
        <article class="shop-card" data-release="${i}">
          ${mystery
            ? `<span class="fry-mark r-${quality}">苗</span>`
            : `<span class="shop-thumb"><img src="${fishById(species)?.src || ''}" alt=""></span>`}
          <div><h3>${mystery ? g('mysteryFry') : fishName(species)}</h3><p>${mystery ? packName(quality) : rarityName(rarity)} · ${g('boxedKeep')}</p></div>
          <button type="button">${g('release')}</button>
        </article>`
    }).join('')
  }

  function shopLightCard(spec) {
    const locked = aquariumLevel(state.xp) < spec.unlock
    const short = state.coins < spec.price
    return `
      <article class="shop-card light${shakeId === `light-${spec.id}` ? ' shake short' : ''}${locked ? ' locked' : ''}" data-buy-light="${spec.id}">
        <span class="light-swatch" style="background:${spec.preview}"></span>
        <div>
          <h3>${lightName(spec.id)}</h3>
          <p>${g(`lightHint_${spec.id}`)}</p>
          ${locked ? `<p class="warn">${g('locked', { n: spec.unlock })}</p>` : ''}
        </div>
        <button type="button" ${locked ? 'disabled' : ''} class="${short && !locked ? 'dear' : ''}">${g('buy')} ${fmt(spec.price)}</button>
      </article>`
  }

  function shopTankCard(spec) {
    const locked = aquariumLevel(state.xp) < spec.unlock
    const short = state.coins < spec.price
    const tags = (spec.tags || []).map((tag) => tagText(tag)).join(' · ')
    return `
      <article class="shop-card scene${shakeId === `tank-${spec.id}` ? ' shake short' : ''}${locked ? ' locked' : ''}" data-buy-tank="${spec.id}">
        <img src="${spec.cover || spec.bg}" alt="">
        <div>
          <h3>${tankName(spec.id)}</h3>
          <p>${g('tankCap', { n: spec.fish })}</p>
          <p>${g('tankScene', { tags })}</p>
          ${locked ? `<p class="warn">${g('locked', { n: spec.unlock })}</p>` : ''}
        </div>
        <button type="button" ${locked ? 'disabled' : ''} class="${short && !locked ? 'dear' : ''}">${g('buy')} ${fmt(spec.price)}</button>
      </article>`
  }

  function editLightCard(spec) {
    const using = state.light === spec.id
    const action = using
      ? `<button type="button" disabled>${g('lightUsing')}</button>`
      : `<button type="button">${g('lightSwitch')}</button>`
    return `
      <article class="shop-card light" data-use-light="${spec.id}">
        <span class="light-swatch" style="background:${spec.preview}"></span>
        <div>
          <h3>${lightName(spec.id)}</h3>
          <p>${g(`lightHint_${spec.id}`)}</p>
        </div>
        ${action}
      </article>`
  }

  function editTankCard(spec) {
    const using = state.tank === spec.id
    const tags = (spec.tags || []).map((tag) => tagText(tag)).join(' · ')
    const action = using
      ? `<button type="button" disabled>${g('tankUsing')}</button>`
      : `<button type="button">${g('tankSwitch')}</button>`
    return `
      <article class="shop-card scene" data-use-tank="${spec.id}">
        <img src="${spec.cover || spec.bg}" alt="">
        <div>
          <h3>${tankName(spec.id)}</h3>
          <p>${g('tankCap', { n: spec.fish })}</p>
          <p>${g('tankScene', { tags })}</p>
        </div>
        ${action}
      </article>`
  }

  function openPanel(kind) {
    if (tour.isOn()) return
    if (kind === 'fish') kind = 'shopFish'
    if (kind === 'tank') kind = 'editTank'
    if (kind === 'light') kind = 'editLight'
    if (kind === 'box') kind = 'editBox'
    panel = kind
    panelEl.hidden = false
    if (SHOP_PANELS.has(kind)) {
      const forSaleTanks = TANKS
        .filter((spec) => !(state.ownedTanks || [0]).includes(spec.id))
        .slice()
        .sort((a, b) => a.price - b.price || a.id - b.id)
      const forSaleLights = LIGHTS.filter((spec) => !(state.ownedLights || []).includes(spec.id))
      panelEl.innerHTML = `
        <div class="panel-inner">
          <header>
            <nav>
              <button type="button" data-tab="shopFish" class="${kind === 'shopFish' ? 'on' : ''}">${g('tabFish')}</button>
              <button type="button" data-tab="shopTank" class="${kind === 'shopTank' ? 'on' : ''}">${g('tabTank')}</button>
              <button type="button" data-tab="shopLight" class="${kind === 'shopLight' ? 'on' : ''}">${g('tabLight')}</button>
            </nav>
            <button type="button" class="icon-btn close-btn" data-close aria-label="${g('close')}">×</button>
          </header>
          <div class="panel-body">
            ${kind === 'shopFish' ? SHOP_PACKS.map(packCard).join('') : ''}
            ${kind === 'shopTank' ? (
              forSaleTanks.length
                ? forSaleTanks.map(shopTankCard).join('')
                : `<p>${g('shopEmptyTank')}</p><p><button type="button" class="ghost" data-go-edit="editTank">${g('goEdit')}</button></p>`
            ) : ''}
            ${kind === 'shopLight' ? (
              forSaleLights.length
                ? forSaleLights.map(shopLightCard).join('')
                : `<p>${g('shopEmptyLight')}</p><p><button type="button" class="ghost" data-go-edit="editLight">${g('goEdit')}</button></p>`
            ) : ''}
          </div>
        </div>`
    } else if (EDIT_PANELS.has(kind)) {
      const cap = tankCap(state)
      const ownedTanks = TANKS.filter((spec) => (state.ownedTanks || [0]).includes(spec.id))
      const ownedLights = LIGHTS.filter((spec) => (state.ownedLights || []).includes(spec.id))
      panelEl.innerHTML = `
        <div class="panel-inner">
          <header>
            <nav>
              <button type="button" data-tab="editTank" class="${kind === 'editTank' ? 'on' : ''}">${g('tabTank')}</button>
              <button type="button" data-tab="editLight" class="${kind === 'editLight' ? 'on' : ''}">${g('tabLight')}</button>
              <button type="button" data-tab="editBox" class="${kind === 'editBox' ? 'on' : ''}">${g('tabBox')}</button>
            </nav>
            <button type="button" class="icon-btn close-btn" data-close aria-label="${g('close')}">×</button>
          </header>
          <div class="panel-body">
            ${kind === 'editTank' ? `
              ${ownedTanks.map(editTankCard).join('')}
              ${state.fish.length >= cap.fish ? `<p class="warn">${g('fullHint')}</p>` : ''}
            ` : ''}
            ${kind === 'editLight' ? `
              ${state.light ? `<p><button type="button" class="ghost" data-light-off>${g('lightOff')}</button></p>` : ''}
              ${ownedLights.length
                ? ownedLights.map(editLightCard).join('')
                : `<p>${g('editEmptyLight')}</p><p><button type="button" class="ghost" data-go-shop="shopLight">${g('goShop')}</button></p>`}
            ` : ''}
            ${kind === 'editBox' ? `
              <p class="stock-head">${g('stockLead')}</p>
              ${stockCards()}
              <p class="stock-head">${g('boxedLead')}</p>
              ${boxedCards()}
            ` : ''}
          </div>
        </div>`
    } else if (kind === 'album') {
      panelEl.innerHTML = `
        <div class="panel-inner">
          <header>
            <h2>${g('album')}</h2>
            <button type="button" class="icon-btn close-btn" data-close aria-label="${g('close')}">×</button>
          </header>
          <div class="panel-body album">
            <div class="album-grid">
              ${FISH.map((f) => {
                const have = state.albumFish.includes(f.id)
                const rarity = rarityOf(f)
                return `<figure class="${have ? 'have' : 'miss'} r-${rarity}"><img src="${f.src}" alt=""><figcaption>${have ? fishName(f.id) : g('unknown')}<em>${rarityName(rarity)}${isCrustacean(f) ? ` · ${g('life_1')}` : ''}</em></figcaption>${have ? `<b>${g('stamped')}</b>` : ''}</figure>`
              }).join('')}
            </div>
            <div class="album-grid scenes">
              ${TANKS.map((tank) => {
                const have = (state.albumTanks || []).includes(tank.id)
                return `<figure class="${have ? 'have' : 'miss'}"><img src="${tank.cover || tank.bg}" alt=""><figcaption>${have ? tankName(tank.id) : g('unknown')}</figcaption></figure>`
              }).join('')}
            </div>
          </div>
        </div>`
    } else if (kind === 'manual') {
      const secs = [
        ['manual_what', 'manual_what_p'],
        ['manual_coins', 'manual_coins_p'],
        ['manual_feed', 'manual_feed_p'],
        ['manual_crawler', 'manual_crawler_p'],
        ['manual_fry', 'manual_fry_p'],
        ['manual_home', 'manual_home_p'],
        ['manual_chest', 'manual_chest_p'],
        ['manual_album', 'manual_album_p'],
        ['manual_dock', 'manual_dock_p'],
      ]
      panelEl.innerHTML = `
        <div class="panel-inner">
          <header>
            <h2>${g('manual')}</h2>
            <button type="button" class="icon-btn close-btn" data-close aria-label="${g('close')}">×</button>
          </header>
          <div class="panel-body manual">
            <p class="manual-lead">${g('manualLead')}</p>
            ${secs.map(([h, p]) => `<section class="manual-sec"><h3>${g(h)}</h3><p>${g(p)}</p></section>`).join('')}
          </div>
        </div>`
    } else if (kind === 'settings') {
      panelEl.innerHTML = `
        <div class="panel-inner">
          <header>
            <h2>${g('settings')}</h2>
            <button type="button" class="icon-btn close-btn" data-close aria-label="${g('close')}">×</button>
          </header>
          <div class="panel-body">
            ${mini ? `<div id="settings-lang"></div>
            <button type="button" class="ghost" data-settings-music></button>
            <button type="button" class="ghost" data-settings-mute></button>
            <button type="button" class="ghost" data-settings-account>${g('guestAccount')}</button>` : `<button type="button" class="ghost" data-do-popout>${g('popout')}</button>
            <p class="manual-lead">${g('popoutHint')}</p>`}
            <button type="button" class="ghost" data-replay-tour>${g('tourReplay')}</button>
            <button type="button" class="ghost" data-open-manual>${g('manual')}</button>
            <button type="button" class="danger" data-reset>${g('reset')}</button>
          </div>
        </div>`
      if (mini) {
        const host = panelEl.querySelector('#settings-lang')
        if (host) mountLanguageSwitcher(host, { locales: TANK_LOCALES })
        renderMute()
      }
    }
    syncCovered()
  }

  function showOffline() {
    if (!offline) return
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card">
        <h2>${g('offlineTitle')}</h2>
        <p>${g('offlineTime', { time: formatDuration(offline.ms) })}</p>
        <p class="gain">${g('offlineGain', { n: fmt(offline.gained) })}</p>
        ${offline.top ? `<p>${g('offlineTop', { name: fishName(offline.top.species) })}</p>` : ''}
        <button type="button" class="primary" data-claim>${g('collect')}</button>
      </div>`
    syncCovered()
  }

  function confirmReset(step) {
    modalEl.hidden = false
    modalEl.innerHTML = `
      <div class="modal-card">
        <p>${g(step === 1 ? 'reset1' : 'reset2')}</p>
        <div class="row">
          <button type="button" data-cancel>${g('cancel')}</button>
          <button type="button" class="danger" data-reset-go="${step}">${g('confirm')}</button>
        </div>
      </div>`
    syncCovered()
  }

  function paintPark() {
    if (!parkEl) return
    const other = readLeader()
    const otherMini = Boolean(other?.mini) && other.id !== INSTANCE
    parkTitleEl.textContent = otherMini ? g('parkTitle') : g('dupTitle')
    parkBodyEl.textContent = otherMini ? g('parkBody') : g('dupBody')
    parkFocusBtn.textContent = g('parkFocus')
    parkFocusBtn.hidden = !otherMini
    parkEl.hidden = !parked
  }

  function adoptSave() {
    const next = loadState()
    Object.assign(state, next)
    displayed = state.coins
    acc = 0
    saveAcc = 0
    lastTick = performance.now()
    renderHud()
    void world.warm(state)
  }

  function currentPrio() {
    if (mini) return 10
    if (!document.hidden) return 5
    return 1
  }

  function readLeader() {
    try {
      const raw = localStorage.getItem(LEADER_KEY)
      if (!raw) return null
      const cur = JSON.parse(raw)
      if (!cur?.id || Date.now() - Number(cur.t) > LEADER_STALE_MS) return null
      return cur
    } catch {
      return null
    }
  }

  function writeLeader() {
    const rec = { id: INSTANCE, prio: currentPrio(), mini, t: Date.now() }
    try { localStorage.setItem(LEADER_KEY, JSON.stringify(rec)) } catch { /* ignore */ }
    postBus({ type: 'lead', ...rec })
    return rec
  }

  function releaseLeader() {
    const cur = readLeader()
    if (cur?.id !== INSTANCE) return
    try { localStorage.removeItem(LEADER_KEY) } catch { /* ignore */ }
    postBus({ type: 'bye', id: INSTANCE })
  }

  function tryClaim() {
    const prio = currentPrio()
    const cur = readLeader()
    if (!cur || cur.id === INSTANCE) {
      writeLeader()
      return true
    }
    if (prio > (Number(cur.prio) || 0)) {
      writeLeader()
      return true
    }
    return false
  }

  function setParked(on) {
    const next = Boolean(on)
    if (next === parked) {
      paintPark()
      return
    }
    if (next) {
      if (everLed && !parked) persistState(state)
      parked = true
      try { tour.stop() } catch { /* ignore */ }
      audio.setHidden(true)
    } else {
      parked = false
      adoptSave()
      const card = settleOffline(state)
      if (card) {
        offline = card
        showOffline()
      }
      if (!document.hidden) audio.setHidden(false)
      kickLoop()
    }
    paintPark()
  }

  function refreshClaim() {
    const won = tryClaim()
    if (won) everLed = true
    setParked(!won)
  }

  function openMiniWindow() {
    if (mini) return
    persistState(state)
    const features = [
      'popup=yes',
      'width=500',
      'height=560',
      'left=72',
      'top=72',
      'resizable=yes',
      'scrollbars=no',
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
    ].join(',')
    const win = window.open(miniHref(), MINI_NAME, features)
    if (!win) {
      toast(g('popoutBlocked'))
      refreshClaim()
      return
    }
    try { win.focus() } catch { /* ignore */ }
    setParked(true)
  }

  function postBus(msg) {
    try { bus?.postMessage(msg) } catch { /* ignore */ }
  }

  if (bus) {
    bus.onmessage = (ev) => {
      const msg = ev.data || {}
      if (msg.type === 'lead' && msg.id !== INSTANCE) refreshClaim()
      if (msg.type === 'bye' && msg.id !== INSTANCE) refreshClaim()
    }
  }
  window.addEventListener('storage', (ev) => {
    if (ev.key === LEADER_KEY) refreshClaim()
  })
  refreshClaim()
  window.setTimeout(() => {
    refreshClaim()
    if (!parked && !offline) {
      offline = settleOffline(state)
      showOffline()
    }
  }, 120)
  window.setInterval(() => {
    if (parked) refreshClaim()
    else writeLeader()
  }, 1000)
  paintPark()

  function afterBuy(first) {
    persistState(state)
    audio.buy()
    if (first) audio.stamp()
    renderHud()
    if (panel) openPanel(panel)
  }

  function tryBuyPack(id) {
    const result = buyFryPack(state, id)
    if (!result.ok) {
      if (result.reason === 'coins') cardShortage(id, result.need)
      else toast(g('locked', { n: result.need || 1 }))
      return
    }
    afterBuy(false)
    showBuyGot(id, result.rec)
  }

  function tryBuyLight(id) {
    const result = buyLight(state, id)
    if (!result.ok) {
      if (result.reason === 'coins') cardShortage(`light-${id}`, result.need)
      else toast(g('locked', { n: result.need || 1 }))
      return
    }
    afterBuy(false)
  }

  function tryBuyTank(id) {
    void world.ensureTank(Number(id))
    const result = buyTank(state, Number(id))
    if (!result.ok) {
      if (result.reason === 'coins') cardShortage(`tank-${id}`, result.need)
      else toast(g('locked', { n: result.need || 1 }))
      return
    }
    world.burstUpgrade()
    afterBuy(result.first)
  }

  feedBtn.addEventListener('click', () => {
    audio.unlock()
    if (!doFeed(state)) return
    world.spawnPellets()
    audio.drop()
    persistState(state)
    renderHud()
  })

  let coinTaps = 0
  let coinTapAt = 0
  walletEl.addEventListener('click', () => {
    const now = Date.now()
    coinTaps = now - coinTapAt > 2000 ? 1 : coinTaps + 1
    coinTapAt = now
    if (coinTaps < 5) return
    coinTaps = 0
    state.coins += 50000
    displayed = state.coins
    persistState(state)
    renderHud()
    flashWallet()
    toast(g('debugCoins', { n: fmt(50000) }))
  })

  shell.querySelector('[data-mute]').addEventListener('click', () => {
    audio.unlock()
    audio.setMuted(!audio.isMuted())
    renderMute()
  })
  musicBtn.addEventListener('click', () => {
    audio.unlock()
    audio.setMusic(!audio.isMusicOn())
    renderMute()
  })
  shell.querySelector('[data-popout]')?.addEventListener('click', () => openMiniWindow())
  parkFocusBtn?.addEventListener('click', () => openMiniWindow())
  shell.querySelector('[data-manual]').addEventListener('click', () => openPanel('manual'))
  shell.querySelector('[data-settings]').addEventListener('click', () => openPanel('settings'))
  shell.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openPanel(btn.dataset.open))
  })

  panelEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]')
    if (tab) { openPanel(tab.dataset.tab); return }
    if (e.target.closest('[data-close]')) { closePanel(); return }
    if (e.target.closest('[data-do-popout]')) { closePanel(); openMiniWindow(); return }
    if (e.target.closest('[data-replay-tour]')) {
      closePanel()
      try { tour.replay() } catch { /* ignore */ }
      return
    }
    if (e.target.closest('[data-settings-music]')) { musicBtn.click(); return }
    if (e.target.closest('[data-settings-mute]')) { muteBtn.click(); return }
    if (e.target.closest('[data-settings-account]')) {
      closePanel()
      shell.querySelector('[data-account]')?.click()
      return
    }
    const bf = e.target.closest('[data-buy-pack]')
    if (bf) { tryBuyPack(bf.dataset.buyPack); return }
    const bt = e.target.closest('[data-buy-tank]')
    if (bt) { tryBuyTank(bt.dataset.buyTank); return }
    const bl = e.target.closest('[data-buy-light]')
    if (bl) { tryBuyLight(bl.dataset.buyLight); return }
    if (e.target.closest('[data-light-off]')) {
      state.light = ''
      persistState(state)
      openPanel('editLight')
      return
    }
    const useTank = e.target.closest('[data-use-tank]')
    if (useTank) { tryBuyTank(useTank.dataset.useTank); return }
    const useLight = e.target.closest('[data-use-light]')
    if (useLight) { tryBuyLight(useLight.dataset.useLight); return }
    const goEdit = e.target.closest('[data-go-edit]')
    if (goEdit) { openPanel(goEdit.dataset.goEdit); return }
    const goShop = e.target.closest('[data-go-shop]')
    if (goShop) { openPanel(goShop.dataset.goShop); return }
    const place = e.target.closest('[data-place-stock]')
    if (place) {
      const rec = state.pack[Number(place.dataset.placeStock)]
      openSealedFry(rec)
      return
    }
    const rel = e.target.closest('[data-release]')
    if (rel) {
      const result = releaseBoxed(state, Number(rel.dataset.release))
      if (!result.ok) { toast(g('fullHint')); return }
      if (result.fish?.species) void world.ensureFish(result.fish.species)
      world.setIntro(result.fish)
      persistState(state)
      audio.buy()
      openPanel('editBox')
      return
    }
    if (e.target.closest('[data-open-manual]')) { openPanel('manual'); return }
    if (e.target.closest('[data-reset]')) confirmReset(1)
  })

  modalEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-claim]')) {
      offline = null
      closeModal()
      persistState(state)
      flashWallet()
      audio.pop()
      return
    }
    if (e.target.closest('[data-cancel]')) { closeModal(); return }
    if (e.target.closest('[data-buy-stock]')) {
      pendingBuyRec = null
      closeModal()
      return
    }
    if (e.target.closest('[data-buy-open]')) {
      const rec = pendingBuyRec
      if (state.fish.length >= tankCap(state).fish) {
        toast(g('fullHint'))
        return
      }
      pendingBuyRec = null
      closeModal()
      openSealedFry(rec)
      return
    }
    const go = e.target.closest('[data-reset-go]')
    if (go) {
      if (go.dataset.resetGo === '1') confirmReset(2)
      else {
        state = resetState()
        displayed = state.coins
        closeModal()
        closePanel()
        persistState(state)
        renderHud()
        welcomeGift()
      }
    }
  })

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock()
    if (world.introActive()) {
      world.skipIntro()
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = world.hit(state, x, y)
    if (!hit) {
      tagEl.hidden = true
      return
    }
    if (hit.type === 'chest') {
      const loot = openChest(state)
      if (!loot.ok) return
      audio.pop()
      world.spark(hit.chest.x, hit.chest.y)
      flyCoin({ left: e.clientX, top: e.clientY, width: 0, height: 0 }, loot.coins)
      persistState(state)
      if (loot.packId || loot.packId2) {
        const packs = [loot.packId, loot.packId2].filter(Boolean)
        const pack = packs[0]
        const pack2 = packs[1]
        const myth = packs.includes('myth')
        let key
        if (pack2) key = loot.rare ? 'chestRareDouble' : 'chestDouble'
        else if (loot.jackpot) key = loot.rare ? 'chestRareJackpotFry' : 'chestJackpotFry'
        else if (loot.rare) key = myth ? 'chestRareMyth' : 'chestRareFry'
        else key = myth ? 'chestMyth' : 'chestFry'
        toast(g(key, { n: fmt(loot.coins), pack: packName(pack), pack2: pack2 ? packName(pack2) : '' }), myth || packs.includes('legend') || loot.jackpot ? 2800 : 2200)
      } else {
        const key = loot.jackpot
          ? (loot.rare ? 'chestRareJackpot' : 'chestJackpot')
          : (loot.rare ? 'chestRareCoins' : 'chestCoins')
        toast(g(key, { n: fmt(loot.coins) }))
      }
      return
    }
    if (hit.type === 'fish') {
      if (hit.fish.bubble) {
        const value = collectBubble(state, hit.fish)
        if (value) {
          audio.pop()
          world.spark(hit.fish.x, hit.fish.y)
          flyCoin({ left: e.clientX, top: e.clientY, width: 0, height: 0 }, value)
          persistState(state)
        }
        return
      }
      const spec = fishById(hit.fish.species)
      const happy = spec && uniqueTags(state).has(spec.prefer)
      const grow = growthOf(hit.fish)
      const mystery = Boolean(hit.fish.mystery) || grow.stage === 'fry'
      const hungry = grow.stage !== 'adult' && !isSated(hit.fish)
      const growLine = grow.stage === 'adult'
        ? g('growAdult')
        : hungry
          ? g('growHungry')
          : grow.stage === 'fry'
            ? g('growMystery', { time: formatDuration(grow.remainFish) })
            : g('growYoung', { time: formatDuration(grow.remainLarge) })
      tagEl.hidden = false
      tagEl.style.left = `${e.clientX - rect.left}px`
      tagEl.style.top = `${e.clientY - rect.top}px`
      tagEl.innerHTML = `
        <strong>${mystery ? g('mysteryFry') : fishName(hit.fish.species)}</strong>
        <span class="r-${mystery ? (hit.fish.quality || 'common') : rarityOf(spec)}">${mystery ? packName(hit.fish.quality || 'common') : rarityName(rarityOf(spec))}${spec ? ` · ${lifeText(spec)}` : ''}</span>
        ${isCrustacean(spec) && !mystery ? `<span>${g('lifeHint_1')}</span>` : ''}
        <span>${growLine}</span>
        <span>${g('yieldNow', { n: fmt(fishYield(hit.fish, state)) })} · ${happy ? g('happy') : g('unhappy')}</span>
        ${state.fish.length > 1 ? `<button type="button" data-box-fish="${hit.fish.id}">${g('box')}</button>` : ''}`
      tagTimer = Date.now() + 3000
      tagEl.querySelector('[data-box-fish]')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        boxFish(state, hit.fish.id)
        tagEl.hidden = true
        persistState(state)
        toast(g('tabBox'))
      })
      return
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const hit = world.hit(state, e.clientX - rect.left, e.clientY - rect.top)
    canvas.style.cursor = (hit?.type === 'fish' && hit.fish.bubble) || hit?.type === 'chest' ? 'pointer' : ''
  })

  window.addEventListener('keydown', (e) => {
    if (tour.isOn()) return
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'f' || e.key === 'F') feedBtn.click()
    if (e.key === 'b' || e.key === 'B') openPanel('shopFish')
    if (e.key === 'd' || e.key === 'D') openPanel('editTank')
    if (e.key === 'l' || e.key === 'L') openPanel('editLight')
    if (e.key === 'c' || e.key === 'C') openPanel('album')
    if (e.key === '?' || e.key === '/') openPanel('manual')
    if (e.key === 'Escape') { closePanel(); closeModal() }
  })

  shell.addEventListener('pointerdown', () => audio.unlock())

  const onStageResize = () => {
    layoutMini()
    world.resize()
  }
  window.addEventListener('resize', onStageResize)
  window.visualViewport?.addEventListener('resize', onStageResize)
  if (typeof ResizeObserver === 'function' && stageEl) {
    new ResizeObserver(onStageResize).observe(stageEl)
  }
  window.addEventListener('pagehide', () => {
    if (!parked) persistState(state)
    releaseLeader()
  })
  document.addEventListener('visibilitychange', () => {
    refreshClaim()
    if (parked) return
    if (document.hidden) {
      persistState(state)
      audio.setHidden(true)
    } else {
      audio.setHidden(false)
      audio.unlock()
      const card = settleOffline(state)
      if (card) {
        offline = card
        showOffline()
      }
      kickLoop()
    }
  })

  renderMute()
  renderHud()
  applyDock()
  onLocaleChange(() => {
    applyDock()
    renderHud()
    renderMute()
    paintPark()
    const pop = shell.querySelector('[data-popout]')
    if (pop) pop.textContent = g('popout')
    try { tour.paint() } catch { /* ignore */ }
    if (panel) openPanel(panel)
    auth.paintBtn()
  })

  function applyCloud(raw) {
    if (parked || fresh || crawlerDemo) return
    const next = sanitize(raw)
    Object.assign(state, next)
    displayed = state.coins
    const card = settleOffline(state)
    if (card) offline = card
    persistState(state)
    renderHud()
    void world.warm(state)
  }

  const auth = createTankAuth({
    modalEl,
    button: shell.querySelector('[data-account]'),
    toast,
    snapshot: () => snapshotState(state),
    applyCloud,
    persist: () => { if (!parked && !fresh && !crawlerDemo) persistState(state) },
  })

  void auth.boot().then(() => {
    if (parked) return
    if (Number.isFinite(grantCoins) && grantCoins > 0 && state.coins < grantCoins) {
      state.coins = grantCoins
      displayed = state.coins
      persistState(state)
      renderHud()
    }
    showOffline()
    if (!welcomeGift() && !mini && !offline && state.guide && !crawlerDemo) {
      window.setTimeout(() => {
        try { if (!parked) tour.start() } catch { /* ignore */ }
      }, 520)
    }
  })

  function welcomeGift() {
    const fry = state.fish[0]
    if (!state.guide || !fry?.mystery) return false
    const quality = fry.quality || 'common'
    playPackOpen(quality, () => {
      world.setIntro(fry)
      if (!mini && !offline && !parked) {
        try { tour.start() } catch { /* ignore */ }
      }
    }, { sub: g('starterGift') })
    return true
  }

  let looping = false
  function kickLoop() {
    if (looping || parked || document.hidden) return
    lastTick = performance.now()
    looping = true
    requestAnimationFrame(loop)
  }
  function loop(now) {
    if (parked || document.hidden) {
      looping = false
      lastTick = now
      return
    }
    const dt = Math.min(0.05, (now - lastTick) / 1000)
    lastTick = now
    acc += dt
    saveAcc += dt
    const wall = Date.now()
    pruneBubbles(state, wall)
    tickGrowth(state, wall - dt * 1000, wall)
    for (const fish of state.fish) spawnBubble(fish, state, wall)
    const hatches = tickHatch(state, wall)
    for (const ev of hatches) {
      void world.ensureFish(ev.species)
      toast(ev.first
        ? g('hatchNew', { name: fishName(ev.species), rarity: rarityName(rarityOf(ev.species)) })
        : g('hatchKnown', { name: fishName(ev.species), rarity: rarityName(rarityOf(ev.species)) }))
      if (ev.first) audio.stamp()
      persistState(state)
    }
    if (acc >= 1) {
      applySeconds(state, acc, { now: wall })
      tickChests(state, wall, acc)
      acc = 0
    }
    displayed += (state.coins - displayed) * Math.min(1, dt * 4)
    if (saveAcc >= 20) {
      persistState(state)
      saveAcc = 0
    }
    if (tagTimer && Date.now() > tagTimer) tagEl.hidden = true
    world.tick(dt, state, wall, {
      onBite() { audio.bite() },
    })
    renderHud()
    requestAnimationFrame(loop)
  }
  kickLoop()
}
