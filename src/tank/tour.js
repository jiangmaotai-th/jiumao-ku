const TOUR_KEY = 'jiumao-idle-tank-tour'
const TOUR_MAX_MS = 8 * 60 * 1000

const STEPS = [
  { id: 'hello', title: 'tourHello', body: 'tourHello_p' },
  { id: 'coins', sel: '[data-wallet]', title: 'tourCoins', body: 'tourCoins_p' },
  { id: 'lv', sel: '.lv-block', title: 'tourLv', body: 'tourLv_p' },
  { id: 'glass', sel: '.glass', title: 'tourGlass', body: 'tourGlass_p' },
  { id: 'feed', sel: '[data-feed]', title: 'tourFeed', body: 'tourFeed_p' },
  { id: 'shop', sel: '[data-open="shopFish"]', title: 'tourShop', body: 'tourShop_p' },
  { id: 'tank', sel: '[data-open="editTank"]', title: 'tourTank', body: 'tourTank_p' },
  { id: 'album', sel: '[data-open="album"]', title: 'tourAlbum', body: 'tourAlbum_p' },
  { id: 'popout', sel: '[data-popout]', title: 'tourPopout', body: 'tourPopout_p' },
  { id: 'account', sel: '[data-account]', title: 'tourAccount', body: 'tourAccount_p' },
  { id: 'end', title: 'tourEnd', body: 'tourEnd_p' },
]

function tourDone() {
  try { return localStorage.getItem(TOUR_KEY) === '1' } catch { return true }
}

function markDone() {
  try { localStorage.setItem(TOUR_KEY, '1') } catch { /* ignore */ }
}

export function createTour({ root, g, skip, onLock } = {}) {
  let index = -1
  let layer = null
  let killTimer = 0
  let ro = null

  function shouldSkip() {
    return typeof skip === 'function' ? Boolean(skip()) : false
  }

  function teardown() {
    index = -1
    window.clearTimeout(killTimer)
    killTimer = 0
    try { ro?.disconnect() } catch { /* ignore */ }
    ro = null
    document.body.classList.remove('is-tour')
    layer?.remove()
    layer = null
    window.removeEventListener('resize', place)
    window.removeEventListener('keydown', onKey, true)
  }

  function finish() {
    markDone()
    teardown()
  }

  function onKey(e) {
    if (index < 0) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      finish()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function targetOf(step) {
    if (!step?.sel || !root) return null
    return root.querySelector(step.sel)
  }

  function place() {
    if (!layer || index < 0) return
    const step = STEPS[index]
    const spot = layer.querySelector('.tour-spot')
    const card = layer.querySelector('.tour-card')
    if (!spot || !card) return
    const node = targetOf(step)
    const pad = 6
    if (!node || node.getClientRects().length === 0) {
      spot.hidden = true
      card.style.left = '50%'
      card.style.top = '50%'
      card.style.transform = 'translate(-50%, -50%)'
      return
    }
    const r = node.getBoundingClientRect()
    spot.hidden = false
    spot.style.left = `${Math.max(4, r.left - pad)}px`
    spot.style.top = `${Math.max(4, r.top - pad)}px`
    spot.style.width = `${Math.max(24, r.width + pad * 2)}px`
    spot.style.height = `${Math.max(24, r.height + pad * 2)}px`
    const cw = Math.min(320, window.innerWidth - 24)
    const ch = card.offsetHeight || 160
    let left = r.left + r.width / 2 - cw / 2
    left = Math.max(12, Math.min(left, window.innerWidth - cw - 12))
    let top = r.bottom + 12
    if (top + ch > window.innerHeight - 12) top = r.top - ch - 12
    if (top < 12) top = Math.max(12, (window.innerHeight - ch) / 2)
    card.style.left = `${left}px`
    card.style.top = `${top}px`
    card.style.transform = 'none'
    card.style.width = `${cw}px`
  }

  function paint() {
    if (!layer || index < 0) return
    const step = STEPS[index]
    if (!step) { finish(); return }
    const title = layer.querySelector('[data-tour-title]')
    const body = layer.querySelector('[data-tour-body]')
    const next = layer.querySelector('[data-tour-next]')
    const skipBtn = layer.querySelector('[data-tour-skip]')
    const page = layer.querySelector('[data-tour-page]')
    if (title) title.textContent = g(step.title)
    if (body) body.textContent = g(step.body)
    if (next) next.textContent = index >= STEPS.length - 1 ? g('tourFinish') : g('tourNext')
    if (skipBtn) skipBtn.textContent = g('tourSkip')
    if (page) page.textContent = `${index + 1}/${STEPS.length}`
    place()
  }

  function go(nextIndex) {
    if (nextIndex >= STEPS.length) { finish(); return }
    if (nextIndex < 0) nextIndex = 0
    index = nextIndex
    const step = STEPS[index]
    if (step?.sel && !targetOf(step)) {
      go(index + 1)
      return
    }
    paint()
  }

  function ensureLayer() {
    if (layer) return
    layer = document.createElement('div')
    layer.className = 'tour-layer'
    layer.innerHTML = `
      <div class="tour-spot" hidden></div>
      <div class="tour-card">
        <div class="tour-top">
          <strong data-tour-title></strong>
          <span data-tour-page></span>
        </div>
        <p data-tour-body></p>
        <div class="tour-actions">
          <button type="button" class="ghost" data-tour-skip></button>
          <button type="button" class="primary" data-tour-next></button>
        </div>
      </div>`
    document.body.append(layer)
    layer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tour-card')) return
      e.preventDefault()
      e.stopPropagation()
    }, true)
    layer.querySelector('[data-tour-skip]')?.addEventListener('click', finish)
    layer.querySelector('[data-tour-next]')?.addEventListener('click', () => go(index + 1))
    window.addEventListener('resize', place)
    window.addEventListener('keydown', onKey, true)
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(place)
      try { ro.observe(document.body) } catch { /* ignore */ }
    }
  }

  function start({ force = false } = {}) {
    try {
      if (shouldSkip()) return false
      if (!force && tourDone()) return false
      teardown()
      try { onLock?.() } catch { /* ignore */ }
      document.body.classList.add('is-tour')
      ensureLayer()
      go(0)
      killTimer = window.setTimeout(finish, TOUR_MAX_MS)
      return true
    } catch {
      finish()
      return false
    }
  }

  return {
    start,
    stop: finish,
    replay() { return start({ force: true }) },
    paint,
    isOn() { return index >= 0 },
  }
}
