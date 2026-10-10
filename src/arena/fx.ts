/**
 * Pixel VFX: multi-frame explosions, shock rings, cracks, dust, debris and a
 * signature effect per mascot. All drawing is integer-aligned rects so it stays
 * crisp; the engine also draws them into its glow buffer for bloom.
 */
import type { Avatar } from './types'

export type Fx = { t: number; life: number; back?: boolean; draw: (c: CanvasRenderingContext2D, t: number) => void; step?: (t: number) => void }

const r = Math.round
export function disc(c: CanvasRenderingContext2D, x: number, y: number, rad: number, sy = 1) {
  rad = Math.max(0, rad)
  for (let dy = -rad; dy <= rad; dy++) {
    const w = Math.floor(Math.sqrt(rad * rad - dy * dy))
    c.fillRect(r(x - w), r(y + dy * sy), w * 2 + 1, Math.max(1, r(sy)))
  }
}
export function ring(c: CanvasRenderingContext2D, x: number, y: number, rad: number, th: number, sy = 1) {
  const n = Math.max(12, Math.floor(rad * 3))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    c.fillRect(r(x + Math.cos(a) * rad - th / 2), r(y + Math.sin(a) * rad * sy - th / 2), th, th)
  }
}
function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, th = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
  for (let i = 0; i <= n; i++) c.fillRect(r(x0 + ((x1 - x0) * i) / n - th / 2), r(y0 + ((y1 - y0) * i) / n - th / 2), th, th)
}
function star4(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.fillRect(r(x - s), r(y), s * 2 + 1, 1)
  c.fillRect(r(x), r(y - s), 1, s * 2 + 1)
  if (s > 2) { c.fillRect(r(x - 1), r(y - 1), 3, 3) }
}

/** hand-drawn-ish explosion: white core → hot palette → ring → smoke */
export function explosion(x: number, y: number, size: number, pal: string[]): Fx {
  const seeds = Array.from({ length: 7 }, () => [Math.random() * Math.PI * 2, 0.5 + Math.random() * 0.6])
  return {
    t: 0, life: 30,
    draw(c, t) {
      const k = t / 30
      if (t < 3) { c.fillStyle = '#ffffff'; disc(c, x, y, r(size * (0.5 + t * 0.25))); return }
      // lobes
      c.fillStyle = k < 0.35 ? pal[0] : k < 0.6 ? pal[1] : '#4a3a5a'
      for (const [a, m] of seeds) disc(c, x + Math.cos(a) * size * k * m, y + Math.sin(a) * size * k * m * 0.7 - k * 6, r(size * 0.5 * (1 - k * 0.7)))
      if (k < 0.5) { c.fillStyle = pal[0] === '#ffffff' ? pal[1] : '#ffffff'; disc(c, x, y, r(size * 0.45 * (1 - k * 2))) }
      if (t < 14) { c.fillStyle = pal[0]; ring(c, x, y, size * (0.6 + t * 0.12), t < 7 ? 2 : 1, 0.6) }
    },
  }
}
export function shock(x: number, y: number, max: number, color: string, life = 18, sy = 0.35): Fx {
  return { t: 0, life, draw(c, t) { c.fillStyle = color; ring(c, x, y, (max * t) / life + 4, t < life / 2 ? 2 : 1, sy) } }
}
export function crack(x: number, ground: number, dir: number): Fx {
  const segs: [number, number][] = []
  for (const s of [-1, 1]) { let px = x, py = 0; for (let i = 0; i < 6; i++) { const nx = px + s * (4 + Math.random() * 6), ny = py + (Math.random() * 4 - 1); segs.push([px, py], [nx, ny]); px = nx; py = Math.max(0, ny) } }
  void dir
  return {
    t: 0, life: 110, back: true,
    draw(c, t) {
      c.globalAlpha = Math.min(1, (110 - t) / 30)
      c.fillStyle = '#120a1e'
      for (let i = 0; i < segs.length; i += 2) line(c, segs[i][0], ground + 1 + segs[i][1], segs[i + 1][0], ground + 1 + segs[i + 1][1], 1)
      c.fillStyle = 'rgba(255,220,150,0.6)'
      if (t < 20) for (let i = 0; i < segs.length; i += 4) c.fillRect(r(segs[i][0]), r(ground + segs[i][1]), 1, 1)
      c.globalAlpha = 1
    },
  }
}
export function dust(x: number, y: number, n: number, dir: number): Fx {
  const ps = Array.from({ length: n }, () => ({ x, y, vx: (Math.random() * 1.6 + 0.3) * (Math.random() < 0.5 ? -1 : 1) + dir * 0.6, vy: -Math.random() * 0.6, s: 2 + Math.random() * 3 }))
  return {
    t: 0, life: 34,
    step() { for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.s += 0.12 } },
    draw(c, t) { c.fillStyle = t < 12 ? '#d8cbb8' : '#8a7f90'; c.globalAlpha = 1 - t / 34; for (const p of ps) disc(c, p.x, p.y, r(p.s)); c.globalAlpha = 1 },
  }
}

type Spawn = (x: number, y: number, dir: number, crit: boolean, from: number) => Fx[]
type Base = 'knight' | 'dragon' | 'mage' | 'mech' | 'whale' | 'scholar' | 'rabbit' | 'fox'
const PAL: Record<Avatar, string[]> = {
  meta: ['#e4f0ff', '#86b8ff', '#2c5cd8'], mistral: ['#fff3ae', '#f27c2c', '#de3a4c'], bytedance: ['#ffffff', '#fff2d8', '#de3a4c'],
  tencent: ['#e4ffff', '#80f2ff', '#f4c34e'], nvidia: ['#eaffd0', '#6cd84c', '#2f9a4a'], minimax: ['#ffd2e8', '#ff7cba', '#de3a4c'],
  amazon: ['#ffe0b0', '#f27c2c', '#c99c64'], microsoft: ['#ffffff', '#86b8ff', '#6cd84c'], cohere: ['#eaffd0', '#6cd84c', '#d97757'],
  stepfun: ['#e4ffff', '#86b8ff', '#2c5cd8'], baidu: ['#e4f0ff', '#5ca2ff', '#2c5cd8'], xiaomi: ['#fff3ae', '#f27c2c', '#de3a4c'], mystery: ['#ffffff', '#caa8ff', '#5a3aa2'],
  knight: ['#eafff0', '#6cd84c', '#2f9a4a'],
  dragon: ['#ffe0c8', '#d97757', '#a6503a'],
  mage: ['#ffffff', '#86b8ff', '#ff7cba'],
  mech: ['#e0d0ff', '#8c5cdc', '#1c1630'],
  whale: ['#e4ffff', '#80f2ff', '#4274dc'],
  scholar: ['#fff3ae', '#f27c2c', '#6cd84c'],
  rabbit: ['#ffffff', '#fff3ae', '#f4c34e'],
  fox: ['#ffffff', '#80f2ff', '#5ca2ff'],
}
const base = (a: string) => a.split('#')[0] as Avatar
export const palette = (a: string) => { const b = base(a); if (b === 'mystery' && a.includes('#')) { const c = '#' + a.split('#')[1]; return ['#ffffff', c, c] } return PAL[b] ?? PAL.mystery }
/** new labs reuse a themed signature: ∞ → gravity loop, wind → blade, bun/parcel → cannon … */
export const SIG_ALIAS: Record<Avatar, Base> = { knight: 'knight', dragon: 'dragon', mage: 'mage', mech: 'mech', whale: 'whale', scholar: 'scholar', rabbit: 'rabbit', fox: 'fox', meta: 'mech', mistral: 'rabbit', bytedance: 'scholar', tencent: 'whale', nvidia: 'fox', minimax: 'dragon', amazon: 'scholar', microsoft: 'knight', cohere: 'mage', stepfun: 'dragon', baidu: 'dragon', xiaomi: 'rabbit', mystery: 'mech' }

const SIG: Record<Base, Spawn> = {
  // 六瓣结界: hexagon barrier blooms around the target, then shatters
  knight: (x, y, _d, crit) => [{
    t: 0, life: 34,
    draw(c, t) {
      const R = 10 + t * (crit ? 1.6 : 1.1)
      c.fillStyle = t < 18 ? '#eafff0' : '#6cd84c'
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2 + t * 0.03, a1 = ((k + 1) / 6) * Math.PI * 2 + t * 0.03
        if (t < 22) line(c, x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, 2)
        else { const m = (t - 22) * 2; c.fillRect(r(x + Math.cos(a0) * (R + m)), r(y + Math.sin(a0) * (R + m)), 3, 2) }
        if (t < 16) { c.fillStyle = '#6cd84c'; disc(c, x + Math.cos(a0 + 0.5) * R * 0.55, y + Math.sin(a0 + 0.5) * R * 0.55, 3); c.fillStyle = '#eafff0' }
      }
    },
  }],
  // 钳击冲击波: three claw slashes then a ground shock
  dragon: (x, y, d) => [{
    t: 0, life: 22,
    draw(c, t) {
      c.fillStyle = t < 6 ? '#ffffff' : '#f8bca2'
      for (let k = 0; k < 3; k++) {
        if (t < k * 2) continue
        const ox = x + (k - 1) * 7, len = Math.min(22, (t - k * 2) * 7)
        line(c, ox - 8 * d, y - 14, ox - 8 * d + len * 0.6 * d, y - 14 + len, t < 10 ? 3 : 1)
      }
    },
  }, shock(x, y + 30, 70, '#d97757', 22, 0.18)],
  // 星屑爆发: burst of 4-point stars in the Gemini gradient
  mage: (x, y, _d, crit) => {
    const st = Array.from({ length: crit ? 26 : 16 }, (_, i) => ({ a: (i / (crit ? 26 : 16)) * Math.PI * 2 + Math.random() * 0.3, v: 1.4 + Math.random() * 2.2, c: ['#ffffff', '#86b8ff', '#caa8ff', '#ff7cba'][i % 4] }))
    return [{
      t: 0, life: 36,
      draw(c, t) {
        if (t < 5) { c.fillStyle = '#ffffff'; star4(c, x, y, 18 - t * 2) }
        for (const s of st) { c.fillStyle = s.c; const dd = s.v * t * (1 - t / 80); star4(c, x + Math.cos(s.a) * dd, y + Math.sin(s.a) * dd, t < 18 ? 3 : t < 28 ? 2 : 1) }
      },
    }]
  },
  // 引力扭曲: dark core with rings collapsing inward, then a ring burst
  mech: (x, y) => [{
    t: 0, life: 34,
    draw(c, t) {
      if (t < 20) {
        for (let k = 0; k < 3; k++) { const rad = 34 - ((t * 2 + k * 11) % 33); c.fillStyle = k % 2 ? '#8c5cdc' : '#caa8ff'; ring(c, x, y, rad, 1, 0.9) }
        c.fillStyle = '#1c1630'; disc(c, x, y, 6 + (t % 4 < 2 ? 1 : 0))
        c.fillStyle = '#e0d0ff'; ring(c, x, y, 7, 1)
      } else { c.fillStyle = '#e0d0ff'; ring(c, x, y, (t - 20) * 4, 2, 0.7) }
    },
  }],
  // 海啸: water pillars march from attacker to target, droplets + crest
  whale: (x, y, d, _c, from) => [{
    t: 0, life: 30, back: false,
    draw(c, t) {
      const n = 6
      for (let k = 0; k < n; k++) {
        const px = from + ((x - from) * (k + 1)) / n, st = k * 2
        if (t < st) continue
        const h = Math.max(0, Math.sin(Math.min(1, (t - st) / 14) * Math.PI) * (16 + k * 5))
        c.fillStyle = '#4274dc'; c.fillRect(r(px - 4), r(y + 34 - h), 8, r(h))
        c.fillStyle = '#80f2ff'; c.fillRect(r(px - 4), r(y + 34 - h), 8, 2); c.fillRect(r(px - 2 + d * 3), r(y + 32 - h), 4, 2)
        c.fillStyle = '#e4ffff'; if ((t + k) % 3 === 0) c.fillRect(r(px + (k % 2 ? 5 : -6)), r(y + 30 - h), 2, 2)
      }
    },
  }],
  // 柚子炮弹: arcing yuzu cannonball then a citrus splash
  scholar: (x, y, _d, _c, from) => [{
    t: 0, life: 30,
    draw(c, t) {
      if (t < 8) {
        const k = t / 8, bx = from + (x - from) * k, by = y - 6 - Math.sin(k * Math.PI) * 26
        c.fillStyle = '#f27c2c'; disc(c, bx, by, 5); c.fillStyle = '#ffc27c'; c.fillRect(r(bx - 2), r(by - 3), 2, 2); c.fillStyle = '#6cd84c'; c.fillRect(r(bx), r(by - 6), 2, 2)
        c.fillStyle = 'rgba(255,194,124,0.6)'; for (let j = 1; j < 4; j++) { const kk = Math.max(0, k - j * 0.06); disc(c, from + (x - from) * kk, y - 6 - Math.sin(kk * Math.PI) * 26, 4 - j) }
      } else {
        const tt = t - 8
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.fillStyle = i % 3 ? '#f4c34e' : '#f27c2c'; disc(c, x + Math.cos(a) * tt * 2.2, y + Math.sin(a) * tt * 1.6 + tt * tt * 0.04, Math.max(1, 3 - tt / 8)) }
        if (tt < 8) { c.fillStyle = '#6cd84c'; c.fillRect(r(x - 3 + tt), r(y - 10 - tt), 3, 2) }
      }
    },
  }],
  // 月光回旋刃: crescent blade flies in, slashes an X
  rabbit: (x, y, d, _c, from) => [{
    t: 0, life: 28,
    draw(c, t) {
      if (t < 8) {
        const k = t / 8, bx = from + (x - from) * k
        for (let j = 0; j < 4; j++) {
          const kk = Math.max(0, k - j * 0.08), px = from + (x - from) * kk
          c.fillStyle = j ? 'rgba(255,243,174,' + (0.6 - j * 0.15) + ')' : '#ffffff'
          for (let a = -1.2; a <= 1.2; a += 0.12) c.fillRect(r(px + Math.cos(a) * 10 * d), r(y + Math.sin(a) * 12), 2, 2)
        }
        void bx
      } else {
        const tt = t - 8
        c.fillStyle = tt < 6 ? '#ffffff' : '#fff3ae'
        const L = Math.min(18, tt * 6)
        line(c, x - L, y - L, x + L, y + L, tt < 8 ? 2 : 1); line(c, x - L, y + L, x + L, y - L, tt < 8 ? 2 : 1)
      }
    },
  }],
  // 电弧闪电: jagged arcs from sky + from attacker
  fox: (x, y, _d, crit, from) => {
    const bolt = (x0: number, y0: number, x1: number, y1: number) => { const p: [number, number][] = [[x0, y0]]; for (let i = 1; i < 8; i++) p.push([x0 + ((x1 - x0) * i) / 8 + (Math.random() * 10 - 5), y0 + ((y1 - y0) * i) / 8 + (Math.random() * 8 - 4)]); p.push([x1, y1]); return p }
    let bolts: [number, number][][] = []
    return [{
      t: 0, life: 24,
      step(t) { if (t % 2 === 0) bolts = [bolt(x + (Math.random() * 20 - 10), 0, x, y), bolt(from, y - 6, x, y), ...(crit ? [bolt(x - 30, 10, x, y + 10)] : [])] },
      draw(c, t) {
        if (t > 16) return
        for (const b of bolts) for (let i = 0; i + 1 < b.length; i++) { c.fillStyle = '#5ca2ff'; line(c, b[i][0], b[i][1], b[i + 1][0], b[i + 1][1], 3); c.fillStyle = '#ffffff'; line(c, b[i][0], b[i][1], b[i + 1][0], b[i + 1][1], 1) }
        c.fillStyle = '#80f2ff'; disc(c, x, y, 6 - (t % 3))
      },
    }]
  },
}
export function signature(a: string, x: number, y: number, dir: number, crit: boolean, from: number): Fx[] {
  return SIG[SIG_ALIAS[base(a)] ?? 'mech'](x, y, dir, crit, from)
}
