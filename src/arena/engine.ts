import { music, sfx } from './audio'
import { crack, dust, explosion, palette, shock, signature, SIG_ALIAS, type Fx } from './fx'
import { fighterFrame, type FPose } from './fighters'
import { BOARD_SCENE, GROUND, SCENES, SCENE_PAD, SH, SW, sceneLayers, type SceneId, type SceneLayers } from './scenes'
import type { Avatar, Side } from './types'

export type ScriptRound = { boardKey: string; boardLabel: string; attacker: Side; kind: 'block' | 'hit' | 'crit'; damage: number; counter: boolean }
export type Script = {
  rounds: ScriptRound[]
  winner: Side | null
  /** pre-fight expected win probability for the left side (0–1) */
  pLeft: number
}

export const W = SW
export const H = SH
const FONT = "'ArenaPixel', 'ArenaFallback', 'Zpix', 'Noto Sans Thai', 'Noto Sans Devanagari', 'Leelawadee UI', 'Nirmala UI', 'Thonburi', 'Kohinoor Devanagari', system-ui, sans-serif"
const ROUND_BEATS = { banner: 48, charge: 46, dash: 8, after: 52, settle: 26 }

type Fighter = {
  side: Side
  name: string
  title: string
  avatar: string
  move: string
  intro: string
  winLine: string
  ghosts: [number, number][]
  baseX: number
  x: number
  y: number
  vy: number
  hp: number
  lagHp: number
  lagHold: number
  flash: number
  pose: FPose
  poseT: number
  rage: number
  guard: number
  momentum: number
  scale: number
}
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
type Floater = { text: string; x: number; y: number; vy: number; life: number; color: string; size: 12 | 24; bounce: number }
type Ring = { x: number; y: number; r: number; life: number; color: string }

export type EngineLabels = {
  round: (i: number, name: string) => string
  winner: (name: string) => string
  draw: string
  ko: string
  predict: string
  roundsWon: string
  damage: string
  super: string
  parry: string
  block: string
  crit: string
  counter: string
  guardBreak: string
  finish: string
  winnerWord: string
  roundN: (n: number) => string
  /** locale code: picks fallback-font weight for scripts the pixel font lacks */
  locale?: string
}

export type FighterInfo = { name: string; title: string; avatar: string; move?: string; intro?: string; win?: string }

export class ArenaEngine {
  private ctx: CanvasRenderingContext2D
  private f: Record<Side, Fighter>
  private particles: Particle[] = []
  private ambient: Particle[] = []
  private floaters: Floater[] = []
  private rings: Ring[] = []
  private trauma = 0
  private hitstop = 0
  private screenFlash = 0
  private flashColor = '#fff'
  private timeScale = 1
  private beam: { x: number; t: number } | null = null
  private banner: { text: string; sub: string; t: number } | null = null
  private intro: { t: number; pLeft: number } | null = null
  private fxs: Fx[] = []
  private cutin: { side: Side; text: string; t: number } | null = null
  private aberr = 0
  private invert = 0
  private radial: { x: number; y: number; t: number } | null = null
  private camV = { x: 0, y: 0, z: 0, r: 0 }
  private camR = 0
  private camRT = 0
  private clock = 0
  private roundNo = 0
  private roundTotal = 0
  private out: CanvasRenderingContext2D
  private gl: CanvasRenderingContext2D
  private small: CanvasRenderingContext2D
  private tiny: CanvasRenderingContext2D
  private chan: CanvasRenderingContext2D
  private vignette: HTMLCanvasElement
  quality = 2
  lockQuality = false
  private perf = { n: 0, draw: 0, frame: 0, lastAt: 0 }
  private callout: { text: string; side: Side; t: number } | null = null
  private victory: { side: Side | null; t: number; stats: string[] } | null = null
  private waiters: { n: number; done: () => void }[] = []
  private cam = { x: SW / 2, y: SH / 2, z: 1 }
  private camT = { x: SW / 2, y: SH / 2, z: 1 }
  private scene: SceneLayers
  private sceneFade = 0
  private prevScene: SceneLayers | null = null
  private raf = 0
  private acc = 0
  private last = 0
  private tick = 0
  private reduced: boolean
  private token = 0
  private skipped = false
  speed = 1
  private labels: EngineLabels
  /** bold for th/hi (system fallback fonts read better heavier) */
  private fw = ''
  setLabels(l: EngineLabels) { this.labels = l; this.fw = l.locale === 'th' || l.locale === 'hi' ? 'bold ' : '' }

  constructor(canvas: HTMLCanvasElement, labels: EngineLabels) {
    this.labels = labels
    canvas.width = W
    canvas.height = H
    this.out = canvas.getContext('2d')!
    this.fw = labels.locale === 'th' || labels.locale === 'hi' ? 'bold ' : ''
    this.out.imageSmoothingEnabled = false
    const mk = (w: number, h: number, smooth = false) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d')!; x.imageSmoothingEnabled = smooth; return x }
    this.ctx = mk(W, H)
    this.gl = mk(W, H)
    this.small = mk(W / 4, H / 4, true)
    this.tiny = mk(W / 8, H / 8, true)
    this.chan = mk(W, H)
    this.vignette = document.createElement('canvas')
    this.vignette.width = W; this.vignette.height = H
    const v = this.vignette.getContext('2d')!
    const gr = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62)
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(6,2,16,0.55)')
    v.fillStyle = gr; v.fillRect(0, 0, W, H)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) this.quality = 1
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const day = Math.floor(Date.now() / 86400000)
    this.scene = sceneLayers((Object.keys(SCENES) as SceneId[])[day % 6])
    this.f = { left: this.mk('left', { name: '', title: '', avatar: 'knight' }), right: this.mk('right', { name: '', title: '', avatar: 'dragon' }) }
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  private mk(side: Side, c: FighterInfo): Fighter {
    const baseX = side === 'left' ? 132 : W - 132
    return { side, name: c.name, title: c.title, avatar: c.avatar, move: c.move ?? '', intro: c.intro ?? '', winLine: c.win ?? '', ghosts: [], baseX, x: baseX, y: 0, vy: 0, hp: 100, lagHp: 100, lagHold: 0, flash: 0, pose: 'idle0', poseT: 0, rage: 0, guard: 0, momentum: 0, scale: 1 }
  }

  setup(left: FighterInfo, right: FighterInfo) {
    this.token++
    this.waiters.forEach((w) => w.done())
    this.waiters = []
    const keep = { left: this.f.left.rage, right: this.f.right.rage }
    this.f = { left: this.mk('left', left), right: this.mk('right', right) }
    this.f.left.rage = keep.left
    this.f.right.rage = keep.right
    this.particles = []
    this.floaters = []
    this.rings = []
    this.beam = null
    this.banner = null
    this.intro = null
    this.victory = null
    this.timeScale = 1
    this.skipped = false
    this.camT = { x: SW / 2, y: SH / 2, z: 1 }
    this.fxs = []
    this.cutin = null
    this.aberr = this.invert = 0
    this.radial = null
    this.camRT = 0
    this.clock = 0
    this.roundNo = 0
  }

  setRage(side: Side, v: number) {
    const fi = this.f[side]
    fi.rage = Math.max(0, Math.min(1, v))
    for (let i = 0; i < 10; i++) this.spark(fi.x + (Math.random() - 0.5) * 30, GROUND - 20 - Math.random() * 40, fi.rage >= 1 ? '#ffd23f' : '#ff8a3d', 0.6, -1.4)
  }
  rage(side: Side) { return this.f[side].rage }

  destroy() { cancelAnimationFrame(this.raf); this.raf = 0 }
  /** off-screen: freeze everything (battle timeline included) */
  pause() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0 } }
  resume() { if (!this.raf) { this.last = performance.now(); this.acc = 0; this.raf = requestAnimationFrame(this.loop) } }

  /** Jump straight to the final state (HP from the real script, victory card). */
  skip() { this.skipped = true; this.waiters.forEach((w) => w.done()); this.waiters = [] }

  private setScene(key: string) {
    const id = BOARD_SCENE[key] ?? 'castle'
    if (this.scene.id === id) return
    this.prevScene = this.scene
    this.scene = sceneLayers(id)
    this.sceneFade = 1
    this.ambient = []
  }

  private wait(frames: number, tok: number) {
    if (this.skipped) return Promise.reject(new Error('skip'))
    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ n: frames, done: () => (tok === this.token && !this.skipped ? resolve() : reject(new Error(this.skipped ? 'skip' : 'cancelled'))) })
    })
  }

  async play(s: Script, onRound?: (i: number) => void): Promise<void> {
    const tok = this.token
    const L = this.f.left, R = this.f.right
    try {
      if (s.rounds[0]) this.setScene(s.rounds[0].boardKey)
      // ---- VS card ----
      this.intro = { t: 0, pLeft: s.pLeft }
      L.pose = 'taunt'; L.poseT = 150; R.pose = 'taunt'; R.poseT = 150
      this.roundTotal = s.rounds.length
      music.start()
      sfx('vs')
      await this.wait(this.reduced ? 70 : 150, tok)
      this.intro = null
      for (let i = 0; i < s.rounds.length; i++) {
        const r = s.rounds[i]
        onRound?.(i)
        this.roundNo = i + 1
        await this.round(r, i, tok)
      }
      await this.finale(s, tok)
    } catch (e) {
      if ((e as Error).message !== 'skip' || tok !== this.token) throw e
      // skipped: snap to the truth
      let hl = 100, hr = 100
      for (const r of s.rounds) { if (r.attacker === 'left') hr -= r.damage; else hl -= r.damage }
      L.hp = L.lagHp = Math.max(0, hl); R.hp = R.lagHp = Math.max(0, hr)
      this.intro = null; this.banner = null; this.beam = null; this.timeScale = 1; this.particles = []; this.floaters = []
      if (s.winner) { const loser = s.winner === 'left' ? R : L; loser.pose = 'down'; this.f[s.winner].pose = 'win' }
      this.camT = { x: SW / 2, y: SH / 2, z: 1 }
      this.victory = { side: s.winner, t: 30, stats: this.stats(s) }
      this.cutin = null; this.fxs = []; this.radial = null; this.camRT = 0
      music.stop(); music.fanfare()
      this.skipped = false
    }
  }

  private stats(s: Script): string[] {
    const won = { left: 0, right: 0 }, dmg = { left: 0, right: 0 }
    for (const r of s.rounds) if (r.kind !== 'block') { won[r.attacker]++; dmg[r.attacker] += r.damage }
    const pct = Math.round(s.pLeft * 100)
    return [
      `${this.labels.roundsWon}  ${won.left} : ${won.right}`,
      `${this.labels.damage}  ${dmg.left} : ${dmg.right}`,
      `${this.labels.predict}  ${pct}% : ${100 - pct}%`,
    ]
  }

  private async round(r: ScriptRound, i: number, tok: number) {
    const a = this.f[r.attacker]
    const d = this.f[r.attacker === 'left' ? 'right' : 'left']
    const dir = r.attacker === 'left' ? 1 : -1
    this.setScene(r.boardKey)
    this.banner = { text: this.labels.roundN(i + 1), sub: r.boardLabel, t: 0 }
    sfx('text')
    this.camT = { x: SW / 2, y: SH / 2, z: 1 }
    await this.wait(ROUND_BEATS.banner, tok)
    // ---- charge: camera pushes in on the attacker, energy converges ----
    a.pose = 'charge'
    a.poseT = ROUND_BEATS.charge
    this.camT = { x: a.x + dir * 30, y: GROUND - 40, z: this.reduced ? 1 : r.kind === 'crit' ? 1.35 : 1.2 }
    sfx('charge')
    if (r.kind !== 'block') this.callout = { text: a.move, side: a.side, t: 0 }
    for (let k = 0; k < ROUND_BEATS.charge; k += 4) {
      if (k >= ROUND_BEATS.charge - 12) a.pose = 'attack0'
      for (let j = 0; j < 3; j++) {
        const ang = Math.random() * Math.PI * 2, rad = 26 + Math.random() * 10
        const tx = a.x, ty = GROUND - 32
        this.particles.push({ x: tx + Math.cos(ang) * rad, y: ty + Math.sin(ang) * rad, vx: -Math.cos(ang) * rad / 14, vy: -Math.sin(ang) * rad / 14, life: 14, max: 14, color: r.kind === 'crit' ? '#ffd23f' : '#7ef0ff', size: 2, grav: 0 })
      }
      await this.wait(4, tok)
    }
    if (r.kind === 'crit' && !this.reduced) await this.superCutin(a, tok)
    // ---- dash ----
    a.pose = 'attack1'
    a.poseT = 24
    sfx('swing')
    this.fxs.push(dust(a.x, GROUND - 2, 8, -dir))
    if (r.kind !== 'block') this.radial = { x: a.x, y: GROUND - 30, t: 10 }
    if (r.kind !== 'block') { const sx0 = a.x; this.fxs.push(...signature(a.avatar, d.x - dir * 10, GROUND - 34, dir, r.kind === 'crit', sx0).map((f) => ({ ...f, t: -8 }))) }
    this.camT = { x: (a.x + d.x) / 2, y: GROUND - 40, z: this.reduced ? 1 : 1.12 }
    const meet = d.x - dir * 46
    for (let k = 0; k < ROUND_BEATS.dash; k++) {
      a.ghosts.unshift([a.x, a.y]); a.ghosts.length = Math.min(a.ghosts.length, 4)
      a.x += (meet - a.x) * 0.45
      if (k % 2 === 0) this.particles.push({ x: a.x - dir * 18, y: GROUND - 10 - Math.random() * 30, vx: -dir * 2, vy: 0, life: 10, max: 10, color: '#ffffff', size: 1, grav: 0 })
      await this.wait(1, tok)
    }
    const ix = d.x - dir * 18, iy = GROUND - 34
    if (r.kind === 'block') {
      // ---- parry: both bounce, sparks fly, defender gains momentum ----
      d.pose = 'block'
      d.poseT = 40
      sfx('parry')
      this.hit(4, 0.35)
      for (let k = 0; k < 26; k++) this.spark(ix, iy, k % 3 ? '#ffe27a' : '#ffffff', 3.4)
      this.rings.push({ x: ix, y: iy, r: 4, life: 16, color: '#ffe27a' })
      this.fxs.push(explosion(ix, iy, 7, ['#ffffff', '#80f2ff']), shock(ix, iy, 30, '#fff3ae', 14, 0.9), dust(d.x, GROUND - 2, 6, dir))
      this.camRT = dir * -0.01
      this.float(i % 2 ? this.labels.parry : this.labels.block, ix, iy - 26, '#7ef0ff', 24)
      a.x -= dir * 14
      a.pose = 'hurt'
      a.poseT = 14
      d.x += dir * 6
      d.momentum = Math.min(1, d.momentum + 0.34)
      d.guard = Math.min(1, d.guard + 0.34)
      a.ghosts = []
      await this.wait(18, tok)
      if (d.guard >= 0.99) {
        // guard crush (presentation only; damage stays 0)
        sfx('guard')
        this.hit(8, 0.5)
        this.float(this.labels.guardBreak, d.x, iy - 44, '#ff5a7a', 12)
        for (let k = 0; k < 18; k++) this.spark(d.x, iy, '#ff5a7a', 3)
        d.pose = 'hurt'
        d.poseT = 16
        d.guard = 0
      } else {
        // defender shoves back, then taunts
        d.pose = 'taunt'
        d.poseT = 30
        a.x -= dir * 8
        this.float(`${Math.round(d.momentum * 100)}%`, d.x, iy - 44, '#ffd23f', 12)
      }
      await this.wait(ROUND_BEATS.after - 18, tok)
    } else {
      const crit = r.kind === 'crit'
      d.flash = 2
      d.pose = 'hurt'
      d.poseT = crit ? 30 : 22
      d.hp = Math.max(0, d.hp - r.damage)
      d.lagHold = 34
      d.guard = 0
      a.momentum = Math.min(1, a.momentum + (crit ? 0.5 : 0.25))
      if (crit) sfx('crit'); else sfx('hit')
      this.hit(crit ? 22 : 9, crit ? 1 : 0.55)
      if (crit) { this.screenFlash = 3; this.flashColor = '#ffffff' }
      for (let k = 0; k < (crit ? 40 : 20); k++) this.spark(ix, iy, k % 4 === 0 ? '#ffffff' : crit ? '#ffd23f' : '#ff7a3d', crit ? 4.6 : 3)
      this.rings.push({ x: ix, y: iy, r: 6, life: crit ? 22 : 14, color: crit ? '#ffd23f' : '#ffffff' })
      const pal = palette(a.avatar)
      this.fxs.push(explosion(ix, iy, crit ? 18 : 10, [pal[0], pal[1]]), shock(ix, GROUND - 2, crit ? 90 : 50, pal[1], crit ? 24 : 16), dust(d.x, GROUND - 2, crit ? 14 : 8, dir))
      sfx('sig_' + SIG_ALIAS[a.avatar.split('#')[0] as Avatar])
      if (crit) {
        this.fxs.push(crack(d.x, GROUND, dir), shock(ix, iy, 60, '#ffffff', 16, 1))
        for (let k = 0; k < 14; k++) this.particles.push({ x: d.x + (Math.random() - 0.5) * 20, y: GROUND - 2, vx: (Math.random() - 0.5) * 5 + dir * 1.5, vy: -2 - Math.random() * 4, life: 50, max: 50, color: k % 2 ? '#6a5a7a' : '#a89ab8', size: 2, grav: 0.25 })
        if (!this.reduced) { this.aberr = 14; this.invert = 3 }
        this.camRT = dir * 0.035
      } else { if (!this.reduced) this.aberr = 6; this.camRT = dir * 0.012 }
      this.float(`-${r.damage}`, d.x, iy - 16, crit ? '#ffd23f' : '#ffffff', 24)
      if (crit) this.float(this.labels.crit, d.x, iy - 46, '#ff5a7a', 24)
      else if (r.counter) this.float(this.labels.counter, d.x, iy - 44, '#7ef0ff', 12)
      d.vy = crit ? -3.4 : -2
      await this.wait(16, tok)
      a.pose = 'attack2'
      a.poseT = 30
      a.ghosts = []
      this.camRT = 0
      d.x += dir * (crit ? 20 : 10)
      await this.wait(ROUND_BEATS.after - 16, tok)
    }
    // ---- settle back ----
    this.camT = { x: SW / 2, y: SH / 2, z: 1 }
    this.camRT = 0
    for (let k = 0; k < ROUND_BEATS.settle; k++) {
      a.x += (a.baseX - a.x) * 0.2
      d.x += (d.baseX - d.x) * 0.2
      await this.wait(1, tok)
    }
    a.x = a.baseX
    d.x = d.baseX
  }

  private async finale(s: Script, tok: number) {
    const L = this.f.left, R = this.f.right
    if (!s.winner) {
      this.banner = { text: this.labels.draw, sub: '', t: 0 }
      L.pose = R.pose = 'block'
      await this.wait(80, tok)
      this.victory = { side: null, t: 0, stats: this.stats(s) }
      await this.wait(90, tok)
      return
    }
    const w = this.f[s.winner], l = s.winner === 'left' ? R : L
    const dir = s.winner === 'left' ? 1 : -1
    // charge + slow motion finisher
    w.pose = 'charge'
    w.poseT = 999
    this.camT = { x: w.x + dir * 20, y: GROUND - 40, z: this.reduced ? 1 : 1.3 }
    sfx('charge')
    for (let k = 0; k < 40; k += 3) { for (let j = 0; j < 4; j++) this.spark(w.x, GROUND - 30, j % 2 ? '#ffd23f' : '#ffffff', 2.5, -1); await this.wait(3, tok) }
    if (!this.reduced) await this.superCutin(w, tok)
    music.stop()
    w.pose = 'attack1'
    this.callout = { text: w.move, side: w.side, t: 0 }
    this.fxs.push(...signature(w.avatar, l.x, GROUND - 34, dir, true, w.x), explosion(l.x, GROUND - 34, 26, [...palette(w.avatar)]), crack(l.x, GROUND, dir), shock(l.x, GROUND - 2, 120, '#ffffff', 30))
    sfx('sig_' + SIG_ALIAS[w.avatar.split('#')[0] as Avatar])
    this.radial = { x: l.x, y: GROUND - 34, t: 30 }
    if (!this.reduced) { this.aberr = 24; this.invert = 4 }
    this.camRT = dir * 0.05
    this.timeScale = this.reduced ? 1 : 0.3
    this.camT = { x: l.x, y: GROUND - 36, z: this.reduced ? 1 : 1.55 }
    sfx('beam')
    this.beam = { x: l.x, t: 0 }
    this.screenFlash = 3
    this.flashColor = '#ffffff'
    l.flash = 3
    l.pose = 'hurt'
    l.poseT = 999
    this.hit(28, 1)
    for (let k = 0; k < 60; k++) this.spark(l.x, GROUND - 30, k % 3 ? '#ffd23f' : '#ffffff', 5)
    this.rings.push({ x: l.x, y: GROUND - 30, r: 6, life: 30, color: '#ffffff' })
    this.float(l.hp <= 0 ? this.labels.ko : this.labels.finish, l.x, GROUND - 80, '#ff5a7a', 24)
    l.vy = -4
    await this.wait(36, tok)
    this.timeScale = 1
    this.beam = null
    this.camRT = 0
    w.pose = 'attack2'
    l.pose = 'down'
    l.x += dir * 18
    sfx('ko')
    await this.wait(36, tok)
    // victory card
    w.pose = 'win'
    w.poseT = 999
    this.camT = { x: SW / 2, y: SH / 2, z: 1 }
    music.fanfare()
    this.victory = { side: s.winner, t: 0, stats: this.stats(s) }
    for (let k = 0; k < 80; k++) this.particles.push({ x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 1.5, life: 140, max: 140, color: ['#ffd23f', '#ff5a7a', '#7ef0ff', '#ffffff'][k % 4], size: 2, grav: 0.01 })
    await this.wait(120, tok)
  }

  /** fighting-game style super cut-in: close-up + move name, ~0.9 s */
  private async superCutin(a: Fighter, tok: number) {
    this.cutin = { side: a.side, text: a.move, t: 0 }
    sfx('cutin')
    await this.wait(54, tok)
    this.cutin = null
  }

  private hit(stop: number, trauma: number) {
    if (this.reduced) { this.hitstop = Math.min(stop, 4); return }
    this.hitstop = Math.max(this.hitstop, stop)
    this.trauma = Math.min(1, this.trauma + trauma)
  }
  private spark(x: number, y: number, color: string, power: number, vyBias = 0) {
    const ang = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * power
    this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + vyBias, life: 18 + Math.random() * 14, max: 32, color, size: Math.random() < 0.3 ? 2 : 1, grav: 0.12 })
  }
  private float(text: string, x: number, y: number, color: string, size: 12 | 24) {
    this.floaters.push({ text, x, y, vy: -1.1, life: 56, color, size, bounce: 6 })
  }

  // ---------------------------------------------------------------- loop
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(100, now - this.last)
    this.last = now
    this.acc += dt
    const step = 1000 / 60
    let n = 0
    while (this.acc >= step && n < 6) {
      this.acc -= step
      n++
      this.realTick()
    }
    const t0 = performance.now()
    this.draw()
    this.composite()
    const p = this.perf
    p.draw += performance.now() - t0
    p.frame += p.lastAt ? now - p.lastAt : 16.7
    p.lastAt = now
    if (++p.n === 90) {
      const avgDraw = p.draw / p.n, avgFrame = p.frame / p.n
      // auto-degrade: slow frames or expensive draws
      if (!this.lockQuality && this.quality > 0 && (avgFrame > 24 || avgDraw > 10)) this.quality--
      ;(window as unknown as { __arenaPerf: unknown }).__arenaPerf = { avgDraw: +avgDraw.toFixed(2), avgFrame: +avgFrame.toFixed(2), quality: this.quality }
      p.n = 0; p.draw = 0; p.frame = 0
    }
  }

  private worldAcc = 0
  private realTick() {
    this.tick++
    if (this.screenFlash > 0) this.screenFlash--
    this.trauma = Math.max(0, this.trauma - 0.03)
    for (const fi of [this.f.left, this.f.right]) {
      if (fi.lagHold > 0) fi.lagHold--
      else if (fi.lagHp > fi.hp) fi.lagHp = Math.max(fi.hp, fi.lagHp - 0.6)
    }
    if (this.intro) this.intro.t++
    if (this.victory) this.victory.t++
    if (this.cutin) this.cutin.t++
    if (this.aberr > 0) this.aberr--
    if (this.invert > 0) this.invert--
    if (this.radial && --this.radial.t <= 0) this.radial = null
    if (this.callout) { this.callout.t++; if (this.callout.t > 90) this.callout = null }
    if (this.banner) { this.banner.t++; if (this.banner.t > 70) this.banner = null }
    if (this.sceneFade > 0) this.sceneFade = Math.max(0, this.sceneFade - 0.04)
    // camera eases in real time
    // spring camera (slight overshoot = weight)
    const K = 0.07, D = 0.72
    for (const key of ['x', 'y', 'z'] as const) {
      this.camV[key] = this.camV[key] * D + (this.camT[key] - this.cam[key]) * K
      this.cam[key] += this.camV[key]
    }
    this.camV.r = this.camV.r * D + (this.camRT - this.camR) * K
    this.camR += this.camV.r
    this.ambientTick()
    if (this.hitstop > 0) { this.hitstop--; return }
    this.worldAcc += this.speed * this.timeScale
    while (this.worldAcc >= 1) { this.worldAcc -= 1; this.worldTick() }
  }

  private worldTick() {
    if (this.roundNo > 0 && !this.victory) this.clock++
    this.fxs = this.fxs.filter((f) => { f.t++; if (f.t >= 0) f.step?.(f.t); return f.t < f.life })
    for (const w of this.waiters) w.n--
    const ready = this.waiters.filter((w) => w.n <= 0)
    this.waiters = this.waiters.filter((w) => w.n > 0)
    ready.forEach((w) => w.done())
    for (const fi of [this.f.left, this.f.right]) {
      if (fi.flash > 0) fi.flash--
      if (fi.poseT > 0 && --fi.poseT === 0 && fi.pose !== 'down' && fi.pose !== 'win') fi.pose = 'idle0'
      if (fi.pose === 'idle0' || fi.pose === 'idle1' || fi.pose === 'idle2') fi.pose = (['idle0', 'idle1', 'idle2', 'idle1'] as const)[Math.floor((this.tick + (fi.side === 'left' ? 0 : 9)) / 14) % 4]
      fi.y += fi.vy
      fi.vy += 0.3
      if (fi.y >= 0) { fi.y = 0; fi.vy = 0 }
      fi.momentum = Math.max(0, fi.momentum - 0.0008)
      if (fi.rage >= 1 && this.tick % 6 === 0) this.spark(fi.x + (Math.random() - 0.5) * 34, GROUND - Math.random() * 10, '#ff8a3d', 0.4, -1.6)
    }
    this.particles = this.particles.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.97
      return --p.life > 0
    })
    this.floaters = this.floaters.filter((fl) => {
      fl.y += fl.vy; fl.vy *= 0.94
      if (fl.bounce > 0) fl.bounce--
      return --fl.life > 0
    })
    this.rings = this.rings.filter((r) => { r.r += 3; return --r.life > 0 })
    if (this.beam) this.beam.t++
  }

  private ambientTick() {
    const s = SCENES[this.scene.id]
    if (this.reduced) return
    if (this.ambient.length < 40 && this.tick % 3 === 0) {
      const c = s.ambientColors[Math.floor(Math.random() * s.ambientColors.length)]
      const x = Math.random() * (W + 40) - 20
      switch (s.ambient) {
        case 'petal': this.ambient.push({ x, y: -4, vx: -0.3 - Math.random() * 0.4, vy: 0.4 + Math.random() * 0.3, life: 600, max: 600, color: c, size: 2, grav: 0 }); break
        case 'bits': this.ambient.push({ x, y: -4, vx: 0, vy: 0.8 + Math.random(), life: 300, max: 300, color: c, size: 1, grav: 0 }); break
        case 'sand': this.ambient.push({ x: W + 4, y: 60 + Math.random() * 140, vx: -1.2 - Math.random(), vy: (Math.random() - 0.5) * 0.2, life: 400, max: 400, color: c, size: 1, grav: 0 }); break
        case 'sparkle': this.ambient.push({ x, y: GROUND + 20, vx: 0, vy: -0.3 - Math.random() * 0.3, life: 300, max: 300, color: c, size: 1, grav: 0 }); break
        case 'spark': this.ambient.push({ x, y: GROUND, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 0.5, life: 200, max: 200, color: c, size: 1, grav: 0 }); break
        default: this.ambient.push({ x, y: 80 + Math.random() * 90, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, life: 240, max: 240, color: c, size: 1, grav: 0 })
      }
    }
    this.ambient = this.ambient.filter((p) => {
      p.x += p.vx + (s.ambient === 'petal' ? Math.sin((this.tick + p.life) * 0.05) * 0.3 : 0)
      p.y += p.vy
      return --p.life > 0 && p.y < H + 6 && p.x > -30 && p.x < W + 30
    })
  }

  // ---------------------------------------------------------------- draw
  /** world → screen for a given parallax factor */
  private view(c: CanvasRenderingContext2D, f: number, sx = 0, sy = 0) {
    const z = 1 + (this.cam.z - 1) * f
    const cx = W / 2 + (this.cam.x - W / 2) * f, cy = H / 2 + (this.cam.y - H / 2) * f
    const rot = this.reduced ? 0 : this.camR * f
    const cs = Math.cos(rot) * z, sn = Math.sin(rot) * z
    // T = translate(W/2+sx, H/2+sy) · rotate · scale · translate(-cx,-cy)
    c.setTransform(cs, sn, -sn, cs, Math.round(W / 2 + sx - cs * cx + sn * cy), Math.round(H / 2 + sy - sn * cx - cs * cy))
  }
  private project(x: number, y: number): [number, number] {
    const z = this.cam.z
    return [Math.round(W / 2 + (x - this.cam.x) * z), Math.round(H / 2 + (y - this.cam.y) * z)]
  }

  private drawScene(c: CanvasRenderingContext2D, sc: SceneLayers, sx: number, sy: number) {
    this.view(c, 0.08, sx * 0.2, sy * 0.2)
    c.drawImage(sc.sky, -SCENE_PAD, 0)
    for (const [x, y, ph] of sc.stars) {
      const tw = (this.tick + ph * 7) % 120
      c.fillStyle = tw < 6 ? '#ffffff' : tw < 60 ? '#b8b8ff' : '#6a6aa8'
      c.fillRect(x - SCENE_PAD, y, 1, 1)
      if (tw < 3) { c.fillRect(x - SCENE_PAD - 1, y, 3, 1); c.fillRect(x - SCENE_PAD, y - 1, 1, 3) }
    }
    this.view(c, 0.3, sx * 0.4, sy * 0.4)
    c.drawImage(sc.far, -SCENE_PAD, 0)
    this.view(c, 0.45, sx * 0.5, sy * 0.5)
    c.globalAlpha = 0.7
    c.drawImage(sc.fog, -SCENE_PAD - ((this.tick * 0.15) % 60), -18)
    c.globalAlpha = 1
    this.view(c, 0.6, sx * 0.7, sy * 0.7)
    c.drawImage(sc.mid, -SCENE_PAD, 0)
    if (!this.reduced || this.quality > 0) {
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = 0.55 + Math.sin(this.tick * 0.02) * 0.2
      c.drawImage(sc.shafts, -SCENE_PAD + Math.sin(this.tick * 0.006) * 10, 0)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }
    this.view(c, 1, sx, sy)
    c.drawImage(sc.ground, -SCENE_PAD, GROUND)
    c.globalAlpha = 0.5
    c.drawImage(sc.fog, -SCENE_PAD + ((this.tick * 0.3) % 60) - 30, 6)
    c.globalAlpha = 1
  }

  private draw() {
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    const sh = this.trauma * this.trauma * 9
    const sx = Math.round((Math.random() * 2 - 1) * sh), sy = Math.round((Math.random() * 2 - 1) * sh)
    this.drawScene(c, this.scene, sx, sy)
    if (this.sceneFade > 0 && this.prevScene) {
      c.globalAlpha = this.sceneFade
      this.drawScene(c, this.prevScene, sx, sy)
      c.globalAlpha = 1
    }
    // ambient (between mid and fighters)
    c.setTransform(1, 0, 0, 1, 0, 0)
    for (const p of this.ambient) {
      c.globalAlpha = Math.min(1, p.life / 40)
      c.fillStyle = p.color
      c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
    }
    c.globalAlpha = 1
    this.view(c, 1, sx, sy)
    // beam behind loser
    if (this.beam) {
      const bw = 20 + Math.sin(this.beam.t * 0.8) * 6
      c.fillStyle = 'rgba(255,240,180,0.8)'
      c.fillRect(Math.round(this.beam.x - bw / 2), 0, Math.round(bw), GROUND)
      c.fillStyle = '#ffffff'
      c.fillRect(Math.round(this.beam.x - bw / 6), 0, Math.round(bw / 3), GROUND)
    }
    for (const f of this.fxs) if (f.back && f.t >= 0) f.draw(c, f.t)
    for (const fi of [this.f.left, this.f.right]) this.drawFighter(c, fi)
    for (const f of this.fxs) if (!f.back && f.t >= 0) f.draw(c, f.t)
    for (const r of this.rings) {
      c.strokeStyle = r.color
      c.globalAlpha = r.life / 20
      c.lineWidth = 2
      c.strokeRect(Math.round(r.x - r.r), Math.round(r.y - r.r * 0.6), Math.round(r.r * 2), Math.round(r.r * 1.2))
    }
    c.globalAlpha = 1
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life / 10)
      c.fillStyle = p.color
      c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
    }
    c.globalAlpha = 1
    // emissive copy for bloom
    if (this.quality > 0 && !this.reduced) {
      const g = this.gl
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, W, H)
      g.setTransform(c.getTransform())
      for (const f of this.fxs) if (f.t >= 0) f.draw(g, f.t)
      for (const p of this.particles) { g.fillStyle = p.color; g.fillRect(Math.round(p.x), Math.round(p.y), p.size + 1, p.size + 1) }
      if (this.beam) { g.fillStyle = '#fff3c0'; g.fillRect(Math.round(this.beam.x - 14), 0, 28, GROUND) }
      for (const fi of [this.f.left, this.f.right]) if (fi.rage >= 1 || fi.flash > 0) { g.fillStyle = fi.flash ? '#ffffff' : '#ffd23f'; g.fillRect(Math.round(fi.x - 14), GROUND - 50, 28, 46) }
    }
    // foreground layer moves faster than the fighters (pre-blurred = depth of field)
    this.view(c, 1.4, sx * 1.4, sy * 1.4)
    c.drawImage(this.scene.near, -SCENE_PAD, 0)
    // ---- screen space ----
    c.setTransform(1, 0, 0, 1, 0, 0)
    if (this.quality > 0) {
      c.globalCompositeOperation = 'soft-light'
      c.globalAlpha = 0.55
      c.drawImage(this.scene.grade, 0, 0)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }
    // letterbox during zooms / slow motion
    const bars = Math.round(Math.min(18, (this.cam.z - 1) * 50) + (this.timeScale < 1 ? 6 : 0))
    if (bars > 0) { c.fillStyle = '#000'; c.fillRect(0, 0, W, bars); c.fillRect(0, H - bars, W, bars) }
    for (const fl of this.floaters) {
      const [x, y] = this.project(fl.x, fl.y)
      const pop = fl.bounce > 0 ? Math.round(fl.bounce / 2) : 0
      c.globalAlpha = Math.min(1, fl.life / 14)
      this.text(fl.text, x, y - pop, fl.color, fl.size)
    }
    c.globalAlpha = 1
    this.drawHud(c)
    if (this.callout && !this.intro) this.drawCallout(c)
    if (this.banner) this.drawBanner(c)
    if (this.cutin) this.drawCutin(c)
    if (this.intro) this.drawIntro(c)
    if (this.victory) this.drawVictory(c)
    if (this.screenFlash > 0) { c.fillStyle = this.flashColor; c.globalAlpha = this.screenFlash / 3; c.fillRect(0, 0, W, H); c.globalAlpha = 1 }
  }

  /** buffer → screen with post effects */
  private composite() {
    const o = this.out, buf = this.ctx.canvas
    const hi = this.quality > 1 && !this.reduced
    o.globalCompositeOperation = 'source-over'
    o.globalAlpha = 1
    if (this.timeScale < 1 && hi) {
      // time warp: rippling horizontal slices
      for (let y = 0; y < H; y += 4) o.drawImage(buf, 0, y, W, 4, Math.round(Math.sin(y * 0.08 + this.tick * 0.3) * 2), y, W, 4)
    } else o.drawImage(buf, 0, 0)
    if (this.radial && hi) {
      const { x, y } = this.radial
      for (let k = 1; k <= 3; k++) {
        const s = 1 + k * 0.025
        o.globalAlpha = 0.16
        o.drawImage(buf, x - x * s, y - y * s, W * s, H * s)
      }
      o.globalAlpha = 1
    }
    if (this.quality > 0 && !this.reduced) {
      // bloom: blurred emissive layer, added twice at two radii
      this.small.clearRect(0, 0, W / 4, H / 4)
      this.small.drawImage(this.gl.canvas, 0, 0, W / 4, H / 4)
      o.imageSmoothingEnabled = true
      o.globalCompositeOperation = 'lighter'
      o.globalAlpha = 0.55
      o.drawImage(this.small.canvas, 0, 0, W, H)
      if (hi) {
        this.tiny.clearRect(0, 0, W / 8, H / 8)
        this.tiny.drawImage(this.small.canvas, 0, 0, W / 8, H / 8)
        o.globalAlpha = 0.45
        o.drawImage(this.tiny.canvas, 0, 0, W, H)
      }
      o.globalAlpha = 1
      o.globalCompositeOperation = 'source-over'
      o.imageSmoothingEnabled = false
    }
    if (this.aberr > 0) {
      // chromatic aberration: drop red, add a shifted red-only copy
      const off = Math.max(1, Math.round(this.aberr / 5))
      const ch = this.chan
      ch.globalCompositeOperation = 'source-over'
      ch.drawImage(o.canvas, 0, 0)
      ch.globalCompositeOperation = 'multiply'
      ch.fillStyle = '#ff0000'
      ch.fillRect(0, 0, W, H)
      o.globalCompositeOperation = 'multiply'
      o.fillStyle = '#00ffff'
      o.fillRect(0, 0, W, H)
      o.globalCompositeOperation = 'lighter'
      o.drawImage(ch.canvas, off, Math.round(off / 2))
      o.globalCompositeOperation = 'source-over'
    }
    if (this.invert > 0) {
      o.globalCompositeOperation = 'difference'
      o.fillStyle = '#ffffff'
      o.fillRect(0, 0, W, H)
      o.globalCompositeOperation = 'source-over'
    }
    o.drawImage(this.vignette, 0, 0)
    if (this.timeScale < 1) { o.fillStyle = 'rgba(70,30,140,0.18)'; o.fillRect(0, 0, W, H) }
  }

  private drawFighter(c: CanvasRenderingContext2D, fi: Fighter) {
    const glow = fi.rage >= 1 ? '#ffd23f' : fi.rage > 0.5 ? '#ff8a3d' : undefined
    const img = fighterFrame(fi.avatar, fi.pose, { white: fi.flash > 0, glow })
    const x = Math.round(fi.x), y = Math.round(GROUND + fi.y)
    fi.ghosts.forEach(([gx, gy], k) => {
      c.save()
      c.globalAlpha = 0.45 - k * 0.1
      c.translate(Math.round(gx), Math.round(GROUND + gy))
      if (fi.side === 'right') c.scale(-1, 1)
      c.drawImage(fighterFrame(fi.avatar, fi.pose, { white: true }), -34, -66)
      c.restore()
    })
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.fillRect(x - 18, GROUND - 1, 36, 3)
    c.fillRect(x - 12, GROUND + 2, 24, 1)
    c.save()
    c.translate(x, y)
    if (fi.side === 'right') c.scale(-1, 1)
    c.drawImage(img, -34, -66)
    c.restore()
  }

  /** ellipsize to max px width at 12px */
  private fit(s: string, max: number): string {
    const c = this.ctx
    c.font = `${this.fw}12px ${FONT}`
    if (c.measureText(s).width <= max) return s
    let t = [...s]
    while (t.length > 1 && c.measureText(t.join('') + '…').width > max) t = t.slice(0, -1)
    return t.join('').trimEnd() + '…'
  }

  private text(s: string, x: number, y: number, color: string, size: 12 | 24, align: CanvasTextAlign = 'center') {
    const c = this.ctx
    c.font = `${this.fw}${size}px ${FONT}`
    c.textAlign = align
    c.textBaseline = 'top'
    const o = size === 24 ? 2 : 1
    c.fillStyle = '#120a1e'
    const ring = this.fw ? [[-o, 0], [o, 0], [0, -o], [0, o], [o, o], [-o, -o], [o, -o], [-o, o]] : [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]
    for (const [dx, dy] of ring) c.fillText(s, x + dx, y + dy)
    c.fillStyle = color
    c.fillText(s, x, y)
  }

  private bar(x: number, y: number, w: number, h: number, v: number, lag: number, col: string, mirror: boolean) {
    const c = this.ctx
    c.fillStyle = '#120a1e'; c.fillRect(x - 2, y - 2, w + 4, h + 4)
    c.fillStyle = '#f4ead2'; c.fillRect(x - 1, y - 1, w + 2, h + 2)
    c.fillStyle = '#2a1f3a'; c.fillRect(x, y, w, h)
    const fillW = (t: number) => Math.round(w * Math.max(0, Math.min(1, t)))
    const lw = fillW(lag), vw = fillW(v)
    c.fillStyle = '#ffffff'
    c.fillRect(mirror ? x + w - lw : x, y, lw, h)
    c.fillStyle = col
    c.fillRect(mirror ? x + w - vw : x, y, vw, h)
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.fillRect(mirror ? x + w - vw : x, y, vw, 1)
    c.fillStyle = '#120a1e'
    for (let k = 1; k < 10; k++) c.fillRect(x + Math.round((w * k) / 10), y, 1, h)
  }

  private drawHud(c: CanvasRenderingContext2D) {
    const BW = 128, PY = 6
    // top plate
    c.fillStyle = 'rgba(8,4,18,0.55)'
    c.fillRect(0, 0, W, 50)
    c.fillStyle = 'rgba(255,210,63,0.25)'
    c.fillRect(0, 50, W, 1)
    for (const side of ['left', 'right'] as Side[]) {
      const fi = this.f[side]
      const m = side === 'right'
      // portrait frame (bevelled, gold rivets)
      const px = m ? W - 6 - 30 : 6
      c.fillStyle = '#120a1e'; c.fillRect(px - 1, PY - 1, 32, 32)
      c.fillStyle = m ? '#7a1f3a' : '#1f3a7a'; c.fillRect(px, PY, 30, 30)
      c.fillStyle = m ? '#c23a4a' : '#3f6fd8'; c.fillRect(px, PY, 30, 2)
      c.save()
      c.beginPath(); c.rect(px + 1, PY + 1, 28, 28); c.clip()
      c.translate(px + 15, PY + 44)
      if (m) c.scale(-1, 1)
      const face = fighterFrame(fi.avatar, fi.hp <= 0 ? 'hurt' : fi.pose === 'hurt' ? 'hurt' : 'idle0')
      c.drawImage(face, -34, -66)
      c.restore()
      c.fillStyle = '#ffd23f'
      for (const [rx, ry] of [[px - 1, PY - 1], [px + 29, PY - 1], [px - 1, PY + 29], [px + 29, PY + 29]]) c.fillRect(rx, ry, 2, 2)
      // HP bar with bevelled frame
      const bx = m ? px - 6 - BW : px + 36
      const hpCol = fi.hp > 50 ? '#4ade80' : fi.hp > 25 ? '#ffd23f' : '#ff4d5e'
      this.bar(bx, PY + 15, BW, 9, fi.hp / 100, fi.lagHp / 100, hpCol, m)
      this.bar(m ? bx + BW - 84 : bx, PY + 28, 84, 3, fi.rage, fi.rage, fi.rage >= 1 ? '#ffd23f' : '#ff8a3d', m)
      this.bar(m ? bx + BW - 52 : bx, PY + 35, 52, 2, fi.momentum, fi.momentum, '#7ef0ff', m)
      this.text(this.fit(fi.name, BW - 24), m ? bx + BW : bx, PY, '#ffffff', 12, m ? 'right' : 'left')
      this.text(String(Math.round(fi.hp)), m ? bx + 2 : bx + BW - 2, PY, hpCol, 12, m ? 'left' : 'right')
    }
    // centre: timer + round pips
    const tx = W / 2
    c.fillStyle = '#120a1e'; c.fillRect(tx - 15, PY - 1, 30, 24)
    c.fillStyle = '#2a1f4a'; c.fillRect(tx - 14, PY, 28, 22)
    c.fillStyle = '#ffd23f'; c.fillRect(tx - 14, PY, 28, 1)
    const secs = Math.max(0, 99 - Math.floor(this.clock / 60) * 3)
    this.text(String(secs).padStart(2, '0'), tx, PY + 5, secs < 30 ? '#ff5a7a' : '#ffffff', 12)
    const n = Math.max(1, this.roundTotal)
    for (let k = 0; k < n; k++) {
      const x = tx - (n * 7) / 2 + k * 7 + 1
      c.fillStyle = '#120a1e'; c.fillRect(x - 1, PY + 25, 6, 6)
      c.fillStyle = k < this.roundNo - 1 ? '#ffd23f' : k === this.roundNo - 1 ? (this.tick % 30 < 15 ? '#ffffff' : '#ffd23f') : '#3a2f5a'
      c.fillRect(x, PY + 26, 4, 4)
    }
  }

  private drawCutin(c: CanvasRenderingContext2D) {
    const ci = this.cutin!
    const t = ci.t
    const fi = this.f[ci.side]
    const left = ci.side === 'left'
    const pal = palette(fi.avatar)
    const inT = Math.min(1, t / 8), outT = t > 44 ? (t - 44) / 10 : 0
    c.save()
    c.fillStyle = `rgba(6,2,14,${0.7 * inT})`
    c.fillRect(0, 0, W, H)
    // slanted band
    const slide = (1 - inT) * W * (left ? -1 : 1) + outT * W * (left ? 1 : -1)
    const y0 = 52, y1 = 168
    c.translate(slide, 0)
    c.beginPath()
    c.moveTo(-20, y0 + 16); c.lineTo(W + 20, y0 - 10); c.lineTo(W + 20, y1 - 16); c.lineTo(-20, y1 + 10); c.closePath()
    c.fillStyle = pal[2]
    c.fill()
    c.save()
    c.clip()
    // manga speed lines + halftone
    c.fillStyle = pal[1]
    for (let k = 0; k < 26; k++) {
      const yy = y0 + ((k * 37 + t * 3) % (y1 - y0 + 20)) - 10
      const xx = ((k * 53 + t * 22 * (left ? 1 : -1)) % (W + 120)) - 60
      c.fillRect(Math.round(xx), Math.round(yy), 40 + (k % 5) * 14, 1 + (k % 3 === 0 ? 1 : 0))
    }
    c.fillStyle = 'rgba(255,255,255,0.12)'
    for (let yy = y0 - 10; yy < y1 + 10; yy += 6) for (let xx = (yy / 6) % 2 ? 3 : 0; xx < W; xx += 6) c.fillRect(xx, yy, 2, 2)
    // close-up: attack frame at 3×, nudged so the face fills the band
    const img = fighterFrame(fi.avatar, 'attack1')
    c.imageSmoothingEnabled = false
    c.translate(left ? 104 : W - 104, 196)
    if (!left) c.scale(-1, 1)
    c.drawImage(img, -34 * 3.4, -66 * 3.4, 68 * 3.4, 68 * 3.4)
    c.restore()
    // band borders
    c.fillStyle = '#ffffff'
    c.beginPath(); c.moveTo(-20, y0 + 16); c.lineTo(W + 20, y0 - 10); c.lineTo(W + 20, y0 - 7); c.lineTo(-20, y0 + 19); c.fill()
    c.beginPath(); c.moveTo(-20, y1 + 10); c.lineTo(W + 20, y1 - 16); c.lineTo(W + 20, y1 - 13); c.lineTo(-20, y1 + 13); c.fill()
    c.restore()
    if (t > 6 && t < 50) {
      const tx = left ? W - 18 : 18
      const pop = t < 12 ? (12 - t) * 3 : 0
      // SUPER tag + move name (wrapped)
      c.fillStyle = '#ff2e5a'
      c.fillRect(left ? tx - 70 : tx, 64 - pop, 70, 18)
      this.text(this.labels.super, left ? tx - 35 : tx + 35, 66 - pop, '#ffffff', 12)
      c.font = `${this.fw}24px ${FONT}`
      let lines = [ci.text]
      if (c.measureText(ci.text).width > 230) { const m = ci.text.match(/^(.+?[·:：])\s*(.+)$/); if (m) lines = [m[1], m[2]] }
      if (lines.every((l) => c.measureText(l).width <= 250)) {
        const ax = left ? W - 14 : 14
        lines.forEach((l, k) => { const sh = t < 14 ? (14 - t - k * 2) * 12 * (left ? 1 : -1) : 0; this.text(l, ax + Math.max(0, sh), 92 + k * 28, k ? '#ffd23f' : '#ffffff', 24, left ? 'right' : 'left') })
      } else this.bubble(ci.text, tx, 100, 190, '#ffffff', '#120a1e', left ? 'right' : 'left')
    }
  }

  /** pixel speech box; wraps CJK by char and latin by word, max width mw */
  private bubble(text: string, x: number, y: number, mw: number, fg: string, bg: string, align: 'left' | 'right' | 'center') {
    const c = this.ctx
    c.font = `${this.fw}12px ${FONT}`
    const lines: string[] = []
    let cur = ''
    const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter
    const tokens = /[\u0e00-\u0e7f]/.test(text) && Seg
      ? [...new Seg('th', { granularity: 'word' }).segment(text)].map((x) => x.segment)
      : /[\u3000-\u9fff]/.test(text) ? [...text] : text.split(/(?<=\s)/)
    for (let i = tokens.length - 1; i > 0; i--) if (/^[\s”"!?！？。…)」]+$/.test(tokens[i])) { tokens[i - 1] += tokens[i]; tokens.splice(i, 1) }
    for (const t of tokens) {
      if (c.measureText(cur + t).width > mw && cur) { lines.push(cur.trim()); cur = t } else cur += t
    }
    if (cur.trim()) lines.push(cur.trim())
    const w = Math.min(mw, Math.max(...lines.map((l) => c.measureText(l).width))) + 10
    const lh = this.fw ? 16 : 14
    const h = lines.length * lh + 6
    const bx = Math.round(align === 'left' ? x : align === 'right' ? x - w : x - w / 2)
    c.fillStyle = '#120a1e'; c.fillRect(bx - 1, y - 1, w + 2, h + 2)
    c.fillStyle = bg; c.fillRect(bx, y, w, h)
    c.fillStyle = '#120a1e'; c.fillRect(bx + 1, y + h - 1, w - 2, 1)
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.fillStyle = fg
    lines.forEach((l, i) => c.fillText(l, Math.round(bx + w / 2), y + 3 + i * lh))
  }

  private drawCallout(_c: CanvasRenderingContext2D) {
    const co = this.callout!
    if (co.t > 80) return
    const slide = co.t < 6 ? (6 - co.t) * 20 : 0
    const left = co.side === 'left'
    this.bubble(co.text, left ? 8 - slide : W - 8 + slide, 52, 220, '#ffd23f', '#3a1030', left ? 'left' : 'right')
  }

  private drawBanner(c: CanvasRenderingContext2D) {
    const b = this.banner!
    const t = b.t
    const slide = t < 10 ? (10 - t) * 30 : t > 58 ? -(t - 58) * 30 : 0
    c.fillStyle = 'rgba(10,6,20,0.72)'
    c.fillRect(0, 76, W, 52)
    c.fillStyle = '#ffd23f'
    c.fillRect(0, 76, W, 2); c.fillRect(0, 126, W, 2)
    this.text(b.text, W / 2 + slide, 80, '#ffd23f', 24)
    if (b.sub) this.text(b.sub, W / 2 - slide, 108, '#ffffff', 12)
  }

  private drawIntro(c: CanvasRenderingContext2D) {
    const t = this.intro!.t
    const p = this.intro!.pLeft
    c.fillStyle = 'rgba(8,4,18,0.82)'
    c.fillRect(0, 0, W, H)
    // diagonal split panels
    const slide = Math.max(0, 24 - t) * 10
    c.fillStyle = '#2f5fbf'
    c.beginPath(); c.moveTo(-slide, 0); c.lineTo(W / 2 + 20 - slide, 0); c.lineTo(W / 2 - 20 - slide, H); c.lineTo(-slide, H); c.fill()
    c.fillStyle = '#c23a4a'
    c.beginPath(); c.moveTo(W / 2 + 20 + slide, 0); c.lineTo(W + slide, 0); c.lineTo(W + slide, H); c.lineTo(W / 2 - 20 + slide, H); c.fill()
    for (const side of ['left', 'right'] as Side[]) {
      const fi = this.f[side]
      const img = fighterFrame(fi.avatar, 'taunt')
      const cx = side === 'left' ? 96 - slide : W - 96 + slide
      c.save()
      c.translate(cx, 160)
      if (side === 'right') c.scale(-2, 2); else c.scale(2, 2)
      c.drawImage(img, -34, -66)
      c.restore()
      this.text(fi.name, cx, 162, '#ffffff', 12)
      this.text(fi.title, cx, 176, '#ffd23f', 12)
      if (fi.intro && t > (side === 'left' ? 40 : 75)) this.bubble(`“${fi.intro}”`, side === 'left' ? 6 : W - 6, side === 'left' ? 8 : 30, 150, '#14121c', '#fff6dc', side === 'left' ? 'left' : 'right')
    }
    if (t > 18) {
      const s = t < 26 ? 24 : 24
      const j = t < 30 ? Math.round((Math.random() - 0.5) * 6) : 0
      this.text('VS', W / 2 + j, 60 + j, '#ffffff', s)
    }
    if (t > 34) {
      const pl = Math.round(p * 100)
      const bw = 200, x = W / 2 - bw / 2, y = 206
      const grow = Math.min(1, (t - 34) / 20)
      c.fillStyle = '#120a1e'; c.fillRect(x - 1, y - 1, bw + 2, 6)
      c.fillStyle = '#4a8aff'; c.fillRect(x, y, Math.round(bw * p * grow), 4)
      c.fillStyle = '#ff5a7a'; c.fillRect(x + bw - Math.round(bw * (1 - p) * grow), y, Math.round(bw * (1 - p) * grow), 4)
      this.text(`${pl}%`, x - 6, 200, '#9ec0ff', 12, 'right')
      this.text(`${100 - pl}%`, x + bw + 6, 200, '#ffb0c0', 12, 'left')
    }
  }

  private drawVictory(c: CanvasRenderingContext2D) {
    const v = this.victory!
    const t = v.t
    const a = Math.min(1, t / 12)
    c.globalAlpha = a * 0.78
    c.fillStyle = '#0a0614'
    c.fillRect(0, 0, W, H)
    c.globalAlpha = 1
    if (v.side) {
      const fi = this.f[v.side]
      // rotating rays
      c.save()
      c.translate(W / 2, 112)
      c.rotate(t * 0.01)
      c.globalAlpha = 0.25 * a
      c.fillStyle = '#ffd23f'
      for (let k = 0; k < 12; k++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(260, -22); c.lineTo(260, 22); c.fill() }
      c.restore()
      c.globalAlpha = 1
      const bounce = Math.round(Math.abs(Math.sin(t * 0.08)) * -4)
      const sc = Math.min(2.4, 1 + t * 0.12)
      const img = fighterFrame(fi.avatar, 'win', { glow: '#ffd23f' })
      c.save()
      c.translate(W / 2, 140 + bounce)
      c.scale(fi.side === 'right' ? -sc / 1.5 : sc / 1.5, sc / 1.5)
      c.drawImage(img, -34, -66)
      c.restore()
      const word = [...this.labels.winnerWord]
      c.font = `${this.fw}24px ${FONT}`
      const ws = word.map((ch) => c.measureText(ch).width + 2)
      let wx = W / 2 - ws.reduce((a, b) => a + b, 0) / 2
      // scripts with combining marks (th/hi) drop in as one word
      const joined = this.labels.locale === 'th' || this.labels.locale === 'hi'
      for (let k = 0; k < (joined ? 1 : word.length); k++) {
        const lt = t - 8 - k * 3
        if (lt >= 0) {
          const drop = Math.max(0, 12 - lt) * 4
          if (joined) this.text(word.join(''), W / 2, 14 - drop, '#ffd23f', 24)
          else this.text(word[k], wx + ws[k] / 2, 14 - drop, k % 2 ? '#ffd23f' : '#ffffff', 24)
        }
        wx += ws[k]
      }
      if (t > 30) this.text(this.labels.winner(fi.name), W / 2, 44, '#ffffff', 12)
      if (t > 34) this.text(fi.title, W / 2, 146, '#ffd23f', 12)
      if (t > 24 && fi.winLine) this.bubble(`“${fi.winLine}”`, W - 6, 62, 104, '#14121c', '#fff6dc', 'right')
    } else {
      this.text(this.labels.draw, W / 2, 40, '#ffffff', 24)
    }
    if (t > 40) v.stats.forEach((s, i) => { if (t > 40 + i * 8) this.text(s, W / 2, 162 + i * 15, '#e8e0ff', 12) })
  }
}
