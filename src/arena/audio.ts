/**
 * 8-bit synth + original chiptune battle theme on WebAudio.
 * Everything is scheduled through `Out` so the same code can play live
 * (AudioContext) or render offline (OfflineAudioContext, used for videos).
 * Starts muted; the widget turns it on after the first user gesture on /arena/ (homepage embed stays muted).
 */
export type Out = { ctx: BaseAudioContext; sfx: AudioNode; music: AudioNode }

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let enabled = false
let musicOn = true
const LIVE_MUSIC_VOL = 0.32
const LIVE_SFX_VOL = 0.75

/** event log for offline re-rendering (only when ?rec=1) */
export const audioLog: { name: string; at: number; arg?: string }[] = []
const rec = typeof location !== 'undefined' && new URLSearchParams(location.search).has('rec')
function log(name: string, arg?: string) { if (rec && audioLog.length < 4000) audioLog.push({ name, at: performance.now(), arg }) }

function live(): Out | null {
  if (!enabled || !ctx || !sfxBus || !musicBus) return null
  return { ctx, sfx: sfxBus, music: musicBus }
}

export function setSound(on: boolean) {
  enabled = on
  if (on && !ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AC) {
      ctx = new AC()
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
      musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? LIVE_MUSIC_VOL : 0; musicBus.connect(master)
      sfxBus = ctx.createGain(); sfxBus.gain.value = LIVE_SFX_VOL; sfxBus.connect(master)
    }
  }
  if (on) { void ctx?.resume(); if (player.wanted && !player.running) player.begin() }
  else { void ctx?.suspend() }
}
export const soundOn = () => enabled
/** 窗口销毁时调用：停掉音乐调度并关闭 AudioContext，避免销毁后仍在发声、重挂载后两套叠加。 */
export function shutdownAudio() {
  enabled = false
  player.wanted = false
  player.halt()
  const c = ctx
  ctx = master = musicBus = sfxBus = null
  if (c && c.state !== 'closed') void c.close()
}
export function setMusic(on: boolean) {
  musicOn = on
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? LIVE_MUSIC_VOL : 0, ctx.currentTime, 0.05)
}
export const musicEnabled = () => musicOn

// ---------------------------------------------------------------- primitives
const waves = new WeakMap<BaseAudioContext, Record<string, PeriodicWave>>()
function pulse(c: BaseAudioContext, duty: number): PeriodicWave {
  let m = waves.get(c)
  if (!m) { m = {}; waves.set(c, m) }
  const k = String(duty)
  if (!m[k]) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n)
    for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * 2
    m[k] = c.createPeriodicWave(re, im)
  }
  return m[k]
}
const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseBuf(c: BaseAudioContext) {
  let b = noiseBufs.get(c)
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = b.getChannelData(0)
    let v = 0
    for (let i = 0; i < d.length; i++) { if (i % 4 === 0) v = Math.random() * 2 - 1; d[i] = v }
    noiseBufs.set(c, b)
  }
  return b
}
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)

type Wave = OscillatorType | number // number = pulse duty
function osc(o: Out, dest: AudioNode, t: number, wave: Wave, from: number, to: number, dur: number, vol: number, attack = 0.004) {
  const c = o.ctx
  const s = c.createOscillator()
  if (typeof wave === 'number') s.setPeriodicWave(pulse(c, wave)); else s.type = wave
  s.frequency.setValueAtTime(from, t)
  if (to !== from) s.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(g).connect(dest)
  s.start(t)
  s.stop(t + dur + 0.03)
}
function hiss(o: Out, dest: AudioNode, t: number, dur: number, vol: number, hp = 0, lp = 0) {
  const c = o.ctx
  const s = c.createBufferSource()
  s.buffer = noiseBuf(c)
  let node: AudioNode = s
  if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f }
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f }
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  node.connect(g).connect(dest)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.02)
}

// ---------------------------------------------------------------- sound effects
type Sfx = (o: Out, t: number) => void
export const SFX: Record<string, Sfx> = {
  swing: (o, t) => { hiss(o, o.sfx, t, 0.12, 0.25, 1800); osc(o, o.sfx, t, 0.25, 900, 260, 0.1, 0.08) },
  hit: (o, t) => { hiss(o, o.sfx, t, 0.14, 0.4, 0, 3000); osc(o, o.sfx, t, 'square', 220, 70, 0.14, 0.14) },
  crit: (o, t) => { hiss(o, o.sfx, t, 0.4, 0.5, 0, 2200); osc(o, o.sfx, t, 'sawtooth', 180, 35, 0.4, 0.2); osc(o, o.sfx, t, 'sine', 90, 30, 0.45, 0.5) },
  block: (o, t) => { osc(o, o.sfx, t, 0.5, 1800, 1400, 0.06, 0.1); osc(o, o.sfx, t + 0.03, 'triangle', 2400, 2000, 0.1, 0.08) },
  parry: (o, t) => { osc(o, o.sfx, t, 0.125, 2600, 1900, 0.08, 0.12); osc(o, o.sfx, t + 0.04, 0.5, 1300, 900, 0.14, 0.08); hiss(o, o.sfx, t, 0.06, 0.25, 3000) },
  text: (o, t) => { osc(o, o.sfx, t, 0.25, 660, 660, 0.06, 0.07); osc(o, o.sfx, t + 0.06, 0.25, 990, 990, 0.08, 0.07) },
  cheer: (o, t) => { osc(o, o.sfx, t, 0.5, 523, 523, 0.05, 0.06); osc(o, o.sfx, t + 0.05, 0.5, 784, 784, 0.07, 0.06) },
  beam: (o, t) => { osc(o, o.sfx, t, 'sawtooth', 80, 1200, 0.9, 0.12); hiss(o, o.sfx, t, 1, 0.3, 400) },
  charge: (o, t) => { osc(o, o.sfx, t, 0.125, 120, 900, 0.5, 0.06); hiss(o, o.sfx, t, 0.5, 0.06, 4000) },
  vs: (o, t) => { hiss(o, o.sfx, t, 0.4, 0.3, 0, 1500); osc(o, o.sfx, t, 'sawtooth', 110, 45, 0.5, 0.16); osc(o, o.sfx, t, 'sine', 60, 40, 0.6, 0.5) },
  guard: (o, t) => { hiss(o, o.sfx, t, 0.2, 0.35); osc(o, o.sfx, t, 'square', 300, 90, 0.25, 0.12) },
  ko: (o, t) => { osc(o, o.sfx, t, 'triangle', 400, 50, 0.7, 0.2); hiss(o, o.sfx, t, 0.6, 0.2, 0, 900) },
  cutin: (o, t) => {
    hiss(o, o.sfx, t, 0.35, 0.35, 2500)
    for (const m of [57, 64, 69, 72]) osc(o, o.sfx, t + 0.12, 0.25, mtof(m), mtof(m), 0.5, 0.05)
    osc(o, o.sfx, t + 0.12, 'sine', 70, 40, 0.5, 0.4)
  },
  // signature move layers
  sig_knight: (o, t) => [0, 0.05, 0.1].forEach((d, i) => osc(o, o.sfx, t + d, 'triangle', mtof(84 + i * 4), mtof(84 + i * 4), 0.4, 0.08)),
  sig_dragon: (o, t) => { osc(o, o.sfx, t, 0.5, 1400, 300, 0.08, 0.12); osc(o, o.sfx, t + 0.07, 0.5, 1400, 300, 0.08, 0.12); hiss(o, o.sfx, t + 0.1, 0.25, 0.3, 0, 1200) },
  sig_mage: (o, t) => { for (let i = 0; i < 6; i++) osc(o, o.sfx, t + i * 0.035, 0.125, mtof(88 + ((i * 5) % 12)), mtof(88 + ((i * 5) % 12)), 0.12, 0.05) },
  sig_mech: (o, t) => { osc(o, o.sfx, t, 'sine', 40, 400, 0.5, 0.4); osc(o, o.sfx, t, 'sawtooth', 60, 30, 0.6, 0.12) },
  sig_whale: (o, t) => { hiss(o, o.sfx, t, 0.6, 0.35, 0, 1600); osc(o, o.sfx, t, 'sine', 300, 120, 0.3, 0.2) },
  sig_scholar: (o, t) => { osc(o, o.sfx, t, 0.5, 200, 600, 0.15, 0.1); hiss(o, o.sfx, t + 0.15, 0.45, 0.45, 0, 1000); osc(o, o.sfx, t + 0.15, 'sine', 80, 30, 0.4, 0.5) },
  sig_rabbit: (o, t) => { hiss(o, o.sfx, t, 0.25, 0.3, 5000); osc(o, o.sfx, t, 'triangle', 1600, 2400, 0.3, 0.07) },
  sig_fox: (o, t) => { for (let i = 0; i < 5; i++) osc(o, o.sfx, t + i * 0.03, 'sawtooth', 2000 - i * 200, 200, 0.05, 0.08); hiss(o, o.sfx, t, 0.3, 0.25, 3000) },
}
export function sfx(name: string) {
  log('sfx', name)
  const o = live()
  if (o) SFX[name]?.(o, o.ctx.currentTime + 0.005)
}

// ---------------------------------------------------------------- music: “Pixel Arena Overdrive” (original)
export const BPM = 160
const STEP = 60 / BPM / 4
type Bar = { chord: number[]; lead: string }
// A minor. Chords as MIDI roots+tones; lead: "note:len" in 16ths, "r" = rest
const Am = [45, 57, 60, 64], F = [41, 57, 60, 65], C = [48, 55, 60, 64], Gc = [43, 55, 59, 62], E = [40, 56, 59, 64]
const INTRO: Bar[] = [
  { chord: Am, lead: '' }, { chord: F, lead: '' }, { chord: C, lead: '' }, { chord: Gc, lead: 'r:8 74:2 76:2 79:2 83:2' },
]
const VERSE: Bar[] = [
  { chord: Am, lead: '76:2 76:1 74:1 72:2 74:2 76:4 69:4' },
  { chord: F, lead: '77:2 76:1 74:1 72:2 69:2 72:4 r:4' },
  { chord: C, lead: '79:2 77:1 76:1 74:2 72:2 76:6 r:2' },
  { chord: Gc, lead: '74:2 71:2 67:2 71:2 74:4 79:4' },
  { chord: Am, lead: '81:3 79:1 76:2 74:2 76:4 72:4' },
  { chord: F, lead: '77:2 81:2 79:2 77:2 76:4 74:4' },
  { chord: C, lead: '76:2 72:2 79:4 76:2 72:2 74:4' },
  { chord: Gc, lead: '79:2 81:2 83:4 79:8' },
]
const CHORUS: Bar[] = [
  { chord: Am, lead: '81:3 81:3 79:2 81:4 84:4' },
  { chord: F, lead: '84:3 83:3 81:2 79:4 77:4' },
  { chord: C, lead: '79:3 79:3 77:2 76:4 79:4' },
  { chord: Gc, lead: '83:6 81:2 79:8' },
  { chord: Am, lead: '81:3 81:3 79:2 81:4 84:4' },
  { chord: F, lead: '86:3 84:3 81:2 77:4 81:4' },
  { chord: Gc, lead: '83:3 84:3 86:2 88:8' },
  { chord: E, lead: '88:4 86:4 83:4 80:4' },
]
const SECTIONS: { name: string; bars: Bar[]; energy: number }[] = [
  { name: 'intro', bars: INTRO, energy: 0 },
  { name: 'verse', bars: VERSE, energy: 1 },
  { name: 'chorus', bars: CHORUS, energy: 2 },
]
/** bar index → section/bar; after the intro, verse+chorus loop */
function barAt(i: number): { s: (typeof SECTIONS)[number]; bar: Bar; last: boolean } {
  if (i < INTRO.length) return { s: SECTIONS[0], bar: INTRO[i], last: i === INTRO.length - 1 }
  const j = (i - INTRO.length) % 16
  const s = j < 8 ? SECTIONS[1] : SECTIONS[2]
  return { s, bar: s.bars[j % 8], last: j % 8 === 7 }
}
function parseLead(l: string): Map<number, [number, number]> {
  const m = new Map<number, [number, number]>()
  let pos = 0
  for (const tok of l.split(/\s+/).filter(Boolean)) {
    const [n, len] = tok.split(':')
    if (n !== 'r') m.set(pos, [Number(n), Number(len)])
    pos += Number(len)
  }
  return m
}
const leadCache = new Map<string, Map<number, [number, number]>>()

/** schedule one 16th step of the song (bar i, step k) at time t */
function scheduleStep(o: Out, i: number, k: number, t: number) {
  const { s, bar, last } = barAt(i)
  const d = o.music
  const e = s.energy
  // drums
  const kick = k === 0 || k === 8 || (e === 2 && (k === 10 || k === 14)) || (e === 0 && k === 4 && i > 1) || (e === 0 && k === 12 && i > 1)
  if (kick) { osc(o, d, t, 'sine', 150, 40, 0.16, 0.9); osc(o, d, t, 'square', 90, 40, 0.05, 0.12) }
  if ((k === 4 || k === 12) && (e > 0 || i > 1)) { hiss(o, d, t, 0.13, 0.4, 900); osc(o, d, t, 'triangle', 220, 160, 0.08, 0.2) }
  if (last && k >= 12 && e !== 1) hiss(o, d, t, 0.06, 0.28, 1500) // fill
  if (e > 0 ? true : k % 2 === 0) hiss(o, d, t, k % 2 ? 0.025 : 0.04, e === 2 ? 0.12 : 0.08, 7000)
  // bass (triangle): driving 8ths with octave pops
  if (k % 2 === 0) {
    const root = bar.chord[0]
    const n = [root, root, root + 12, root, root, root + 12, root + 7, root + 12][k / 2]
    osc(o, d, t, 'triangle', mtof(n), mtof(n), STEP * 1.9, 0.5)
  }
  // arpeggio (12.5% pulse)
  const tones = bar.chord.slice(1)
  const an = tones[k % 3] + (Math.floor(k / 3) % 2 ? 12 : 0)
  osc(o, d, t, 0.125, mtof(an), mtof(an), STEP * 0.9, e === 0 ? 0.05 : 0.04)
  // lead (25% / 50% pulse) + echo
  let lm = leadCache.get(bar.lead)
  if (!lm) { lm = parseLead(bar.lead); leadCache.set(bar.lead, lm) }
  const note = lm.get(k)
  if (note) {
    const [m, len] = note
    const dur = STEP * len * 0.92
    osc(o, d, t, e === 2 ? 0.5 : 0.25, mtof(m), mtof(m), dur, 0.11, 0.008)
    if (e === 2) osc(o, d, t, 0.25, mtof(m - 12), mtof(m - 12), dur, 0.04)
    osc(o, d, t + STEP * 3, 0.25, mtof(m), mtof(m), Math.min(dur, STEP * 2), 0.03)
  }
}

/** victory fanfare in A major, 2 bars */
function scheduleFanfare(o: Out, t: number) {
  const d = o.music
  const notes: [number, number][] = [[69, 1], [73, 1], [76, 1], [81, 3], [0, 1], [79, 1], [81, 1], [83, 1], [85, 6]]
  let p = 0
  for (const [m, len] of notes) {
    if (m) { osc(o, d, t + p * STEP, 0.5, mtof(m), mtof(m), STEP * len * 0.95, 0.12); osc(o, d, t + p * STEP, 0.25, mtof(m - 12), mtof(m - 12), STEP * len * 0.95, 0.05) }
    p += len
  }
  for (const [at, root] of [[0, 45], [6, 45], [9, 52], [12, 57]] as const) osc(o, d, t + at * STEP, 'triangle', mtof(root), mtof(root), STEP * 3, 0.5)
  for (const at of [0, 6, 12]) { osc(o, d, t + at * STEP, 'sine', 150, 40, 0.16, 0.9); hiss(o, d, t + at * STEP, 0.3, 0.2, 3000) }
  for (const m of [69, 73, 76, 81]) osc(o, d, t + 12 * STEP, 0.125, mtof(m + 12), mtof(m + 12), STEP * 8, 0.035)
}

/** Live scheduler (lookahead). */
const player = {
  wanted: false,
  running: false,
  bar: 0,
  step: 0,
  next: 0,
  timer: 0 as number | ReturnType<typeof setInterval>,
  begin() {
    const o = live()
    if (!o) return
    this.running = true
    this.bar = 0; this.step = 0
    this.next = o.ctx.currentTime + 0.06
    clearInterval(this.timer as number)
    this.timer = setInterval(() => this.pump(), 40)
    this.pump()
  },
  pump() {
    const o = live()
    if (!o || !this.running) return
    while (this.next < o.ctx.currentTime + 0.18) {
      scheduleStep(o, this.bar, this.step, this.next)
      this.next += STEP
      if (++this.step === 16) { this.step = 0; this.bar++ }
    }
  },
  halt() { this.running = false; clearInterval(this.timer as number) },
}
export const music = {
  start() { log('music', 'start'); player.wanted = true; player.halt(); if (live()) player.begin() },
  /** finisher: hard stop (silence beat), the fanfare follows */
  stop() { log('music', 'stop'); player.wanted = false; player.halt() },
  fanfare() { log('music', 'fanfare'); const o = live(); if (o) scheduleFanfare(o, o.ctx.currentTime + 0.02) },
}

/**
 * Offline render of a recorded session → AudioBuffer (stereo 44.1 kHz).
 * `events[].at` are ms from the start of the render.
 */
export async function renderOffline(events: { name: string; at: number; arg?: string }[], durationMs: number): Promise<AudioBuffer> {
  const sr = 44100
  const c = new OfflineAudioContext(2, Math.ceil((durationMs / 1000) * sr), sr)
  const m = c.createGain(); m.gain.value = 0.9; m.connect(c.destination)
  const mu = c.createGain(); mu.gain.value = LIVE_MUSIC_VOL; mu.connect(m)
  const sf = c.createGain(); sf.gain.value = LIVE_SFX_VOL; sf.connect(m)
  const o: Out = { ctx: c, sfx: sf, music: mu }
  let musicFrom: number | null = null
  const end = durationMs / 1000
  const flushMusic = (until: number) => {
    if (musicFrom === null) return
    let t = musicFrom, n = 0
    while (t < until) { if (t >= 0) scheduleStep(o, Math.floor(n / 16), n % 16, t); t += STEP; n++ }
    musicFrom = null
  }
  for (const e of events) {
    const t = e.at / 1000
    if (t > end) break
    if (e.name === 'sfx' && e.arg) { if (t >= 0) SFX[e.arg]?.(o, t) }
    else if (e.arg === 'start') { flushMusic(t); musicFrom = t }
    else if (e.arg === 'stop') flushMusic(t)
    else if (e.arg === 'fanfare' && t >= 0) scheduleFanfare(o, t)
  }
  flushMusic(end)
  return c.startRendering()
}

/** 16-bit PCM WAV bytes */
export function toWav(b: AudioBuffer): Uint8Array {
  const ch = b.numberOfChannels, n = b.length, sr = b.sampleRate
  const buf = new ArrayBuffer(44 + n * ch * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true)
  const data = [...Array(ch)].map((_, i) => b.getChannelData(i))
  let p = 44
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(p, s * 0x7fff, true); p += 2 }
  return new Uint8Array(buf)
}
