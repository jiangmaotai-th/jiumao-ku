/**
 * Reusable arena widget: canvas + control panel + picker. Used by the
 * homepage embed (lazy chunk) and the /arena/ page.
 */
import './arena.css'
import { getLocale, onLocaleChange } from '../i18n'
import { arenaExtra } from '../i18n/arena-extra'
import { audioLog, musicEnabled, renderOffline, setMusic, setSound, sfx, toWav } from './audio'
import { computeBattle, predictLeft } from './battle'
import { arenaCopy, avatarKey, ensureModels, escapeHtml, fill, loadArenaData } from './data'
import { ArenaEngine, type EngineLabels } from './engine'
import { baseAvatar, preloadSheets } from './fighters'
import { loadArenaFont } from './font'
import type { ArenaData, ArenaModel, BattleResult, Side } from './types'

export type WidgetOpts = {
  embed?: boolean
  fullHref?: string
  onResult?: (b: BattleResult) => void
  onStart?: () => void
  onData?: (d: ArenaData) => void
  onError?: () => void
}
const CHEER_MAX = 10

export function mountArena(host: HTMLElement, opts: WidgetOpts = {}): { destroy: () => void } {
  const locale = getLocale()
  const copy = arenaCopy()
  const ex = arenaExtra(locale)
  const ui = ex.ui
  const embed = !!opts.embed
  const boardLabel = (k: string) => copy.boards[k] ?? ui.boards[k] ?? k
  const picker = (side: Side) => `
    <fieldset class="arena-pick" data-side="${side}">
      <legend>${escapeHtml(side === 'left' ? copy.pickLeft : copy.pickRight)}</legend>
      <label>${escapeHtml(ui.vendor)}<select data-vendor></select></label>
      <input type="search" data-q placeholder="${escapeHtml(ui.search)}" aria-label="${escapeHtml(ui.search)}">
      <select data-model size="${embed ? 4 : 6}" aria-label="${escapeHtml(ui.model)}"></select>
      <p class="arena-pick__info" data-info></p>
    </fieldset>`
  host.classList.add('arena-host')
  host.innerHTML = `
    <div class="arena__stage${embed ? ' arena__stage--embed' : ''}" aria-live="polite">
      <div class="arena__screen">
        <canvas class="arena__canvas" aria-label="${escapeHtml(copy.title)}"></canvas>
        ${embed ? `<span class="arena-embed__live">● ${escapeHtml(ui.live)}</span>` : ''}
      </div>
      <div class="arena__panel">
        <div class="arena__tabs" role="tablist">
          <button type="button" class="arena__tab is-active" data-mode="today">${escapeHtml(copy.todayMatch)}</button>
          <button type="button" class="arena__tab" data-mode="custom">${escapeHtml(copy.customMatch)}</button>
        </div>
        <div class="arena__custom" hidden>
          <label class="arena-pick__sort">${escapeHtml(ui.sort)}
            <select data-sort>
              <option value="comp">${escapeHtml(ui.sortComp)}</option>
              <option value="new">${escapeHtml(ui.sortNew)}</option>
              <option value="name">${escapeHtml(ui.sortName)}</option>
            </select>
          </label>
          <div class="arena-pick__pair">${picker('left')}${picker('right')}</div>
          <p class="arena-pick__warn" data-warn hidden></p>
          <button type="button" class="arena__btn arena__btn--fight" data-fight>${escapeHtml(copy.fight)}</button>
        </div>
        <p class="arena__predict" data-predict hidden></p>
        <p class="arena__round" data-round>${escapeHtml(copy.round1)}</p>
        <div class="arena__cheer">
          <button type="button" class="arena__btn arena__btn--cheer" data-cheer="left"></button>
          <button type="button" class="arena__btn arena__btn--cheer" data-cheer="right"></button>
        </div>
        <p class="arena__cheer-left" data-cheer-left></p>
        ${embed ? '' : `<p class="arena__note">${escapeHtml(copy.cheerNote)}</p>`}
        <div class="arena__controls">
          ${embed ? '' : `<button type="button" class="arena__btn" data-speed aria-pressed="false">${escapeHtml(ex.speed)} ×1</button>`}
          <button type="button" class="arena__btn" data-skip>${escapeHtml(ex.skip)}</button>
          <button type="button" class="arena__btn" data-replay>${escapeHtml(copy.replay)}</button>
          <button type="button" class="arena__btn" data-sound aria-pressed="false">${escapeHtml(copy.soundOff)}</button>
          ${embed ? '' : `<button type="button" class="arena__btn" data-music aria-pressed="true">♪ ${escapeHtml(ex.music)}</button>`}
        </div>
        ${embed && opts.fullHref ? `<a class="arena-embed__full" href="${escapeHtml(opts.fullHref)}">${escapeHtml(ui.openFull)}</a>` : ''}
        ${embed ? '' : `<ul class="arena__soon">
          <li><strong>${escapeHtml(copy.round2)}</strong><span class="arena__badge">${escapeHtml(copy.comingSoon)}</span><p>${escapeHtml(copy.round2Desc)}</p></li>
          <li><strong>${escapeHtml(copy.round3)}</strong><span class="arena__badge">${escapeHtml(copy.comingSoon)}</span><p>${escapeHtml(copy.round3Desc)}</p></li>
        </ul>`}
      </div>
    </div>`

  const $ = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)
  const canvas = $<HTMLCanvasElement>('.arena__canvas')!
  const labels: EngineLabels = {
    round: (i, name) => `${fill(ui.round, { n: i })} · ${name}`,
    winner: (name) => fill(copy.winner, { name }),
    draw: copy.draw, ko: 'K.O.', predict: ex.predict, roundsWon: ex.roundsWon, damage: ex.damageDealt,
    super: ui.super, parry: ui.parry, block: ui.block, crit: ui.crit, counter: ui.counter, guardBreak: ui.guardBreak,
    finish: ui.finish, winnerWord: ui.winner, roundN: (n) => fill(ui.round, { n }), locale,
  }
  const engine = new ArenaEngine(canvas, labels)
  const params = new URLSearchParams(location.search)
  if (!embed) {
    const speed = Number(params.get('speed'))
    if (speed > 0 && speed <= 4) engine.speed = speed
  }
  const q = params.get('q')
  if (q === '0' || q === '1' || q === '2') { engine.quality = Number(q); engine.lockQuality = true }
  if (params.has('rec')) {
    const w = window as unknown as Record<string, unknown>
    w.__arenaAudioLog = audioLog
    w.__arenaEngine = engine
    w.__arenaRenderAudio = async (fromPerf: number, durMs: number) => {
      const buf = await renderOffline(audioLog.map((e) => ({ ...e, at: e.at - fromPerf })), durMs)
      const bytes = toWav(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(bin)
    }
  }

  // pause when scrolled away / tab hidden
  let visible = true
  const sync = () => (visible && !document.hidden ? engine.resume() : engine.pause())
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; sync() }, { threshold: 0.05 }) : null
  io?.observe(canvas)
  document.addEventListener('visibilitychange', sync)

  let data: ArenaData | null = null
  let current: BattleResult | null = null
  let runId = 0

  const syncSpeedBtn = () => {
    const b = $('[data-speed]')
    if (!b) return
    b.textContent = `${ex.speed} ×${engine.speed}`
    b.setAttribute('aria-pressed', String(engine.speed > 1))
  }
  syncSpeedBtn()
  $('[data-speed]')?.addEventListener('click', () => { engine.speed = engine.speed > 1 ? 1 : 2; syncSpeedBtn() })
  $('[data-skip]')!.addEventListener('click', () => engine.skip())

  // ---- cheering (cosmetic only) ----
  const cheerKey = (date: string) => `arena_cheer_${date}`
  const cheersUsed = (date: string) => { try { return Number(localStorage.getItem(cheerKey(date)) || 0) } catch { return 0 } }
  function renderCheer() {
    if (!data || !current) return
    const left = CHEER_MAX - cheersUsed(data.date)
    $('[data-cheer-left]')!.textContent = fill(copy.cheerLeft, { n: Math.max(0, left) })
    host.querySelectorAll<HTMLButtonElement>('[data-cheer]').forEach((b) => {
      const side = b.dataset.cheer as Side
      const m = side === 'left' ? current!.left : current!.right
      b.textContent = `${copy.cheer} ${m.label}`
      b.disabled = left <= 0
      b.style.setProperty('--rage', String(engine.rage(side)))
    })
  }
  host.querySelectorAll<HTMLButtonElement>('[data-cheer]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return
    const used = cheersUsed(data.date)
    if (used >= CHEER_MAX) return
    try { localStorage.setItem(cheerKey(data.date), String(used + 1)) } catch { /* cosmetic */ }
    const side = b.dataset.cheer as Side
    engine.setRage(side, engine.rage(side) + 0.25)
    sfx('cheer')
    renderCheer()
  }))
  $('[data-music]')?.addEventListener('click', (e) => {
    setMusic(!musicEnabled())
    ;(e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(musicEnabled()))
  })
  $('[data-sound]')!.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement
    const on = btn.getAttribute('aria-pressed') !== 'true'
    setSound(on)
    btn.setAttribute('aria-pressed', String(on))
    btn.textContent = on ? copy.soundOn : copy.soundOff
  })

  // ---- battle ----
  const titleOf = (m: ArenaModel) => {
    const base = baseAvatar(m.avatar)
    const v = m.vendor ? data?.vendors?.[m.vendor] : undefined
    return base === 'mystery' ? `${ex.chars.mystery} · ${v?.id === 'other' ? ui.other : v?.name ?? ''}` : ex.chars[base]
  }
  const info = (m: ArenaModel) => {
    const base = baseAvatar(m.avatar)
    return { name: m.label, title: titleOf(m), avatar: data ? avatarKey(data, m) : m.avatar, move: ex.moves[base], intro: ex.intro[base], win: ex.win[base] }
  }
  async function start(leftId: string, rightId: string) {
    if (!data) return
    const id = ++runId
    const warn = $('[data-warn]')!
    warn.hidden = true
    const ok = await ensureModels(data, [leftId, rightId])
    const lm = data.models[leftId], rm = data.models[rightId]
    if (!lm || !rm) return
    await preloadSheets([lm.avatar, rm.avatar])
    if (id !== runId) return
    const b = ok ? computeBattle(data, leftId, rightId) : null
    if (!b) { warn.textContent = ui.noCommon; warn.hidden = false; return }
    current = b
    opts.onStart?.()
    engine.setup(info(b.left), info(b.right))
    const pLeft = predictLeft(b)
    const pl = Math.round(pLeft * 100)
    const pe = $('[data-predict]')!
    pe.textContent = `${ex.predict}：${b.left.label} ${fill(ex.predictLine, { left: pl, right: 100 - pl })} ${b.right.label}`
    pe.hidden = false
    renderCheer()
    const script = {
      winner: b.winner,
      pLeft,
      rounds: b.rounds.map((r) => ({ boardKey: r.board.key, boardLabel: boardLabel(r.board.key), attacker: r.attacker, kind: r.kind, damage: r.damage, counter: r.counter })),
    }
    try {
      await engine.play(script, (i) => { $('[data-round]')!.textContent = `${copy.round1} · ${i + 1}/${b.rounds.length}` })
    } catch { return }
    syncSpeedBtn()
    if (current === b) opts.onResult?.(b)
    document.body.dataset.arenaDone = '1'
  }

  // ---- picker ----
  const fillVendors = (d: ArenaData) => {
    const vs = Object.values(d.vendors ?? {}).sort((a, b) => b.count - a.count)
    const total = Object.keys(d.models).length
    const opt = `<option value="*">★ ${escapeHtml(fill(ui.models, { n: total }))}</option>` + vs.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.id === 'other' ? ui.other : v.name)} (${v.count})</option>`).join('')
    host.querySelectorAll<HTMLSelectElement>('[data-vendor]').forEach((s) => { s.innerHTML = opt })
  }
  const listModels = (fs: HTMLElement, keep?: string) => {
    if (!data) return
    const vendor = fs.querySelector<HTMLSelectElement>('[data-vendor]')!.value
    const qv = fs.querySelector<HTMLInputElement>('[data-q]')!.value.trim().toLowerCase()
    const sort = $<HTMLSelectElement>('[data-sort]')!.value
    let ms = Object.values(data.models).filter((m) => (vendor === '*' || m.vendor === vendor) && (!qv || m.id.toLowerCase().includes(qv) || m.label.toLowerCase().includes(qv)))
    ms.sort((a, b) => sort === 'name' ? a.label.localeCompare(b.label) : sort === 'new' ? Number(!!b.isNew) - Number(!!a.isNew) || (b.comp ?? 0) - (a.comp ?? 0) : (b.comp ?? 0) - (a.comp ?? 0))
    ms = ms.slice(0, 400)
    const sel = fs.querySelector<HTMLSelectElement>('[data-model]')!
    sel.innerHTML = ms.map((m) => {
      const tags = [`${ui.comp} ${m.comp ?? '–'}`, fill(ui.boardsN, { n: m.boards.length })]
      if (m.isNew) tags.unshift(ui.newcomer)
      if (m.boards.length === 1) tags.push(`⚠ ${ui.fewData}`)
      return `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)} · ${escapeHtml(tags.join(' · '))}</option>`
    }).join('')
    if (keep && ms.some((m) => m.id === keep)) sel.value = keep
    else if (ms[0]) sel.value = ms[0].id
    showInfo(fs)
  }
  const showInfo = (fs: HTMLElement) => {
    if (!data) return
    const m = data.models[fs.querySelector<HTMLSelectElement>('[data-model]')!.value]
    const el = fs.querySelector<HTMLElement>('[data-info]')!
    if (!m) { el.textContent = ''; return }
    el.innerHTML = `<code>${escapeHtml(m.id)}</code> ${m.isNew ? `<b class="arena-tag arena-tag--new">${escapeHtml(ui.newcomer)}</b>` : ''}${m.boards.length === 1 ? `<b class="arena-tag arena-tag--few">${escapeHtml(ui.fewData)}</b>` : ''}<br>${escapeHtml(m.boards.map(boardLabel).join(' · '))}`
  }
  host.querySelectorAll<HTMLElement>('.arena-pick').forEach((fs) => {
    fs.querySelector('[data-vendor]')!.addEventListener('change', () => listModels(fs))
    fs.querySelector('[data-q]')!.addEventListener('input', () => listModels(fs, fs.querySelector<HTMLSelectElement>('[data-model]')!.value))
    fs.querySelector('[data-model]')!.addEventListener('change', () => showInfo(fs))
  })
  $('[data-sort]')!.addEventListener('change', () => host.querySelectorAll<HTMLElement>('.arena-pick').forEach((fs) => listModels(fs, fs.querySelector<HTMLSelectElement>('[data-model]')!.value)))
  const pickSet = (side: Side, id: string) => {
    if (!data) return
    const fs = host.querySelector<HTMLElement>(`.arena-pick[data-side="${side}"]`)!
    fs.querySelector<HTMLSelectElement>('[data-vendor]')!.value = data.models[id]?.vendor ?? '*'
    listModels(fs, id)
  }

  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((tab) => tab.addEventListener('click', () => {
    host.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('is-active', x === tab))
    const custom = tab.dataset.mode === 'custom'
    $('.arena__custom')!.hidden = !custom
    host.classList.toggle('is-custom', custom)
    if (!custom && data) void start(data.featured.left, data.featured.right)
  }))
  $('[data-fight]')!.addEventListener('click', () => {
    const l = host.querySelector<HTMLSelectElement>('.arena-pick[data-side="left"] [data-model]')!.value
    const r = host.querySelector<HTMLSelectElement>('.arena-pick[data-side="right"] [data-model]')!.value
    if (!l || !r || l === r) return
    void start(l, r)
  })
  $('[data-replay]')!.addEventListener('click', () => { if (current) void start(current.left.id, current.right.id) })

  void Promise.all([loadArenaData(), loadArenaFont()]).then(([d]) => {
    if (!d) { opts.onError?.(); return }
    data = d
    opts.onData?.(d)
    fillVendors(d)
    const l = embed ? null : params.get('l')
    const r = embed ? null : params.get('r')
    const [L, R] = l && r && d.models[l] && d.models[r] && l !== r ? [l, r] : [d.featured.left, d.featured.right]
    pickSet('left', L); pickSet('right', R)
    if (params.get('mode') === 'custom' && !embed) host.querySelector<HTMLButtonElement>('[data-mode="custom"]')!.click()
    void start(L, R)
  })

  const off = onLocaleChange(() => {
    // language switched without a reload: rebuild with the new copy
    destroy()
    mountArena(host, opts)
  })
  function destroy() {
    runId++
    off()
    io?.disconnect()
    document.removeEventListener('visibilitychange', sync)
    engine.destroy()
  }
  return { destroy }
}
