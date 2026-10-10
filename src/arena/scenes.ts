/**
 * Parallax stages. Layers are pre-rendered pixel art (procedural, seeded) and
 * picked per leaderboard so each round gets its own place.
 */
export const SW = 384
export const SH = 216
export const GROUND = 176
const PAD = 64 // extra width for camera pans

export type SceneId = 'castle' | 'cyber' | 'crystal' | 'sakura' | 'neon' | 'desert'
export type Ambient = 'firefly' | 'bits' | 'sparkle' | 'petal' | 'spark' | 'sand'
type Scene = { light: string; fog: string; grade: [string, string]; sky: string[]; stars: boolean; far: string; mid: string; ground: [string, string, string]; ambient: Ambient; ambientColors: string[] }

export const SCENES: Record<SceneId, Scene> = {
  castle: { light: '#9ab8ff', fog: '#3a3080', grade: ['#3050a0', '#ff9a50'], sky: ['#0b0a24', '#16144a', '#252066', '#3a2b7a'], stars: true, far: '#2a2160', mid: '#1a1540', ground: ['#4a3e5c', '#352c45', '#6b5c80'], ambient: 'firefly', ambientColors: ['#ffe27a', '#c8ff7a'] },
  cyber: { light: '#5affc8', fog: '#0a4a4a', grade: ['#0a6a7a', '#ff4a8a'], sky: ['#03131a', '#062530', '#0a3540', '#0f4a52'], stars: true, far: '#0b3a44', mid: '#06222b', ground: ['#1a2a30', '#0f1a1e', '#2fd6a0'], ambient: 'bits', ambientColors: ['#3cff9a', '#2fd6a0'] },
  crystal: { light: '#a0f0ff', fog: '#4a3a90', grade: ['#4a3ab0', '#7af0ff'], sky: ['#0a0620', '#1a0f3d', '#2a1a5c', '#123a5c'], stars: true, far: '#251a52', mid: '#3a2a7a', ground: ['#2c2350', '#1c1638', '#7ef0ff'], ambient: 'sparkle', ambientColors: ['#7ef0ff', '#ffffff', '#c8a8ff'] },
  sakura: { light: '#ffd0a0', fog: '#c07a9a', grade: ['#5a2a7a', '#ffb070'], sky: ['#2a1a4a', '#6a2f6a', '#c25a6a', '#f2a07a'], stars: false, far: '#7a4a7a', mid: '#3a2040', ground: ['#4a6a3a', '#33502a', '#7a9a4a'], ambient: 'petal', ambientColors: ['#ffc0d8', '#ff8ab8', '#ffffff'] },
  neon: { light: '#ff7ae0', fog: '#5a1070', grade: ['#3a0a8a', '#ff5ab0'], sky: ['#12002a', '#2a0050', '#5a0a6a', '#a0207a'], stars: true, far: '#3a0a5a', mid: '#1a0030', ground: ['#14002a', '#0a0018', '#ff3cc8'], ambient: 'spark', ambientColors: ['#ff3cc8', '#3cf0ff', '#ffe27a'] },
  desert: { light: '#ffd890', fog: '#c08060', grade: ['#5a2a5a', '#ffc060'], sky: ['#3a1a3a', '#8a3a3a', '#d8704a', '#f2b45a'], stars: false, far: '#a85a4a', mid: '#6a3a30', ground: ['#c8904a', '#a8703a', '#e8b46a'], ambient: 'sand', ambientColors: ['#f2d08a', '#e8b46a'] },
}

export const BOARD_SCENE: Record<string, SceneId> = { text: 'castle', coding: 'cyber', math: 'crystal', creative: 'sakura', webdev: 'neon', vision: 'desert' }

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function layer(w: number, h: number, fn: (c: CanvasRenderingContext2D, r: () => number) => void, seed: number) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  c.imageSmoothingEnabled = false
  fn(c, rng(seed))
  return cv
}

export type SceneLayers = { id: SceneId; shafts: HTMLCanvasElement; fog: HTMLCanvasElement; grade: HTMLCanvasElement; sky: HTMLCanvasElement; far: HTMLCanvasElement; mid: HTMLCanvasElement; ground: HTMLCanvasElement; near: HTMLCanvasElement; stars: [number, number, number][] }
const cache = new Map<SceneId, SceneLayers>()

export function sceneLayers(id: SceneId): SceneLayers {
  const hit = cache.get(id)
  if (hit) return hit
  const s = SCENES[id]
  const W = SW + PAD * 2
  const sky = layer(W, SH, (c) => {
    const band = Math.ceil(GROUND / s.sky.length)
    s.sky.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * band, W, band) })
    // dithered band edges
    for (let i = 1; i < s.sky.length; i++) {
      c.fillStyle = s.sky[i]
      for (let x = 0; x < W; x += 2) c.fillRect(x + (i % 2), i * band - 2, 1, 1)
      for (let x = 0; x < W; x += 4) c.fillRect(x, i * band - 4, 1, 1)
    }
    if (id === 'neon' || id === 'desert' || id === 'sakura') {
      // big striped sun
      const cx = W / 2, cy = 112, r = 34
      for (let y = -r; y <= r; y++) {
        if (id === 'neon' && y > 0 && y % 6 < 2) continue
        const hw = Math.floor(Math.sqrt(r * r - y * y))
        c.fillStyle = y < -r / 3 ? '#ffe27a' : y < r / 3 ? '#ffb14a' : '#ff6a5a'
        c.fillRect(cx - hw, cy + y, hw * 2, 1)
      }
    }
    if (id === 'crystal') {
      // aurora ribbons
      for (let k = 0; k < 3; k++) for (let x = 0; x < W; x++) {
        const y = 30 + k * 12 + Math.round(Math.sin(x * 0.03 + k) * 8 + Math.sin(x * 0.011) * 6)
        c.fillStyle = ['#3cffb4', '#7ef0ff', '#c87aff'][k]
        c.globalAlpha = 0.35
        c.fillRect(x, y, 1, 6)
      }
      c.globalAlpha = 1
    }
  }, 1)
  const far = layer(W, SH, (c, r) => {
    c.fillStyle = s.far
    if (id === 'cyber') {
      for (let x = 0; x < W;) {
        const bw = 14 + Math.floor(r() * 22), bh = 40 + Math.floor(r() * 70)
        c.fillRect(x, GROUND - bh, bw, bh)
        c.fillStyle = '#3cff9a'
        for (let wy = GROUND - bh + 4; wy < GROUND - 6; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (r() < 0.25) c.fillRect(wx, wy, 2, 2)
        c.fillStyle = s.far
        x += bw + 2 + Math.floor(r() * 6)
      }
    } else {
      for (let x = 0; x < W; x += 2) {
        const h = 46 + Math.round(Math.sin(x * 0.021) * 22 + Math.sin(x * 0.057 + 1) * 10)
        c.fillRect(x, GROUND - h, 2, h)
      }
      if (id === 'sakura') { // snowy peaks
        c.fillStyle = '#f2e8f2'
        for (let x = 0; x < W; x += 2) { const h = 46 + Math.round(Math.sin(x * 0.021) * 22 + Math.sin(x * 0.057 + 1) * 10); if (h > 60) c.fillRect(x, GROUND - h, 2, Math.min(6, h - 60)) }
      }
    }
  }, 2)
  const mid = layer(W, SH, (c, r) => {
    c.fillStyle = s.mid
    if (id === 'castle') {
      for (let x = 10; x < W; x += 120 + Math.floor(r() * 60)) {
        c.fillRect(x, GROUND - 60, 40, 60); c.fillRect(x - 8, GROUND - 80, 14, 80); c.fillRect(x + 34, GROUND - 76, 14, 76)
        for (let k = 0; k < 4; k++) { c.fillRect(x - 8 + k * 4, GROUND - 84, 2, 4); c.fillRect(x + 34 + k * 4, GROUND - 80, 2, 4) }
        c.fillStyle = '#ffd27a'; c.fillRect(x + 8, GROUND - 46, 3, 5); c.fillRect(x + 26, GROUND - 40, 3, 5); c.fillRect(x - 3, GROUND - 66, 3, 4); c.fillStyle = s.mid
      }
    } else if (id === 'cyber') {
      for (let x = 0; x < W; x += 50 + Math.floor(r() * 30)) {
        c.fillRect(x, GROUND - 36, 22, 36)
        for (let y = GROUND - 32; y < GROUND - 4; y += 4) { c.fillStyle = r() < 0.5 ? '#ff5a5a' : '#3cff9a'; c.fillRect(x + 3, y, 2, 1); c.fillStyle = s.mid }
        c.fillRect(x + 10, GROUND - 52, 2, 16)
      }
    } else if (id === 'crystal') {
      for (let x = 0; x < W; x += 18 + Math.floor(r() * 30)) {
        const h = 20 + Math.floor(r() * 50), w = 6 + Math.floor(r() * 8)
        c.fillStyle = s.mid
        c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x + w / 2, GROUND - h); c.lineTo(x + w, GROUND); c.fill()
        c.fillStyle = '#7ef0ff'; c.fillRect(x + w / 2, GROUND - h + 3, 1, h / 2)
      }
    } else if (id === 'sakura') {
      for (let x = 20; x < W; x += 70 + Math.floor(r() * 50)) {
        c.fillStyle = '#3a2030'; c.fillRect(x, GROUND - 50, 5, 50); c.fillRect(x - 6, GROUND - 40, 8, 3)
        for (let k = 0; k < 26; k++) { c.fillStyle = ['#ffb0cc', '#ff8ab8', '#ffd0e0'][k % 3]; c.fillRect(x - 18 + Math.floor(r() * 40), GROUND - 74 + Math.floor(r() * 30), 6, 4) }
      }
    } else if (id === 'neon') {
      for (let x = 30; x < W; x += 110 + Math.floor(r() * 40)) {
        c.fillStyle = '#1a0030'; c.fillRect(x, GROUND - 56, 3, 56)
        for (let k = 0; k < 5; k++) { c.fillRect(x - 14 + k * 3, GROUND - 60 + Math.abs(k - 2) * 3, 4, 2); c.fillRect(x + 2 + k * 3, GROUND - 58 + k * 2, 4, 2) }
      }
    } else {
      for (let x = 10; x < W; x += 90 + Math.floor(r() * 50)) {
        c.fillRect(x, GROUND - 46, 10, 46); c.fillRect(x - 3, GROUND - 50, 16, 5)
        if (r() < 0.6) { c.fillRect(x + 30, GROUND - 28, 10, 28); c.fillRect(x + 27, GROUND - 32, 16, 4) }
      }
    }
  }, 3)
  const ground = layer(W, SH - GROUND, (c, r) => {
    const [g1, g2, acc] = s.ground
    c.fillStyle = g1; c.fillRect(0, 0, W, SH - GROUND)
    c.fillStyle = acc; c.fillRect(0, 0, W, 1)
    if (id === 'neon') {
      c.fillStyle = acc
      for (let y = 4; y < SH - GROUND; y += Math.max(2, Math.floor(y / 3))) c.fillRect(0, y, W, 1)
      for (let k = -20; k <= 20; k++) { c.beginPath(); c.moveTo(W / 2 + k * 6, 0); c.lineTo(W / 2 + k * 40, SH - GROUND); c.strokeStyle = acc; c.lineWidth = 1; c.stroke() }
    } else {
      c.fillStyle = g2
      for (let y = 3; y < SH - GROUND; y += 6) for (let x = (y / 3) % 2 ? 0 : 8; x < W; x += 16) c.fillRect(x, y, 10, 2)
      c.fillStyle = acc
      for (let i = 0; i < 40; i++) c.fillRect(Math.floor(r() * W), 2 + Math.floor(r() * (SH - GROUND - 4)), 1, 1)
    }
  }, 4)
  const nearSharp = layer(W, SH, (c, r) => {
    // foreground silhouettes (grass blades, rocks, a hanging branch) — blurred below for depth of field
    c.fillStyle = '#06040c'
    for (const x0 of [0, W - 90]) {
      c.beginPath(); c.ellipse(x0 + 45, SH + 6, 50, 22, 0, 0, Math.PI * 2); c.fill()
      for (let k = 0; k < 22; k++) {
        const x = x0 + Math.floor(r() * 90), h = 14 + Math.floor(r() * 40)
        c.beginPath(); c.moveTo(x, SH); c.lineTo(x + 2 + r() * 3, SH - h); c.lineTo(x + 5, SH); c.fill()
      }
    }
    c.fillRect(W - 140, 0, 140, 6)
    for (let k = 0; k < 18; k++) { const x = W - 140 + Math.floor(r() * 140); c.fillRect(x, 0, 3, 8 + Math.floor(r() * 18)) }
  }, 5)
  const near = layer(W, SH, (c) => { c.filter = 'blur(2px)'; c.drawImage(nearSharp, 0, 0); c.filter = 'none'; c.globalAlpha = 0.5; c.drawImage(nearSharp, 0, 0) }, 6)
  // volumetric light shafts (drawn additively, alpha animated by the engine)
  const shafts = layer(W, SH, (c, r) => {
    for (let k = 0; k < 6; k++) {
      const x = 30 + k * 80 + r() * 40, w = 14 + r() * 30
      const g = c.createLinearGradient(0, 0, 0, GROUND)
      g.addColorStop(0, s.light + '55'); g.addColorStop(1, s.light + '00')
      c.fillStyle = g
      c.beginPath(); c.moveTo(x, -10); c.lineTo(x + w, -10); c.lineTo(x + w + 70, GROUND); c.lineTo(x + 50, GROUND); c.fill()
    }
  }, 7)
  // soft fog bands
  const fog = layer(W, SH, (c, r) => {
    c.filter = 'blur(6px)'
    for (let k = 0; k < 14; k++) {
      c.fillStyle = s.fog + '66'
      c.beginPath(); c.ellipse(r() * W, GROUND - 20 + r() * 30, 40 + r() * 60, 8 + r() * 8, 0, 0, Math.PI * 2); c.fill()
    }
    c.filter = 'none'
  }, 8)
  // cinematic grade: cool shadows on top, warm light low (applied with soft-light)
  const grade = layer(SW, SH, (c) => {
    const g = c.createLinearGradient(0, 0, 0, SH)
    g.addColorStop(0, s.grade[0]); g.addColorStop(1, s.grade[1])
    c.fillStyle = g; c.fillRect(0, 0, SW, SH)
  }, 9)
  const sr = rng(9)
  const stars: [number, number, number][] = s.stars ? Array.from({ length: 60 }, () => [Math.floor(sr() * W), Math.floor(sr() * 110), Math.floor(sr() * 120)]) : []
  const out = { id, sky, far, mid, ground, near, stars, shafts, fog, grade }
  cache.set(id, out)
  return out
}

export const SCENE_PAD = PAD
