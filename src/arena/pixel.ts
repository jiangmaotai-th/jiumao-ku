/**
 * Tiny indexed-colour pixel rasteriser + auto shading/outline, so every
 * fighter frame is real pixel art (no anti-aliasing) generated at runtime.
 */
export type RGB = [number, number, number]

export class Px {
  readonly w: number
  readonly h: number
  readonly buf: Uint8Array
  constructor(w = 64, h = 64) {
    this.w = w
    this.h = h
    this.buf = new Uint8Array(w * h)
  }
  set(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.buf[y * this.w + x] = c
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.buf[y * this.w + x]
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35)
        if (dx * dx + dy * dy <= 1) this.set(x, y, c)
      }
  }
  poly(pts: [number, number][], c: number) {
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = []
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, t = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n
      if (t <= 1) this.set(x, y, c)
      else this.ellipse(x, y, (t - 1) / 2, (t - 1) / 2, c)
    }
  }
  /** limb from (x,y) of length len at angle deg (0 = facing forward/right, -90 = up) */
  limb(x: number, y: number, len: number, deg: number, c: number, t = 3): [number, number] {
    const r = (deg * Math.PI) / 180
    const ex = x + Math.cos(r) * len, ey = y + Math.sin(r) * len
    this.line(x, y, ex, ey, c, t)
    return [ex, ey]
  }
  /** rotate 90° clockwise (for lying-down frames), feet end up on the left */
  rotated(): Px {
    const o = new Px(this.w, this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y)
      if (c) o.set(this.h - 1 - y, x, c)
    }
    return o
  }
  /** recolour every filled pixel through fn (used for gradients) */
  map(fn: (x: number, y: number, c: number) => number) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y)
      if (c) this.buf[y * this.w + x] = fn(x, y, c)
    }
  }
  shift(dx: number, dy: number): Px {
    const o = new Px(this.w, this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y)
      if (c) o.set(x + dx, y + dy, c)
    }
    return o
  }
}

/**
 * Global palette: 15 ramps × 4 tones (highlight, base, shade, dark-outline).
 * Every fighter only uses indices from here, so the whole cast shares one
 * limited palette.
 */
export const RAMPS = {
  steel: ['#eef3fa', '#aebdd2', '#6d7c9c', '#363c5c'],
  blue: ['#86b8ff', '#4274dc', '#2b4aa0', '#1a2462'],
  gold: ['#fff3ae', '#f4c34e', '#c6802c', '#6e3a1f'],
  red: ['#ff9090', '#de3a4c', '#992240', '#4f1530'],
  skin: ['#ffe6d0', '#f6b890', '#cc7e64', '#6e3a3a'],
  orange: ['#ffc27c', '#f27c2c', '#b8481f', '#5c2418'],
  cream: ['#ffffff', '#fff2d8', '#e2c29a', '#8a6450'],
  violet: ['#caa8ff', '#8c5cdc', '#5a3aa2', '#2c1d5c'],
  pink: ['#ffd2e8', '#ff7cba', '#c8407e', '#6a1f48'],
  cyan: ['#e4ffff', '#80f2ff', '#2cb8d8', '#1a5a7a'],
  gun: ['#a0abc2', '#5c6682', '#383e56', '#1c1f30'],
  green: ['#caff9c', '#6cd84c', '#2f9a4a', '#1a4a3a'],
  brown: ['#e2a272', '#a2663c', '#6a3a24', '#3a2018'],
  navy: ['#5ca2ff', '#2c5cd8', '#1c3a8c', '#101c48'],
  ink: ['#5a5070', '#2e263e', '#1c1630', '#0e0a18'],
  clay: ['#f8bca2', '#d97757', '#a6503a', '#552820'],
  tan: ['#f2d4a2', '#c99c64', '#8e663e', '#4a3020'],
  mys: ['#d4d4d4', '#9c9c9c', '#646464', '#2c2c2c'],
} as const
export type Ramp = keyof typeof RAMPS
const RAMP_KEYS = Object.keys(RAMPS) as Ramp[]
/** shaded material (auto 3-tone) */
export const M = (r: Ramp) => RAMP_KEYS.indexOf(r) * 4 + 2
/** flat colour: tone 0 = highlight … 3 = darkest */
export const F = (r: Ramp, tone: 0 | 1 | 2 | 3) => RAMP_KEYS.indexOf(r) * 4 + tone + 1 + 128
const isFlat = (c: number) => c > 128
const rampOf = (c: number) => Math.floor(((c > 128 ? c - 128 : c) - 1) / 4)
const toneOf = (c: number) => ((c > 128 ? c - 128 : c) - 1) % 4
const colour = (ramp: number, tone: number) => RAMPS[RAMP_KEYS[ramp]][tone]

function hexToRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 3-tone shading (light from upper-left), cast shadow under other parts, and
 * selective outline: the darkest tone of the touching ramp, one step lighter
 * on the lit (top/left) side. No alpha other than 0/255.
 */
export function renderPx(px: Px, opts: { white?: boolean; glow?: string } = {}): HTMLCanvasElement {
  const pad = 2
  const cv = document.createElement('canvas')
  cv.width = px.w + pad * 2
  cv.height = px.h + pad * 2
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(cv.width, cv.height)
  const put = (x: number, y: number, hex: string) => {
    const [r, g, b] = opts.white ? [255, 255, 255] : hexToRgb(hex)
    const i = ((y + pad) * cv.width + (x + pad)) * 4
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
  }
  const same = (a: number, b: number) => b !== 0 && rampOf(a) === rampOf(b) && isFlat(a) === isFlat(b)
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const c = px.get(x, y)
    if (!c) continue
    const ramp = rampOf(c)
    if (isFlat(c)) { put(x, y, colour(ramp, toneOf(c))); continue }
    const up = px.get(x, y - 1), left = px.get(x - 1, y), down = px.get(x, y + 1), right = px.get(x + 1, y)
    const dr = px.get(x + 1, y + 1), down2 = px.get(x, y + 2), right2 = px.get(x + 2, y)
    let tone = 1
    if (!same(c, up) && up !== 0 && !isFlat(up)) tone = 2 // occluded by the part above
    else if (!same(c, up) || !same(c, left)) tone = 0
    else if (!same(c, down) || !same(c, right) || !same(c, dr)) tone = 2
    else if (!same(c, down2) || !same(c, right2)) tone = (x + y) % 2 ? 2 : 1 // hand-dither band
    put(x, y, colour(ramp, tone))
  }
  for (let y = -1; y <= px.h; y++) for (let x = -1; x <= px.w; x++) {
    if (px.get(x, y)) continue
    let hex: string | null = null
    // neighbour below/right = we are on the lit side → softer outline
    for (const [dx, dy, lit] of [[0, 1, 1], [1, 0, 1], [0, -1, 0], [-1, 0, 0]] as const) {
      const n = px.get(x + dx, y + dy)
      if (!n) continue
      const r = rampOf(n)
      const dark = colour(r, 3)
      if (!lit) { hex = dark; break }
      hex = hex ?? (RAMP_KEYS[r] === 'ink' ? colour(r, 3) : mixHex(dark, colour(r, 2)))
    }
    if (hex) put(x, y, hex)
  }
  if (opts.glow && !opts.white) {
    const g = hexToRgb(opts.glow)
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < cv.width && y < cv.height && img.data[(y * cv.width + x) * 4 + 3] > 0
    const ring: [number, number][] = []
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ring.push([x, y])
    for (const [x, y] of ring) { const i = (y * cv.width + x) * 4; img.data[i] = g[0]; img.data[i + 1] = g[1]; img.data[i + 2] = g[2]; img.data[i + 3] = 255 }
  }
  ctx.putImageData(img, 0, 0)
  return cv
}
function mixHex(a: string, b: string) {
  const x = hexToRgb(a), y = hexToRgb(b)
  return '#' + [0, 1, 2].map((i) => Math.round((x[i] * 2 + y[i]) / 3).toString(16).padStart(2, '0')).join('')
}
