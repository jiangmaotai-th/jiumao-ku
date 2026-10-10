const MUTE_KEY = 'jiumao-idle-tank-mute'
const MUSIC_KEY = 'jiumao-idle-tank-music'
const MUSIC_SRC = '/tank/audio/underwater-bubbles.mp3'

export function createTankAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  let ctx
  let master
  let muted = false
  let musicOn = true
  try { muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* ignore */ }
  try { musicOn = localStorage.getItem(MUSIC_KEY) !== '0' } catch { /* ignore */ }
  let lastBite = 0
  let musicEl = null
  let hidden = false

  function ensure() {
    if (!Ctx) return null
    if (!ctx) {
      ctx = new Ctx()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 1
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  function ensureMusic() {
    if (musicEl) return musicEl
    musicEl = new Audio(MUSIC_SRC)
    musicEl.loop = true
    musicEl.preload = 'auto'
    musicEl.volume = 0.32
    return musicEl
  }

  function syncMusic() {
    const el = ensureMusic()
    const should = !muted && musicOn && !hidden
    if (should) {
      el.volume = 0.32
      const play = el.play()
      if (play && typeof play.catch === 'function') play.catch(() => {})
    } else {
      el.pause()
    }
  }

  function tone(freq, dur, type = 'sine', gain = 0.08, slide = 0) {
    if (muted) return
    const c = ensure()
    if (!c) return
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur)
    g.gain.value = gain
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    osc.connect(g)
    g.connect(master)
    osc.start()
    osc.stop(c.currentTime + dur + 0.02)
  }

  function noise(dur, gain = 0.04) {
    if (muted) return
    const c = ensure()
    if (!c) return
    const n = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
    const data = n.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = c.createBufferSource()
    src.buffer = n
    const g = c.createGain()
    g.gain.value = gain
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start()
  }

  return {
    unlock() {
      ensure()
      syncMusic()
    },
    pop() { tone(880, 0.12, 'sine', 0.07, -420); tone(1320, 0.08, 'triangle', 0.03) },
    drop() { noise(0.18, 0.05); tone(220, 0.16, 'sine', 0.04, -80) },
    bite() {
      const now = performance.now()
      if (now - lastBite < 90) return
      lastBite = now
      tone(640, 0.06, 'square', 0.035, -200)
    },
    buy() { tone(523, 0.1, 'sine', 0.06); tone(784, 0.14, 'sine', 0.05) },
    reveal(quality) {
      const big = quality === 'legend' || quality === 'myth'
      tone(196, 0.55, 'sine', 0.035)
      window.setTimeout(() => tone(247, 0.6, 'sine', 0.04), 420)
      window.setTimeout(() => tone(330, 0.7, 'triangle', 0.045), 980)
      window.setTimeout(() => {
        tone(392, 0.45, 'sine', 0.05)
        noise(0.22, 0.03)
      }, big ? 2100 : 1500)
      window.setTimeout(() => {
        tone(523, 0.4, 'sine', 0.055)
        tone(784, 0.7, 'triangle', 0.045)
      }, big ? 2800 : 2000)
      if (big) {
        window.setTimeout(() => {
          tone(659, 0.5, 'sine', 0.05)
          tone(1046, 0.85, 'triangle', 0.04)
        }, 3600)
      }
    },
    stamp() { tone(392, 0.12, 'triangle', 0.06); tone(587, 0.18, 'sine', 0.04) },
    place() { noise(0.12, 0.045); tone(310, 0.1, 'sine', 0.04) },
    upgrade() { tone(262, 0.16, 'sine', 0.05); tone(392, 0.2, 'sine', 0.05); tone(523, 0.28, 'triangle', 0.04) },
    pump() { noise(0.4, 0.02) },
    isMuted() { return muted },
    isMusicOn() { return musicOn },
    setMuted(value) {
      muted = Boolean(value)
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
      if (master) master.gain.value = muted ? 0 : 1
      syncMusic()
    },
    setMusic(on) {
      musicOn = Boolean(on)
      try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0') } catch { /* ignore */ }
      syncMusic()
    },
    setHidden(value) {
      hidden = Boolean(value)
      syncMusic()
    },
    pulse() {},
  }
}
