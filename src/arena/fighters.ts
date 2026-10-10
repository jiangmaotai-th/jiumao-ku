import { F, M, Px, renderPx } from './pixel'
import type { Avatar } from './types'

/**
 * Chibi brawler mascots, each a pixel homage to the lab's mascot / logo shape
 * (no logo artwork is copied). Facing right, 64×64, ground at y=61.
 */
export type FPose = 'idle0' | 'idle1' | 'idle2' | 'charge' | 'attack0' | 'attack1' | 'attack2' | 'hurt' | 'block' | 'down' | 'win' | 'taunt'
export const POSE_LIST: FPose[] = ['idle0', 'idle1', 'idle2', 'charge', 'attack0', 'attack1', 'attack2', 'hurt', 'block', 'down', 'win', 'taunt']

type Mood = 'n' | 'angry' | 'hurt' | 'wince' | 'ko' | 'happy' | 'smug'
type Arm = 'rest' | 'back' | 'fwd' | 'guard' | 'v' | 'point' | 'flail' | 'flat'
type Fx = 'none' | 'tears' | 'stars' | 'sweat' | 'sparkle' | 'speed' | 'power'
type Mouth = 'smile' | 'open' | 'grit' | 'o' | 'flat' | 'grin' | 'tongue'
export type P = { sx: number; sy: number; lean: number; jump: number; mood: Mood; arm: Arm; fx: Fx; mouth: Mouth }

const POSES: Record<FPose, P> = {
  idle0: { sx: 1, sy: 1, lean: 0, jump: 0, mood: 'n', arm: 'rest', fx: 'none', mouth: 'smile' },
  idle1: { sx: 1.05, sy: 0.95, lean: 0, jump: 0, mood: 'n', arm: 'rest', fx: 'none', mouth: 'smile' },
  idle2: { sx: 0.97, sy: 1.04, lean: 0, jump: 1, mood: 'n', arm: 'rest', fx: 'none', mouth: 'smile' },
  charge: { sx: 1.16, sy: 0.84, lean: -2, jump: 0, mood: 'angry', arm: 'back', fx: 'power', mouth: 'grit' },
  attack0: { sx: 0.88, sy: 1.12, lean: -2, jump: 1, mood: 'angry', arm: 'back', fx: 'none', mouth: 'grit' },
  attack1: { sx: 1.24, sy: 0.86, lean: 5, jump: 0, mood: 'angry', arm: 'fwd', fx: 'speed', mouth: 'open' },
  attack2: { sx: 1.08, sy: 0.94, lean: 3, jump: 0, mood: 'smug', arm: 'fwd', fx: 'none', mouth: 'grin' },
  hurt: { sx: 1.26, sy: 0.8, lean: -4, jump: 2, mood: 'hurt', arm: 'flail', fx: 'tears', mouth: 'o' },
  block: { sx: 1.05, sy: 0.95, lean: -1, jump: 0, mood: 'wince', arm: 'guard', fx: 'sweat', mouth: 'grit' },
  down: { sx: 1.4, sy: 0.55, lean: 0, jump: 0, mood: 'ko', arm: 'flat', fx: 'stars', mouth: 'flat' },
  win: { sx: 0.92, sy: 1.1, lean: 0, jump: 4, mood: 'happy', arm: 'v', fx: 'sparkle', mouth: 'grin' },
  taunt: { sx: 1, sy: 1, lean: -2, jump: 0, mood: 'smug', arm: 'point', fx: 'none', mouth: 'tongue' },
}

const G = 61
const W0 = F('cream', 0) // eye white
const K = F('ink', 3) // pupil / dark
const HL = F('cream', 0)

type EyeStyle = 'round' | 'block' | 'dot' | 'sleepy' | 'glow'
/** eyes + brows + mouth. (cx, cy) = face centre, gap = half distance between eyes */
function face(g: Px, cx: number, cy: number, p: P, style: EyeStyle, gap = 5, mouthCol = F('ink', 3)) {
  const ex = [cx - gap, cx + gap]
  for (const x of ex) {
    switch (p.mood) {
      case 'happy': // ^ ^
        g.set(x - 1, cy, K); g.set(x, cy - 1, K); g.set(x + 1, cy, K); g.set(x - 2, cy + 1, K); g.set(x + 2, cy + 1, K)
        break
      case 'hurt': // > <
        if (x < cx) { g.set(x - 1, cy - 2, K); g.set(x, cy - 1, K); g.set(x + 1, cy, K); g.set(x, cy + 1, K); g.set(x - 1, cy + 2, K) }
        else { g.set(x + 1, cy - 2, K); g.set(x, cy - 1, K); g.set(x - 1, cy, K); g.set(x, cy + 1, K); g.set(x + 1, cy + 2, K) }
        break
      case 'ko': // x x
        for (let k = -1; k <= 1; k++) { g.set(x + k, cy + k, K); g.set(x + k, cy - k, K) }
        break
      default:
        if (style === 'block') { g.rect(x - 1, cy - 3, 2, 5, K); if (p.mood === 'wince') g.rect(x - 1, cy - 3, 2, 2, F('clay', 1)) }
        else if (style === 'dot') { g.rect(x - 1, cy - 1, 2, 3, K); g.set(x - 1, cy - 1, HL) }
        else if (style === 'sleepy') { g.rect(x - 2, cy, 4, 1, K); g.rect(x - 1, cy + 1, 3, 1, K) }
        else if (style === 'glow') { g.rect(x - 2, cy - 1, 4, 3, F('cyan', 1)); g.rect(x - 1, cy - 1, 2, 1, F('cyan', 0)) }
        else {
          g.rect(x - 2, cy - 2, 4, 5, W0)
          const look = p.mood === 'smug' ? 1 : 0
          g.rect(x - 1 + look, cy - 1, 2, 4, K)
          g.set(x - 1 + look, cy - 1, HL)
          if (p.mood === 'wince') g.rect(x - 2, cy - 2, 4, 2, F('ink', 2))
        }
    }
    // brows
    if (p.mood === 'angry') { const d = x < cx ? 1 : -1; g.set(x - 2 * d, cy - 5, K); g.set(x - d, cy - 4, K); g.set(x, cy - 4, K); g.set(x + d, cy - 3, K) }
    if (p.mood === 'smug') { g.rect(x - 2, cy - 4, 4, 1, K) }
  }
  // mouth (slightly forward because they face right)
  const mx = cx + 1, my = cy + 5
  switch (p.mouth) {
    case 'smile': g.set(mx - 1, my, mouthCol); g.set(mx, my + 1, mouthCol); g.set(mx + 1, my, mouthCol); break
    case 'grin': g.rect(mx - 2, my, 5, 2, mouthCol); g.rect(mx - 1, my, 3, 1, W0); break
    case 'open': g.rect(mx - 2, my - 1, 5, 4, mouthCol); g.rect(mx - 1, my + 1, 3, 2, F('red', 1)); break
    case 'grit': g.rect(mx - 2, my, 5, 2, W0); g.set(mx - 3, my, mouthCol); g.set(mx + 3, my, mouthCol); g.rect(mx - 2, my + 2, 5, 1, mouthCol); break
    case 'o': g.rect(mx - 1, my - 1, 3, 3, mouthCol); break
    case 'flat': g.rect(mx - 2, my, 4, 1, mouthCol); break
    case 'tongue': g.rect(mx - 2, my, 5, 1, mouthCol); g.rect(mx, my + 1, 2, 2, F('pink', 1)); break
  }
  // blush
  if (p.mood === 'happy' || p.mood === 'smug' || p.mood === 'n') { g.set(ex[0] - 2, cy + 3, F('pink', 1)); g.set(ex[1] + 2, cy + 3, F('pink', 1)) }
}

/** comic overlays drawn into the sprite (flat colours) */
function fx(g: Px, p: P, headX: number, headY: number, faceY: number) {
  const star = (x: number, y: number, c = F('gold', 0)) => { g.set(x, y, c); g.set(x - 1, y, c); g.set(x + 1, y, c); g.set(x, y - 1, c); g.set(x, y + 1, c) }
  switch (p.fx) {
    case 'tears': // tears flying out sideways
      for (let k = 0; k < 4; k++) { g.rect(headX - 9 - k * 3, faceY - 2 - k * 2 + k * k, 2, 2, F('cyan', 1)); g.rect(headX + 9 + k * 3, faceY - 2 - k * 2 + k * k, 2, 2, F('cyan', 1)) }
      break
    case 'stars':
      star(headX - 8, headY - 4); star(headX + 1, headY - 8); star(headX + 9, headY - 4)
      break
    case 'sweat':
      g.rect(headX + 10, headY + 2, 2, 3, F('cyan', 0)); g.set(headX + 10, headY + 1, F('cyan', 0)); g.rect(headX + 10, headY + 4, 2, 1, F('cyan', 2))
      break
    case 'sparkle':
      star(headX - 12, headY - 2, F('cream', 0)); star(headX + 13, headY + 4); star(headX + 6, headY - 9, F('cream', 0))
      break
    case 'speed':
      for (let k = 0; k < 4; k++) g.rect(2 + (k % 2) * 3, faceY - 6 + k * 6, 7 - (k % 2) * 3, 1, F('cream', 0))
      break
    case 'power':
      for (let k = 0; k < 6; k++) g.set(headX - 14 + k * 6, G - 2 - ((k * 7) % 9), F('gold', 0))
      break
  }
}

/** stubby mitten arm: hand position relative to shoulder per arm state */
function arm(g: Px, sx: number, sy: number, a: Arm, front: boolean, col: number, r = 3) {
  const d: Record<Arm, [number, number]> = {
    rest: front ? [3, 6] : [-3, 6], back: front ? [-7, 1] : [-8, -2], fwd: front ? [11, -1] : [7, 2], guard: front ? [7, -6] : [5, -8],
    v: front ? [5, -11] : [-5, -11], point: front ? [10, -3] : [-4, 6], flail: front ? [6, -10] : [-8, -8], flat: front ? [8, 2] : [-8, 2],
  }
  const [dx, dy] = d[a]
  g.line(sx, sy, sx + dx, sy + dy, col, r)
  g.ellipse(sx + dx, sy + dy, r / 2 + 0.6, r / 2 + 0.6, col)
}

type Def = { draw: (g: Px, p: P) => void }

/* 1. ChatGPT — 结花精灵：白色六瓣花结身体 + 墨色小手脚 + 绿色中二头巾 */
const knight: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, R = 11
    const cy = G - 6 - R * p.sy - p.jump
    g.ellipse(cx - 6, G - 2, 3, 2, M('ink')); g.ellipse(cx + 6, G - 2, 3, 2, M('ink'))
    arm(g, cx - 10 * p.sx, cy + 4, p.arm, false, M('ink'))
    for (let k = 0; k < 6; k++) { const a = (k * 60 + 30) * Math.PI / 180; g.ellipse(cx + Math.cos(a) * R * 0.85 * p.sx, cy + Math.sin(a) * R * 0.85 * p.sy, 7 * p.sx, 7 * p.sy, M('cream')) }
    g.ellipse(cx, cy, R * p.sx, R * p.sy, M('cream'))
    // petal seams (the "knot" lines), thin ink
    for (let k = 0; k < 6; k++) { const a = (k * 60) * Math.PI / 180; g.set(cx + Math.cos(a) * (R + 3) * p.sx, cy + Math.sin(a) * (R + 3) * p.sy, F('steel', 2)) }
    // headband with fluttering tails
    g.rect(cx - 12 * p.sx, cy - 9 * p.sy, 24 * p.sx, 3, M('green'))
    g.line(cx - 12 * p.sx, cy - 8 * p.sy, cx - 20, cy - 10 * p.sy + (p.arm === 'fwd' ? -3 : 2), M('green'), 2)
    g.line(cx - 12 * p.sx, cy - 7 * p.sy, cx - 19, cy - 4 * p.sy + (p.arm === 'fwd' ? -1 : 4), M('green'), 2)
    face(g, cx + 1, cy - 1, p, 'round', 5)
    arm(g, cx + 9 * p.sx, cy + 4, p.arm, true, M('ink'))
    fx(g, p, cx, cy - 14 * p.sy, cy)
  },
}

/* 2. Claude — Clawd 小螃蟹：方块橙身、两侧钳状突起、四条小短腿、竖条方眼 */
const dragon: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, bw = 34 * p.sx, bh = 21 * p.sy
    const top = G - 6 - bh - p.jump
    for (let k = 0; k < 4; k++) g.rect(cx - bw / 2 + 4 + k * (bw - 10) / 3, top + bh, 3, 6 - (p.jump ? 2 : 0), M('clay'))
    // back claw
    arm(g, cx - bw / 2, top + bh / 2, p.arm, false, M('clay'), 5)
    g.rect(cx - bw / 2, top, bw, bh, M('clay'))
    g.rect(cx - bw / 2 + 1, top - 1, bw - 2, 1, M('clay'))
    // red bandana knot (chuuni)
    g.rect(cx - bw / 2, top + 2, bw, 3, M('red'))
    g.line(cx - bw / 2, top + 3, cx - bw / 2 - 7, top + (p.arm === 'fwd' ? -2 : 6), M('red'), 2)
    face(g, cx + 3, top + bh / 2 + 1, p, 'block', 6)
    arm(g, cx + bw / 2, top + bh / 2, p.arm, true, M('clay'), 5)
    fx(g, p, cx, top - 4, top + bh / 2)
  },
}

/* 3. Gemini — 星芒：蓝→紫→粉渐变四角星，飘浮 */
const mage: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, R = 21
    const cy = G - 4 - R * p.sy - p.jump - 2
    const rx = R * p.sx, ry = R * p.sy, k = 0.36
    arm(g, cx - 9, cy + 3, p.arm, false, M('violet'))
    g.poly([[cx, cy - ry], [cx + rx * k, cy - ry * k], [cx + rx, cy], [cx + rx * k, cy + ry * k], [cx, cy + ry], [cx - rx * k, cy + ry * k], [cx - rx, cy], [cx - rx * k, cy - ry * k]], M('blue'))
    g.ellipse(cx, cy, 9 * p.sx, 9 * p.sy, M('blue'))
    // diagonal gradient with checker dither at band edges
    g.map((x, y, c) => {
      if (c !== M('blue')) return c
      const t = (x - cx) * 0.6 + (y - cy)
      if (t < -6) return M('blue')
      if (t < -3) return (x + y) % 2 ? M('blue') : M('violet')
      if (t < 5) return M('violet')
      if (t < 8) return (x + y) % 2 ? M('violet') : M('pink')
      return M('pink')
    })
    // cape-like chuuni sparkle ribbon
    g.set(cx + 13, cy - 13, F('cream', 0)); g.set(cx + 12, cy - 13, F('cream', 0)); g.set(cx + 14, cy - 13, F('cream', 0)); g.set(cx + 13, cy - 14, F('cream', 0)); g.set(cx + 13, cy - 12, F('cream', 0))
    face(g, cx + 1, cy, p, 'round', 4)
    arm(g, cx + 8, cy + 3, p.arm, true, M('violet'))
    fx(g, p, cx, cy - ry, cy)
  },
}

/* 4. Grok — 黑洞仔：墨黑球体 + 金色吸积环 + 斜穿而过的白光“/” + 发光坏笑眼 */
const mech: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, R = 14
    const cy = G - 8 - R * p.sy - p.jump
    // ring, back half
    for (let a = 180; a <= 360; a += 3) { const r = (a * Math.PI) / 180; g.ellipse(cx + Math.cos(r) * 24 * p.sx, cy + Math.sin(r) * 6, 1, 1, M('gold')) }
    arm(g, cx - 11, cy + 5, p.arm, false, M('ink'))
    g.ellipse(cx, cy, R * p.sx, R * p.sy, M('ink'))
    // light slash "/"
    g.line(cx - 22, cy + 16, cx + 6, cy - 22, F('cream', 0), 2)
    g.line(cx - 21, cy + 16, cx + 6, cy - 21, F('cyan', 1), 1)
    // ring, front half
    for (let a = 0; a <= 180; a += 3) { const r = (a * Math.PI) / 180; g.ellipse(cx + Math.cos(r) * 24 * p.sx, cy + Math.sin(r) * 6, 1, 1, M('gold')) }
    // stubby feet
    g.ellipse(cx - 5, G - 2, 3, 2, M('ink')); g.ellipse(cx + 6, G - 2, 3, 2, M('ink'))
    face(g, cx + 4, cy - 1, p, 'glow', 4, F('cream', 0))
    arm(g, cx + 11, cy + 5, p.arm, true, M('ink'))
    fx(g, p, cx, cy - R, cy)
  },
}

/* 5. DeepSeek — 小蓝鲸：圆滚滚蓝鲸，奶白肚皮，翘尾，头顶喷泉，红色中二头带 */
const whale: Def = {
  draw(g, p) {
    const cx = 34 + p.lean, rx = 18 * p.sx, ry = 14 * p.sy
    const cy = G - ry - 1 - p.jump
    // tail flipping up behind
    const ty = p.arm === 'fwd' ? -6 : 0
    g.poly([[cx - rx + 4, cy + 4], [cx - rx - 8, cy - 8 + ty], [cx - rx - 2, cy - 4 + ty], [cx - rx + 6, cy]], M('blue'))
    g.ellipse(cx - rx - 8, cy - 11 + ty, 4, 3, M('blue')); g.ellipse(cx - rx - 2, cy - 12 + ty, 3, 3, M('blue'))
    arm(g, cx - 6, cy + 3, p.arm, false, M('navy'))
    g.ellipse(cx, cy, rx, ry, M('blue'))
    g.ellipse(cx + 3, cy + ry * 0.45, rx * 0.75, ry * 0.5, M('cream'))
    g.map((_x, y, c) => (c === M('cream') && y < cy + 2 ? M('blue') : c))
    // headband
    g.rect(cx - rx * 0.7, cy - ry * 0.7, rx * 1.4, 2, M('red'))
    g.line(cx - rx * 0.7, cy - ry * 0.7, cx - rx - 4, cy - ry + (p.arm === 'fwd' ? -6 : 0), M('red'), 2)
    // spout
    if (p.mood !== 'ko') for (let k = 0; k < 3; k++) { g.rect(cx + 2 + k * 2 - 2, cy - ry - 4 - k * 3 - (p.mood === 'happy' ? 3 : 0), 2, 2, F('cyan', 1)); g.rect(cx + 6 - k * 2, cy - ry - 4 - k * 3 - (p.mood === 'happy' ? 3 : 0), 2, 2, F('cyan', 0)) }
    face(g, cx + 6, cy - 2, p, 'round', 5)
    arm(g, cx + 6, cy + 4, p.arm, true, M('navy'))
    fx(g, p, cx, cy - ry - 2, cy)
  },
}

/* 6. Qwen — 卡皮巴拉：圆桶身、小圆耳、大鼻头、永远半睁眼的淡定脸、白 T 恤、头顶柚子 */
const scholar: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 16 * p.sx, ry = 17 * p.sy
    const cy = G - ry - 3 - p.jump
    g.rect(cx - 9, G - 5, 5, 5, M('tan')); g.rect(cx + 5, G - 5, 5, 5, M('tan'))
    arm(g, cx - 12, cy + 5, p.arm, false, M('tan'), 4)
    g.ellipse(cx, cy, rx, ry, M('tan'))
    // T-shirt
    g.map((x, y, c) => (c === M('tan') && y > cy + 3 && Math.abs(x - cx) < rx ? M('cream') : c))
    g.rect(cx - 5, cy + 6, 10, 1, F('violet', 1))
    // ears + snout
    g.ellipse(cx - 7, cy - ry + 1, 3, 2, M('tan')); g.ellipse(cx + 5, cy - ry + 1, 3, 2, M('tan'))
    g.ellipse(cx + 11 * p.sx, cy + 1, 6, 4, M('brown'))
    g.rect(cx + 14 * p.sx, cy - 1, 3, 2, K)
    // yuzu on head
    if (p.mood !== 'hurt') { g.ellipse(cx - 1, cy - ry - 4 + (p.mood === 'ko' ? 3 : 0), 4, 3, M('orange')); g.set(cx, cy - ry - 8, F('green', 1)); g.set(cx + 1, cy - ry - 8, F('green', 2)) }
    face(g, cx - 2, cy - 7, { ...p, mouth: 'flat' }, p.mood === 'n' ? 'sleepy' : 'round', 5)
    arm(g, cx + 12, cy + 5, p.arm, true, M('tan'), 4)
    fx(g, p, cx, cy - ry - 4, cy - 6)
  },
}

/* 7. Kimi — 月牙：金色弯月身体，蓝色睡帽，小蓝星跟班 */
const rabbit: Def = {
  draw(g, p) {
    const cx = 30 + p.lean, R = 19
    const cy = G - 5 - R * p.sy - p.jump
    g.ellipse(cx - 2, G - 2, 3, 2, M('ink')); g.ellipse(cx + 8, G - 2, 3, 2, M('ink'))
    arm(g, cx - 4, cy + 6, p.arm, false, M('gold'))
    g.ellipse(cx, cy, R * p.sx, R * p.sy, M('gold'))
    // carve the crescent: everything inside the offset circle goes away
    const ox = cx + 11 * p.sx, oy = cy - 4
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = (x - ox) / (15 * p.sx), dy = (y - oy) / (15 * p.sy)
      if (dx * dx + dy * dy <= 1 && g.get(x, y) === M('gold')) g.set(x, y, 0)
    }
    // nightcap on the upper horn
    g.poly([[cx - 6, cy - R * p.sy + 2], [cx + 4, cy - R * p.sy - 2], [cx + 14, cy - R * p.sy - 10 + (p.arm === 'fwd' ? 4 : 0)]], M('navy'))
    g.ellipse(cx + 14, cy - R * p.sy - 10 + (p.arm === 'fwd' ? 4 : 0), 2, 2, M('cream'))
    face(g, cx - 7, cy + 2, p, 'round', 4)
    // little blue star buddy
    const sx = cx + 16, sy = cy + 8 - (p.mood === 'happy' ? 6 : 0)
    g.set(sx, sy, F('blue', 0)); g.set(sx - 1, sy, F('blue', 1)); g.set(sx + 1, sy, F('blue', 1)); g.set(sx, sy - 1, F('blue', 1)); g.set(sx, sy + 1, F('blue', 1))
    arm(g, cx + 2, cy + 8, p.arm, true, M('gold'))
    fx(g, p, cx - 6, cy - R * p.sy, cy + 2)
  },
}

/* 8. GLM — Z 宝：蓝紫渐变方头机器人，屏幕脸，知识图谱节点天线，胸口金色 Z 闪电 */
const fox: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, hw = 26 * p.sx, hh = 20 * p.sy
    const bodyTop = G - 14 * p.sy - 4 - p.jump
    const top = bodyTop - hh + 2
    g.rect(cx - 7, G - 5, 4, 5, M('gun')); g.rect(cx + 4, G - 5, 4, 5, M('gun'))
    arm(g, cx - 9, bodyTop + 4, p.arm, false, M('gun'))
    g.rect(cx - 9 * p.sx, bodyTop, 18 * p.sx, 14 * p.sy, M('navy'))
    // Z bolt
    const zx = cx - 3, zy = bodyTop + 3
    g.rect(zx, zy, 6, 1, F('gold', 0)); g.line(zx + 5, zy + 1, zx, zy + 6, F('gold', 1)); g.rect(zx, zy + 7, 6, 1, F('gold', 0))
    // antenna graph
    g.line(cx - 4, top, cx - 8, top - 7, F('steel', 2)); g.line(cx - 8, top - 7, cx + 2, top - 10, F('steel', 2)); g.line(cx + 4, top, cx + 2, top - 10, F('steel', 2))
    g.ellipse(cx - 8, top - 7, 1.4, 1.4, F('cyan', 1)); g.ellipse(cx + 2, top - 10, 1.6, 1.6, F('cyan', 0))
    // head with navy→violet gradient
    g.rect(cx - hw / 2, top, hw, hh, M('navy'))
    g.rect(cx - hw / 2 + 1, top - 1, hw - 2, 1, M('navy')); g.rect(cx - hw / 2 + 1, top + hh, hw - 2, 1, M('navy'))
    g.map((x, y, c) => (c === M('navy') && y < bodyTop && y - top > hh * 0.55 + ((x + y) % 2) ? M('violet') : c))
    // screen
    g.rect(cx - hw / 2 + 3, top + 3, hw - 6, hh - 6, F('ink', 3))
    face(g, cx + 1, top + hh / 2 - 1, p, 'glow', 5, F('cyan', 1))
    arm(g, cx + 9, bodyTop + 4, p.arm, true, M('gun'))
    fx(g, p, cx, top - 4, top + hh / 2)
  },
}


/* ---------------- v5 roster: more labs ---------------- */
/* Meta — 无限环：∞ 双环身体，眼睛就在两个环洞里 */
const meta: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, cy = G - 16 * p.sy - 4 - p.jump
    g.ellipse(cx - 5, G - 2, 3, 2, M('navy')); g.ellipse(cx + 6, G - 2, 3, 2, M('navy'))
    arm(g, cx - 18 * p.sx, cy + 3, p.arm, false, M('navy'))
    for (const s of [-1, 1]) g.ellipse(cx + s * 10 * p.sx, cy, 12 * p.sx, 11 * p.sy, M('blue'))
    g.map((x, _y, c) => (c === M('blue') && x > cx + 4 ? M('navy') : c))
    for (const s of [-1, 1]) g.ellipse(cx + s * 10 * p.sx, cy, 5 * p.sx, 5 * p.sy, 0)
    face(g, cx, cy, p, 'round', Math.round(10 * p.sx))
    arm(g, cx + 18 * p.sx, cy + 3, p.arm, true, M('navy'))
    fx(g, p, cx, cy - 12 * p.sy, cy)
  },
}
/* Mistral — 像素疾风 M：黄→橙→红条纹的方块 M 身体，背后一缕风 */
const mistral: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, w = 30 * p.sx, h = 26 * p.sy
    const top = G - h - 4 - p.jump, l = cx - w / 2, u = w / 5
    g.rect(cx - 8, G - 4, 4, 4, M('red')); g.rect(cx + 4, G - 4, 4, 4, M('red'))
    for (let k = 0; k < 3; k++) g.line(l - 12, top + 6 + k * 6, l - 3, top + 4 + k * 6 + (k % 2 ? 2 : -1), F('cream', 1))
    arm(g, l + 1, top + h / 2 + 2, p.arm, false, M('orange'))
    g.rect(l, top, u * 1.4, h, M('gold')); g.rect(l + w - u * 1.4, top, u * 1.4, h, M('gold'))
    g.rect(l + u, top, u, h * 0.55, M('gold')); g.rect(l + w - 2 * u, top, u, h * 0.55, M('gold')); g.rect(cx - u / 2, top + h * 0.25, u, h * 0.5, M('gold'))
    g.map((_x, y, c) => (c !== M('gold') ? c : y - top < h * 0.3 ? M('gold') : y - top < h * 0.6 ? M('orange') : M('red')))
    g.rect(l + 2, top + 3, w - 4, 9, F('cream', 1))
    face(g, cx + 1, top + 7, { ...p, mouth: p.mouth === 'smile' ? 'flat' : p.mouth }, 'dot', 6)
    arm(g, l + w - 1, top + h / 2 + 2, p.arm, true, M('orange'))
    fx(g, p, cx, top - 3, top + 7)
  },
}
/* ByteDance — 豆包：白胖包子，顶部褶子，额头一颗红豆 */
const bytedance: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 18 * p.sx, ry = 14 * p.sy
    const cy = G - ry - 2 - p.jump
    arm(g, cx - 13, cy + 5, p.arm, false, M('cream'))
    g.ellipse(cx, cy, rx, ry, M('cream'))
    g.poly([[cx - 5, cy - ry + 2], [cx, cy - ry - 5], [cx + 5, cy - ry + 2]], M('cream'))
    for (const d of [-8, -4, 4, 8]) g.line(cx, cy - ry - 3, cx + d, cy - ry + 5, F('cream', 2))
    g.ellipse(cx, cy - ry + 6, 1.5, 1.2, F('red', 1))
    face(g, cx + 1, cy + 1, p, 'dot', 6)
    arm(g, cx + 13, cy + 5, p.arm, true, M('cream'))
    fx(g, p, cx, cy - ry - 4, cy + 1)
  },
}
/* Tencent — 混元企鹅：黑白胖企鹅，金黄嘴和脚，红围巾 */
const tencent: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 15 * p.sx, ry = 18 * p.sy
    const cy = G - ry - 3 - p.jump
    g.ellipse(cx - 6, G - 2, 4, 2, M('gold')); g.ellipse(cx + 6, G - 2, 4, 2, M('gold'))
    arm(g, cx - 12, cy + 4, p.arm, false, M('ink'), 4)
    g.ellipse(cx, cy, rx, ry, M('ink'))
    g.ellipse(cx + 1, cy + 5, rx * 0.7, ry * 0.62, M('cream'))
    g.rect(cx - rx + 2, cy - 2, rx * 2 - 4, 3, M('red'))
    g.line(cx - rx + 3, cy - 1, cx - rx - 4, cy + 7 + (p.arm === 'fwd' ? -6 : 0), M('red'), 2)
    face(g, cx + 1, cy - 9, { ...p, mouth: 'flat' }, 'round', 4)
    g.ellipse(cx + 2, cy - 4, 3, 1.5, M('gold'))
    arm(g, cx + 12, cy + 4, p.arm, true, M('ink'), 4)
    fx(g, p, cx, cy - ry, cy - 9)
  },
}
/* NVIDIA — 绿瞳芯：绿色芯片机器人，四周针脚，胸口漩涡“瞳” */
const nvidia: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, w = 28 * p.sx, h = 28 * p.sy
    const top = G - h - 4 - p.jump, l = cx - w / 2
    g.rect(cx - 7, G - 4, 4, 4, M('gun')); g.rect(cx + 4, G - 4, 4, 4, M('gun'))
    arm(g, l, top + h / 2 + 3, p.arm, false, M('gun'))
    for (let k = 0; k < 5; k++) { g.rect(l + 3 + k * (w - 8) / 4, top - 2, 2, 2, F('steel', 1)); g.rect(l + 3 + k * (w - 8) / 4, top + h, 2, 2, F('steel', 1)) }
    g.rect(l, top, w, h, M('green'))
    g.rect(l + 3, top + 3, w - 6, 10, F('ink', 3))
    face(g, cx + 1, top + 7, { ...p, mouth: 'flat' }, 'glow', 5, F('green', 0))
    // swirl "eye"
    for (let a = 0; a < 540; a += 20) { const r = 1 + a / 90, t = (a * Math.PI) / 180; g.set(cx + Math.cos(t) * r, top + h - 8 + Math.sin(t) * r * 0.8, F('cream', 0)) }
    arm(g, l + w, top + h / 2 + 3, p.arm, true, M('gun'))
    fx(g, p, cx, top - 4, top + 7)
  },
}
/* MiniMax — 波形怪：粉色团子，头顶一排会跳的声波柱 */
const minimax: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 16 * p.sx, ry = 14 * p.sy
    const cy = G - ry - 3 - p.jump
    g.ellipse(cx - 6, G - 2, 3, 2, M('red')); g.ellipse(cx + 6, G - 2, 3, 2, M('red'))
    const hs = p.mood === 'ko' ? [1, 1, 1, 1, 1] : p.mood === 'angry' ? [6, 11, 15, 11, 6] : [4, 8, 12, 7, 5]
    hs.forEach((hh, k) => g.rect(cx - 11 + k * 5, cy - ry - hh + 3, 3, hh, M('red')))
    arm(g, cx - 13, cy + 4, p.arm, false, M('pink'))
    g.ellipse(cx, cy, rx, ry, M('pink'))
    face(g, cx + 1, cy, p, 'round', 5)
    arm(g, cx + 13, cy + 4, p.arm, true, M('pink'))
    fx(g, p, cx, cy - ry - 8, cy)
  },
}
/* Amazon — 包裹侠：纸箱身体、胶带，嘴是一道橙色微笑箭头 */
const amazon: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, w = 30 * p.sx, h = 24 * p.sy
    const top = G - h - 4 - p.jump, l = cx - w / 2
    g.rect(cx - 8, G - 4, 4, 4, M('brown')); g.rect(cx + 4, G - 4, 4, 4, M('brown'))
    arm(g, l, top + h / 2 + 2, p.arm, false, M('tan'))
    const flap = p.arm === 'fwd' || p.mood === 'happy' ? -6 : -3
    g.poly([[l, top], [l + 10, top], [l + 2, top + flap]], M('tan')); g.poly([[l + w, top], [l + w - 10, top], [l + w - 2, top + flap]], M('tan'))
    g.rect(l, top, w, h, M('tan'))
    g.rect(cx - 2, top, 4, h, F('tan', 0))
    face(g, cx + 1, top + 8, { ...p, mouth: 'flat' }, 'dot', 7)
    if (p.mood !== 'ko' && p.mood !== 'hurt') { g.line(cx - 7, top + 14, cx - 2, top + 16, F('orange', 1)); g.line(cx - 2, top + 16, cx + 6, top + 14, F('orange', 1)); g.line(cx + 6, top + 14, cx + 4, top + 13, F('orange', 1)); g.line(cx + 6, top + 14, cx + 5, top + 16, F('orange', 1)) }
    else g.rect(cx - 2, top + 14, 4, 2, K)
    arm(g, l + w, top + h / 2 + 2, p.arm, true, M('tan'))
    fx(g, p, cx, top - 4, top + 8)
  },
}
/* Microsoft — 四色方块：红绿蓝黄四块拼成的方脑袋 */
const microsoft: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, s = 13 * p.sx, sv = 13 * p.sy
    const top = G - sv * 2 - 6 - p.jump
    g.ellipse(cx - 6, G - 2, 3, 2, M('ink')); g.ellipse(cx + 6, G - 2, 3, 2, M('ink'))
    arm(g, cx - s - 1, top + sv + 2, p.arm, false, M('ink'))
    g.rect(cx - s - 1, top, s, sv, M('red')); g.rect(cx + 1, top, s, sv, M('green'))
    g.rect(cx - s - 1, top + sv + 2, s, sv, M('blue')); g.rect(cx + 1, top + sv + 2, s, sv, M('gold'))
    face(g, cx, top + sv / 2 + 1, { ...p, mouth: 'flat' }, 'round', 7)
    const mm = { ...p }; face(g, cx, top + sv + 1, { ...mm, mood: 'n', mouth: p.mouth }, 'dot', 99)
    arm(g, cx + s + 1, top + sv + 2, p.arm, true, M('ink'))
    fx(g, p, cx, top - 4, top + sv / 2)
  },
}
/* Cohere — 珊瑚团子：绿、珊瑚粉、紫三团叠在一起 */
const cohere: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, cy = G - 15 * p.sy - 3 - p.jump
    g.ellipse(cx - 12 * p.sx, cy + 6, 8 * p.sx, 8 * p.sy, M('violet'))
    g.ellipse(cx + 12 * p.sx, cy + 4, 9 * p.sx, 9 * p.sy, M('clay'))
    arm(g, cx - 14, cy + 4, p.arm, false, M('green'))
    g.ellipse(cx, cy, 14 * p.sx, 14 * p.sy, M('green'))
    face(g, cx + 1, cy - 1, p, 'round', 5)
    arm(g, cx + 14, cy + 4, p.arm, true, M('green'))
    fx(g, p, cx, cy - 14 * p.sy, cy)
  },
}
/* StepFun — 阶跃君：三级台阶身体，顶上插着小旗 */
const stepfun: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, st = 8 * p.sy, w = 12 * p.sx
    const base = G - 2 - p.jump, l = cx - w * 1.5
    arm(g, l + 2, base - st * 1.5, p.arm, false, M('navy'))
    for (let k = 0; k < 3; k++) g.rect(l + k * w, base - st * (k + 1), w * (3 - k), st * (k + 1), M('blue'))
    g.map((x, _y, c) => (c === M('blue') && x > l + w * 2 ? M('navy') : c))
    const fx0 = l + w * 2.6, fy = base - st * 3
    g.line(fx0, fy, fx0, fy - 10, F('steel', 2)); g.poly([[fx0, fy - 10], [fx0 + 7, fy - 8], [fx0, fy - 6]], F('cyan', 1))
    face(g, l + w * 1.4, base - st * 1.3, p, 'round', 5)
    arm(g, l + w * 3, base - st * 2, p.arm, true, M('navy'))
    fx(g, p, cx, fy - 2, base - st * 1.3)
  },
}
/* Baidu — 熊掌宝：蓝色熊崽，肚子上奶白熊掌印 */
const baidu: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 15 * p.sx, ry = 16 * p.sy
    const cy = G - ry - 3 - p.jump
    g.ellipse(cx - 6, G - 2, 4, 2, M('navy')); g.ellipse(cx + 6, G - 2, 4, 2, M('navy'))
    g.ellipse(cx - 10 * p.sx, cy - ry + 2, 4, 4, M('navy')); g.ellipse(cx + 9 * p.sx, cy - ry + 2, 4, 4, M('navy'))
    arm(g, cx - 12, cy + 5, p.arm, false, M('navy'), 4)
    g.ellipse(cx, cy, rx, ry, M('blue'))
    g.ellipse(cx + 1, cy + 8, 4, 3, F('cream', 1))
    for (const d of [-5, -2, 2, 5]) g.ellipse(cx + 1 + d, cy + 3 - (Math.abs(d) < 3 ? 1 : 0), 1, 1, F('cream', 1))
    face(g, cx + 1, cy - 5, p, 'round', 5)
    arm(g, cx + 12, cy + 5, p.arm, true, M('navy'), 4)
    fx(g, p, cx, cy - ry - 2, cy - 5)
  },
}
/* Xiaomi — 米兔：长耳白兔，戴红色雷锋帽（金星），橙色围巾 */
const xiaomi: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, rx = 14 * p.sx, ry = 14 * p.sy
    const cy = G - ry - 3 - p.jump
    g.ellipse(cx - 5, G - 2, 3, 2, M('cream')); g.ellipse(cx + 6, G - 2, 3, 2, M('cream'))
    const droop = p.mood === 'hurt' || p.mood === 'ko' ? 6 : 0
    g.ellipse(cx - 6, cy - ry - 6 + droop, 2.5, 7, M('cream')); g.ellipse(cx + 5, cy - ry - 7 + droop, 2.5, 7, M('cream'))
    arm(g, cx - 12, cy + 5, p.arm, false, M('cream'))
    g.ellipse(cx, cy, rx, ry, M('cream'))
    g.rect(cx - rx, cy - ry + 1, rx * 2, 6, M('red')); g.rect(cx - rx - 2, cy - ry + 5, 5, 6, M('red'))
    g.set(cx + 1, cy - ry + 3, F('gold', 0)); g.set(cx, cy - ry + 3, F('gold', 1)); g.set(cx + 2, cy - ry + 3, F('gold', 1)); g.set(cx + 1, cy - ry + 2, F('gold', 1))
    g.rect(cx - rx + 2, cy + 8, rx * 2 - 4, 3, M('orange'))
    face(g, cx + 1, cy + 1, p, 'round', 5)
    arm(g, cx + 12, cy + 5, p.arm, true, M('cream'))
    fx(g, p, cx, cy - ry - 8, cy + 1)
  },
}
/* 神秘挑战者：兜帽斗篷，暗脸发光眼，胸口问号；颜色换成该厂商主色 */
const mystery: Def = {
  draw(g, p) {
    const cx = 32 + p.lean, h = 34 * p.sy
    const top = G - h - 1 - p.jump
    arm(g, cx - 11, top + 18, p.arm, false, M('mys'))
    g.poly([[cx, top - 4], [cx + 15 * p.sx, top + 12], [cx + 16 * p.sx, G - 1], [cx - 16 * p.sx, G - 1], [cx - 15 * p.sx, top + 12]], M('mys'))
    g.ellipse(cx + 1, top + 10, 9 * p.sx, 7, F('ink', 3))
    face(g, cx + 2, top + 9, { ...p, mouth: 'flat' }, 'glow', 4, F('ink', 3))
    const qx = cx - 1, qy = top + 20
    g.rect(qx - 2, qy, 5, 1, F('cream', 0)); g.set(qx + 3, qy + 1, F('cream', 0)); g.set(qx + 3, qy + 2, F('cream', 0)); g.set(qx + 2, qy + 3, F('cream', 0)); g.set(qx + 1, qy + 4, F('cream', 0)); g.set(qx + 1, qy + 6, F('cream', 0))
    arm(g, cx + 11, top + 18, p.arm, true, M('mys'))
    fx(g, p, cx, top - 4, top + 9)
  },
}

export const FIGHTERS: Record<Avatar, Def> = { knight, dragon, mage, mech, whale, scholar, rabbit, fox, meta, mistral, bytedance, tencent, nvidia, minimax, amazon, microsoft, cohere, stepfun, baidu, xiaomi, mystery }

const cache = new Map<string, HTMLCanvasElement>()
const sheets = new Map<Avatar, HTMLImageElement>()

/** Optional pre-rendered sheets (public/arena-sprites/<avatar>.png, 12 × 68px). */
export function preloadSheets(only?: string[]): Promise<void> {
  const avatars = (only ? [...new Set(only.map(baseAvatar))] : (Object.keys(FIGHTERS) as Avatar[])).filter((a) => !sheets.has(a))
  return Promise.all(avatars.map((a) => new Promise<void>((res) => {
    const img = new Image()
    img.onload = () => { sheets.set(a, img); res() }
    img.onerror = () => res()
    img.src = `/arena-sprites/${a}.png`
  }))).then(() => undefined)
}

/** procedural render (used by the sheet exporter and as fallback) */
export function renderFrame(avatar: Avatar, pose: FPose, opts: { white?: boolean; glow?: string } = {}): HTMLCanvasElement {
  const g = new Px(64, 64)
  ;(FIGHTERS[avatar] ?? FIGHTERS.mystery).draw(g, POSES[pose])
  return renderPx(g, opts)
}

/** split 'mystery#c8783c' → base avatar + tint */
export function baseAvatar(a: string): Avatar {
  const b = a.split('#')[0] as Avatar
  return b in FIGHTERS ? b : 'mystery'
}
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
/** recolour the neutral 'mys' ramp to a lab's brand colour */
function recolour(src: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = src.width; cv.height = src.height
  const c = cv.getContext('2d')!
  c.drawImage(src, 0, 0)
  const img = c.getImageData(0, 0, cv.width, cv.height)
  const [r, g, b] = hex(colour)
  const tones: Record<string, number> = { d4d4d4: 1.45, '9c9c9c': 1, '646464': 0.62, '2c2c2c': 0.28 }
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0')
    const t = tones[k]
    if (t === undefined || d[i + 3] === 0) continue
    d[i] = Math.min(255, r * t); d[i + 1] = Math.min(255, g * t); d[i + 2] = Math.min(255, b * t)
  }
  c.putImageData(img, 0, 0)
  return cv
}

function tint(src: CanvasImageSource, w: number, h: number, colour: string, outlineOnly: boolean): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const c = cv.getContext('2d')!
  if (!outlineOnly) {
    c.drawImage(src, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = colour
    c.fillRect(0, 0, w, h)
    return cv
  }
  // 1px glow ring around the sprite
  const base = document.createElement('canvas')
  base.width = w; base.height = h
  const b = base.getContext('2d')!
  b.drawImage(src, 0, 0)
  b.globalCompositeOperation = 'source-in'
  b.fillStyle = colour
  b.fillRect(0, 0, w, h)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.drawImage(base, dx, dy)
  c.drawImage(src, 0, 0)
  return cv
}

/** 68×68 frame, facing right. Uses the PNG sheet when loaded. */
export function fighterFrame(avatarIn: string, pose: FPose, opts: { white?: boolean; glow?: string } = {}): HTMLCanvasElement {
  const tintCol = avatarIn.includes('#') ? '#' + avatarIn.split('#')[1] : ''
  const avatar = baseAvatar(avatarIn)
  if (tintCol && !opts.white) {
    const k2 = `${avatarIn}|${pose}|${opts.glow ?? ''}`
    const h2 = cache.get(k2)
    if (h2) return h2
    const out = recolour(fighterFrame(avatar, pose, opts), tintCol)
    cache.set(k2, out)
    return out
  }
  const key = `${avatar}|${pose}|${opts.white ? 1 : 0}|${opts.glow ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  let cv: HTMLCanvasElement
  const sheet = sheets.get(avatar)
  if (sheet) {
    const base = document.createElement('canvas')
    base.width = 68; base.height = 68
    base.getContext('2d')!.drawImage(sheet, POSE_LIST.indexOf(pose) * 68, 0, 68, 68, 0, 0, 68, 68)
    cv = opts.white ? tint(base, 68, 68, '#ffffff', false) : opts.glow ? tint(base, 68, 68, opts.glow, true) : base
  } else cv = renderFrame(avatar, pose, opts)
  cache.set(key, cv)
  return cv
}
