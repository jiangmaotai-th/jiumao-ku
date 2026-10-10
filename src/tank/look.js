const HOUR = 60 * 60 * 1000

export const GROW_FISH_MS = 2 * HOUR
export const GROW_LARGE_MS = 6 * HOUR
export const FEED_GROW_MS = 25 * 60 * 1000
export const FRY_YIELD = 0.14

const PATTERNS = ['stripe', 'spot', 'saddle', 'speckle', 'marble', 'band']

export function newLookSeed() {
  const a = (Math.random() * 0xffffffff) >>> 0
  const b = (Date.now() ^ (Math.random() * 0xffff)) >>> 0
  return (a ^ Math.imul(b, 1597334677)) >>> 0
}

export function seedFromId(id) {
  let h = 2166136261
  for (const ch of String(id || 'fish')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function lookFromSeed(seed) {
  const r = mulberry32((seed || 1) >>> 0)
  return {
    hue: r() * 96 - 48,
    sat: 0.92 + r() * 0.22,
    bright: 0.94 + r() * 0.14,
    pattern: PATTERNS[Math.floor(r() * PATTERNS.length)],
    scale: 4.2 + r() * 5.5,
    angle: r() * Math.PI,
    mix: 0.12 + r() * 0.16,
  }
}

export function growthAge(fish) {
  if (Number.isFinite(Number(fish?.grownMs))) return Math.max(0, Number(fish.grownMs))
  const born = Number(fish?.bornAt) || 0
  const bonus = Math.max(0, Number(fish?.growBonusMs) || 0)
  if (!born) return GROW_LARGE_MS
  return Math.max(0, Date.now() - born + bonus)
}

function ease(t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export function growthOf(fish, now = Date.now()) {
  const age = growthAge(fish, now)
  const tFish = Math.min(1, age / GROW_FISH_MS)
  const tLarge = Math.min(1, age / GROW_LARGE_MS)
  const scale = age < GROW_FISH_MS
    ? 0.22 + 0.30 * ease(tFish)
    : 0.52 + 0.48 * ease((age - GROW_FISH_MS) / (GROW_LARGE_MS - GROW_FISH_MS))
  const patterned = age >= GROW_FISH_MS
  const stage = !patterned ? 'fry' : age < GROW_LARGE_MS ? 'young' : 'adult'
  const yieldMul = FRY_YIELD + (1 - FRY_YIELD) * (tLarge ** 0.85)
  const remainFish = Math.max(0, GROW_FISH_MS - age)
  const remainLarge = Math.max(0, GROW_LARGE_MS - age)
  return {
    age,
    scale: Math.max(0.22, Math.min(1, scale)),
    stage,
    patterned,
    yieldMul,
    remainFish,
    remainLarge,
  }
}

export function ensureFishIdentity(fish, index = 0) {
  if (!fish || typeof fish !== 'object') return fish
  if (!Number.isFinite(Number(fish.lookSeed))) {
    fish.lookSeed = seedFromId(fish.id || fish.species || index)
  }
  if (!Number(fish.bornAt)) {
    fish.bornAt = Date.now() - GROW_LARGE_MS
    fish.growBonusMs = 0
    fish.grownMs = GROW_LARGE_MS
  }
  if (!Number.isFinite(Number(fish.growBonusMs))) fish.growBonusMs = 0
  if (!Number.isFinite(Number(fish.grownMs))) {
    const bonus = Math.max(0, Number(fish.growBonusMs) || 0)
    fish.grownMs = Math.min(GROW_LARGE_MS, Math.max(0, Date.now() - Number(fish.bornAt) + bonus))
  }
  if (fish.mystery == null) fish.mystery = false
  if (!fish.quality) fish.quality = 'common'
  if (!Number.isFinite(Number(fish.satedUntil))) fish.satedUntil = 0
  return fish
}

export function boxedRecord(fish) {
  return {
    species: fish.species,
    lookSeed: (Number(fish.lookSeed) || seedFromId(fish.id)) >>> 0,
    bornAt: Number(fish.bornAt) || Date.now() - GROW_LARGE_MS,
    growBonusMs: Math.max(0, Number(fish.growBonusMs) || 0),
    grownMs: Math.max(0, Number(fish.grownMs) || 0),
    mystery: Boolean(fish.mystery),
    quality: fish.quality || 'common',
  }
}

export function drawFryShape(ctx, size) {
  const w = size
  const h = size * 0.42
  ctx.fillStyle = '#8fa8b8'
  ctx.beginPath()
  ctx.ellipse(0, 0, w * 0.38, h * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,40,55,.45)'
  ctx.lineWidth = Math.max(1, w * 0.03)
  ctx.stroke()
  ctx.fillStyle = '#6d8596'
  ctx.beginPath()
  ctx.moveTo(-w * 0.3, 0)
  ctx.lineTo(-w * 0.58, -h * 0.38)
  ctx.lineTo(-w * 0.52, 0)
  ctx.lineTo(-w * 0.58, h * 0.38)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#c5d5de'
  ctx.beginPath()
  ctx.ellipse(w * 0.06, h * 0.08, w * 0.16, h * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a2a33'
  ctx.beginPath()
  ctx.ellipse(w * 0.22, -h * 0.04, w * 0.045, h * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.beginPath()
  ctx.ellipse(w * 0.235, -h * 0.06, w * 0.018, h * 0.028, 0, 0, Math.PI * 2)
  ctx.fill()
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360
  if (s <= 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

function wrap01(n) {
  return n - Math.floor(n)
}

export function scrubFishImage(img) {
  if (!img?.width || !img.height) return img
  const w = img.width
  const h = img.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.clearRect(0, 0, w, h)
  g.drawImage(img, 0, 0)
  let pix
  try {
    pix = g.getImageData(0, 0, w, h)
  } catch {
    return img
  }
  const d = pix.data
  const n = w * h
  let keep = new Uint8Array(n)
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    if (d[i + 3] >= 128) keep[p] = 1
  }
  const dilate = Math.max(2, Math.round(Math.min(w, h) * 0.014))
  for (let pass = 0; pass < dilate; pass += 1) {
    const next = new Uint8Array(keep)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x
        if (keep[p]) continue
        let hit = 0
        for (let dy = -1; dy <= 1 && !hit; dy += 1) {
          const ny = y + dy
          if (ny < 0 || ny >= h) continue
          const row = ny * w
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            if (nx < 0 || nx >= w) continue
            if (keep[row + nx]) {
              hit = 1
              break
            }
          }
        }
        if (hit) next[p] = 1
      }
    }
    keep = next
  }
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    const a = d[i + 3]
    if (!a) continue
    const r = d[i]
    const gv = d[i + 1]
    const b = d[i + 2]
    const chroma = Math.max(r, gv, b) - Math.min(r, gv, b)
    const haze = a < 110 && chroma < 42 && Math.max(r, gv, b) > 40
    if (!keep[p] || haze) {
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 0
    }
  }
  g.putImageData(pix, 0, 0)
  return c
}

function patternShade(look, x, y, w, h) {
  const nx = x / w - 0.5
  const ny = y / h - 0.5
  const ca = Math.cos(look.angle)
  const sa = Math.sin(look.angle)
  const rx = nx * ca - ny * sa
  const ry = nx * sa + ny * ca
  const freq = look.scale * 0.55
  if (look.pattern === 'stripe') return 0.5 + 0.5 * Math.sin(rx * Math.PI * freq)
  if (look.pattern === 'band') return 0.5 + 0.5 * Math.sin(rx * Math.PI * freq * 0.42)
  if (look.pattern === 'spot') {
    const gx = wrap01(rx * 5.2 + 0.5) - 0.5
    const gy = wrap01(ry * 3.8 + 0.35) - 0.5
    return Math.max(0, 1 - Math.hypot(gx * 2.1, gy * 2.4))
  }
  if (look.pattern === 'speckle') {
    const n = Math.sin(rx * 38 + ry * 27) * Math.sin(rx * 17 - ry * 41)
    return 0.5 + 0.5 * n
  }
  if (look.pattern === 'saddle') {
    const a = Math.exp(-(rx * rx * 18 + ry * ry * 8))
    const b = Math.exp(-((rx - 0.16) ** 2 * 22 + ry * ry * 10))
    return Math.max(a, b * 0.85)
  }
  return 0.5 + 0.5 * Math.sin(rx * 9 + Math.sin(ry * 11) * 1.4)
}

export function makeLookCanvas(img, look, size) {
  const h = Math.max(8, size * (img.height / img.width))
  const c = document.createElement('canvas')
  c.width = Math.max(8, Math.round(size))
  c.height = Math.max(8, Math.round(h))
  const x = c.getContext('2d', { willReadFrequently: true })
  x.imageSmoothingEnabled = true
  x.clearRect(0, 0, c.width, c.height)
  x.drawImage(img, 0, 0, c.width, c.height)
  const pix = x.getImageData(0, 0, c.width, c.height)
  const d = pix.data
  const amp = Math.max(0.08, Math.min(0.28, look.mix))
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    if (d[i + 3] < 28) {
      d[i + 3] = 0
      continue
    }
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max < 38) continue
    if (min > 232 && max - min < 22) continue
    const [hh, ss, ll] = rgbToHsl(r, g, b)
    if (ss < 0.06 && ll < 0.22) continue
    const px = p % c.width
    const py = (p / c.width) | 0
    const shade = patternShade(look, px, py, c.width, c.height)
    const chroma = Math.min(1, ss * 2.2)
    const lift = (shade - 0.5) * amp * chroma
    const [nr, ng, nb] = hslToRgb(
      hh + look.hue + lift * 22,
      Math.max(0, Math.min(1, ss * look.sat * (1 + lift * 0.35))),
      Math.max(0.05, Math.min(0.94, ll * look.bright * (1 + lift))),
    )
    d[i] = nr
    d[i + 1] = ng
    d[i + 2] = nb
  }
  x.putImageData(pix, 0, 0)
  return c
}
