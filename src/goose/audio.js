const FILES = {
  throw: '/goose/sfx-throw.mp3',
  hitMat: '/goose/sfx-hit-mat.wav',
  honk: '/goose/sfx-honk.wav',
  honkAngry: '/goose/sfx-honk-angry.wav',
  honkMiss: '/goose/sfx-honk-miss.mp3',
  honkCatch: '/goose/sfx-honk-catch.mp3',
  bell: '/goose/sfx-bell.wav',
  catchSting: '/goose/sfx-catch-sting.wav',
  treasure: '/goose/sfx-treasure.wav',
  missSting: '/goose/sfx-miss-sting.wav',
  amb: '/goose/amb-market.wav',
}

const BGM = {
  story: '/goose/bgm-story.mp3',
  endless: '/goose/bgm-endless.mp3',
  boss: '/goose/bgm-boss.wav',
}

export function createGooseAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const master = ctx.createGain()
  const sfxG = ctx.createGain()
  master.gain.value = 1
  sfxG.gain.value = 1.25
  sfxG.connect(master)
  master.connect(ctx.destination)

  const bgm = new Audio()
  bgm.loop = true
  bgm.preload = 'auto'
  bgm.playsInline = true
  bgm.autoplay = true
  bgm.setAttribute('autoplay', '')
  bgm.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(bgm)
  let duckTimer = 0
  let armed = false

  const raw = {}
  const buffers = {}
  let unlocked = false
  let muted = false
  let theme = 'stall'
  let mode = 'story'
  let lastRing = false
  let decoding = null
  const lastPlay = new Map()
  const queued = []

  const loadPromise = Promise.all(
    Object.entries(FILES).map(async ([key, src]) => {
      try {
        const res = await fetch(src)
        if (!res.ok) return
        raw[key] = await res.arrayBuffer()
      } catch { /* wav optional */ }
    }),
  )

  function decodeAll() {
    if (decoding) return decoding
    decoding = loadPromise.then(() => Promise.all(
      Object.keys(raw).map(async (key) => {
        if (buffers[key] || !raw[key]) return
        try {
          const copy = raw[key].slice(0)
          buffers[key] = await ctx.decodeAudioData(copy)
        } catch { /* keep synth fallback */ }
      }),
    ))
    return decoding
  }

  function pickBgmSrc() {
    if (theme === 'boss') return BGM.boss
    if (mode === 'endless') return BGM.endless
    return BGM.story
  }

  function bgmLevel() {
    return (theme === 'boss' ? 0.28 : 0.38) * (lastRing ? 0.8 : 1)
  }

  function applyBgm() {
    const src = pickBgmSrc()
    if (bgm.dataset.src !== src) {
      bgm.dataset.src = src
      bgm.src = src
    }
    bgm.loop = true
    bgm.volume = muted ? 0 : bgmLevel()
    if (muted) {
      bgm.pause()
      return
    }
    const p = bgm.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }

  function armAutoplay() {
    if (armed) return
    armed = true
    const kick = () => {
      unlock()
      applyBgm()
    }
    kick()
    const once = () => {
      window.removeEventListener('pointerdown', once, true)
      window.removeEventListener('keydown', once, true)
      window.removeEventListener('touchstart', once, true)
      kick()
    }
    window.addEventListener('pointerdown', once, true)
    window.addEventListener('keydown', once, true)
    window.addEventListener('touchstart', once, { capture: true, passive: true })
  }

  function unlock() {
    const go = () => {
      unlocked = ctx.state !== 'suspended'
      if (!unlocked) return
      decodeAll().then(() => flushQueue())
    }
    try {
      const p = ctx.resume()
      if (p && typeof p.then === 'function') p.then(go).catch(go)
      else go()
    } catch {
      go()
    }
    applyBgm()
  }

  function flushQueue() {
    const jobs = queued.splice(0)
    for (const job of jobs) play(job.key, job.opts)
  }

  function play(key, opts = {}) {
    const { volume = 1, pan = 0, rate = 1, throttle = 0, vary = false } = opts
    if (muted) return
    if (!unlocked) {
      queued.push({ key, opts })
      unlock()
      return
    }
    const buf = buffers[key]
    if (!buf) {
      if (key === 'honk' || key === 'honkAngry') synthHonk(key === 'honkAngry', volume, pan)
      else if (key === 'treasure') synthTreasure()
      return
    }
    const now = performance.now()
    if (throttle > 0 && now - (lastPlay.get(key) || 0) < throttle) return
    lastPlay.set(key, now)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = vary ? rate * (0.97 + Math.random() * 0.06) : rate
    const g = ctx.createGain()
    g.gain.value = volume
    src.connect(g)
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = clamp(pan, -1, 1)
      g.connect(p)
      p.connect(sfxG)
    } else {
      g.connect(sfxG)
    }
    src.start()
  }

  function honkSyllable(when, f0, dur, volume) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(f0, when)
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, f0 * 0.5), when + dur)

    const sub = ctx.createOscillator()
    sub.type = 'square'
    sub.frequency.setValueAtTime(f0 * 0.5, when)
    sub.frequency.exponentialRampToValueAtTime(Math.max(70, f0 * 0.25), when + dur)

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2.8
    bp.frequency.setValueAtTime(1250, when)
    bp.frequency.exponentialRampToValueAtTime(720, when + dur)

    const peak = ctx.createBiquadFilter()
    peak.type = 'peaking'
    peak.frequency.value = 1750
    peak.Q.value = 1.1
    peak.gain.value = 12

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(volume, when + 0.016)
    g.gain.exponentialRampToValueAtTime(volume * 0.72, when + dur * 0.42)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)

    osc.connect(bp)
    sub.connect(bp)
    bp.connect(peak)
    peak.connect(g)
    g.connect(sfxG)
    osc.start(when)
    sub.start(when)
    osc.stop(when + dur + 0.03)
    sub.stop(when + dur + 0.03)
  }

  function flutter(when, dur, volume) {
    const n = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate)
    const data = n.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = n
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(volume, when + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(sfxG)
    src.start(when)
    src.stop(when + dur + 0.02)
  }

  function synthHonk(angry, volume = 1, pan = 0) {
    if (muted) return
    void pan
    const fire = () => {
      const t = ctx.currentTime
      if (angry) {
        honkSyllable(t, 560, 0.2, volume)
        honkSyllable(t + 0.19, 410, 0.32, volume * 1.05)
        flutter(t + 0.02, 0.55, volume * 0.22)
      } else {
        honkSyllable(t, 500, 0.28, volume)
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(fire).catch(fire)
      return
    }
    fire()
  }

  function duckMusic(to = 0.12, hold = 0.7, back = 0.55) {
    if (muted) return
    const base = bgmLevel()
    bgm.volume = Math.max(0.02, base * to)
    window.clearTimeout(duckTimer)
    duckTimer = window.setTimeout(() => {
      if (!muted) bgm.volume = bgmLevel()
    }, (hold + back) * 1000)
  }

  function ding(when, f, dur, vol) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f, when)
    osc.frequency.exponentialRampToValueAtTime(f * 0.92, when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g)
    g.connect(sfxG)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  function catchFanfare() {
    unlock()
    play('treasure', { volume: 1, throttle: 0 })
    play('bell', { volume: 0.42, throttle: 0 })
    duckMusic(0.08, 1.7, 0.75)
  }

  function synthTreasure() {
    if (muted || !unlocked) return
    const t = ctx.currentTime
    const notes = [523.25, 659.26, 783.99, 1046.5, 1318.51]
    notes.forEach((f, i) => ding(t + i * 0.08, f, 0.28 + i * 0.04, 0.42 - i * 0.04))
    ding(t + 0.36, 1568, 0.7, 0.38)
    ding(t + 0.4, 2093, 0.55, 0.22)
  }

  function missSting() {
    unlock()
    play('missSting', { volume: 0.5, throttle: 180 })
    duckMusic(0.45, 0.35, 0.4)
  }

  function setLastRing(on) {
    lastRing = !!on
    if (!muted) bgm.volume = bgmLevel()
  }

  function setTheme(next) {
    const name = next === 'boss' ? 'boss' : 'stall'
    if (name === theme) return
    theme = name
    applyBgm()
  }

  function setMode(next) {
    const name = next === 'endless' ? 'endless' : 'story'
    if (name === mode) return
    mode = name
    applyBgm()
  }

  function setMuted(on) {
    muted = on
    master.gain.value = on ? 0 : 1
    applyBgm()
  }

  return {
    unlock,
    play,
    startBed: applyBgm,
    armAutoplay,
    setMuted,
    isMuted: () => muted,
    setLastRing,
    setTheme,
    setMode,
    catchFanfare,
    missSting,
    playThrow() {
      unlock()
      play('throw', { volume: 0.8, throttle: 160 })
    },
    honkMiss(pan) {
      unlock()
      play('honkMiss', { volume: 1, pan, throttle: 2400 })
    },
    honkCatch() {
      unlock()
      play('honkCatch', { volume: 1, throttle: 0 })
    },
    honkDuck(pan) {
      unlock()
      synthHonk(false, 0.72, pan)
      play('honk', { volume: 0.7, pan, throttle: 90, vary: true })
    },
    hit(kind, speed, x) {
      if (speed < 0.4) return
      const vol = clamp(speed / 5, 0.28, 1)
      const pan = clamp(x / 1.5, -1, 1)
      if (kind === 'goose') {
        synthHonk(false, vol, pan)
        play('honk', { volume: vol, pan, throttle: 300, vary: true })
      } else if (kind === 'mat') play('hitMat', { volume: vol * 0.35, pan, throttle: 80, vary: true })
    },
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
