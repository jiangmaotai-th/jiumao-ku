import { RING_RADIUS, TUBE_R, add, clamp, lerp, project, rotate } from './math.js'
import { coinFor } from './items.js'

export function createView(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true })
  const plate = new Image()
  plate.src = '/goose/ui-design.png'
  const mat = new Image()
  mat.src = '/goose/mat-texture.png'
  const fx = []
  const rain = Array.from({ length: 70 }, () => ({
    x: Math.random(), y: Math.random(), l: 12 + Math.random() * 18, sp: 0.018 + Math.random() * 0.02,
  }))

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w, h, dpr }
  }

  function burst(kind, p) {
    fx.push({ kind, x: p.x, y: p.y, t: 0, label: p.label || '', text: p.text || '' })
    if (kind === 'catch') {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2
        fx.push({ kind: 'spark', x: p.x, y: p.y, t: 0, vx: Math.cos(a) * (80 + Math.random() * 70), vy: Math.sin(a) * (80 + Math.random() * 70) })
      }
    }
  }

  function dust(p, speed) {
    if (speed <= 2.6) return
    for (let i = 0; i < 8; i++) fx.push({ kind: 'dust', x: p.x, y: p.y, t: 0, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 20 })
  }

  function draw(state) {
    const { w, h, cam, prizes, rings, t, rainOn, aim, preview, holdScr, power, bossLine, coinTags, run } = state
    ctx.save()
    ctx.clearRect(0, 0, w, h)
    if (!(plate.complete && plate.width)) {
      ctx.fillStyle = '#140c10'
      ctx.fillRect(0, 0, w, h)
    }

    drawMat(ctx, cam, mat)
    drawShadows(ctx, cam, prizes, rings)

    const sprites = []
    for (const p of prizes) {
      if (p.hidden) continue
      const bodyC = project({ x: p.curX, y: p.bodyR * 0.8, z: p.curZ }, cam)
      const headS = project(p.head, cam)
      sprites.push({ zc: (bodyC.zc + headS.zc) / 2, kind: 'prize', p })
      if (!p.scored) {
        const tag = tagWorld(p)
        sprites.push({ zc: project(tag, cam).zc, kind: 'tag', p })
      }
    }
    for (const r of rings) {
      if (r.collected || !r.body) continue
      const pose = { t: r.body.translation(), r: r.body.rotation() }
      const pts = ringPts(cam, pose, r.radius || RING_RADIUS)
      for (let i = 0; i < 64; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        sprites.push({ zc: (a.zc + b.zc) / 2, kind: 'ringseg', a, b, th: a.th, tube: r.tube || TUBE_R })
      }
      if (r.trail?.length > 1) sprites.push({ zc: project(pose.t, cam).zc, kind: 'trail', ring: r })
    }
    sprites.sort((a, b) => a.zc - b.zc)
    for (const s of sprites) {
      if (s.kind === 'tag') drawTag(ctx, cam, s.p, coinTags, run)
      else if (s.kind === 'prize') drawGoose(ctx, cam, s.p)
      else if (s.kind === 'trophy') drawTrophy(ctx, cam, s.p)
      else if (s.kind === 'trail') drawTrail(ctx, s.ring)
      else drawRingSeg(ctx, s.a, s.b, s.th, s.tube)
    }

    drawFx(ctx)
    if (aim) drawAim(ctx, cam, aim, power, preview, holdScr)
    if (rainOn) drawRain(ctx, w, h)
    ctx.restore()
    void bossLine
  }

  function drawMat(c, cam, img) {
    const z0 = 1.15
    const z1 = 3.78
    const strips = 48
    for (let i = 0; i < strips; i++) {
      const u0 = i / strips
      const u1 = (i + 1) / strips
      const za = lerp(z1, z0, u0)
      const zb = lerp(z1, z0, u1)
      const a = project({ x: -1.05, y: 0, z: za }, cam)
      const b = project({ x: 1.05, y: 0, z: za }, cam)
      const d = project({ x: -1.05, y: 0, z: zb }, cam)
      const e = project({ x: 1.05, y: 0, z: zb }, cam)
      if (!a.vis && !d.vis) continue
      c.save()
      c.beginPath()
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(e.x, e.y); c.lineTo(d.x, d.y)
      c.closePath()
      c.clip()
      if (img.complete && img.width) {
        const y = Math.min(a.y, b.y, d.y, e.y)
        const h = Math.max(a.y, b.y, d.y, e.y) - y
        const sy = (1 - u1) * img.height
        const sh = Math.max(1, (u1 - u0) * img.height)
        c.drawImage(img, 0, sy, img.width, sh, Math.min(a.x, d.x), y, Math.max(b.x, e.x) - Math.min(a.x, d.x), Math.max(2, h))
      } else {
        c.fillStyle = i % 2 ? '#7a1f28' : '#1d3557'
        c.fill()
      }
      c.restore()
    }
  }

  function plateCover(w, h) {
    const pw = plate.width
    const ph = plate.height
    if (!pw || !ph) return null
    const scale = Math.max(w / pw, h / ph)
    const dw = pw * scale
    const dh = ph * scale
    return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh }
  }

  function stampProps(c, w, h) {
    if (!plate.complete || !plate.width) return
    const r = plateCover(w, h)
    if (!r) return
    const left = r.dx + r.dw * 0.11
    const right = r.dx + r.dw * 0.87
    const top = r.dy + r.dh * 0.42
    c.save()
    c.beginPath()
    c.rect(0, top, left, h - top)
    c.rect(right, top, w - right, h - top)
    c.clip()
    c.drawImage(plate, r.dx, r.dy, r.dw, r.dh)
    c.restore()
  }

  function drawGlows(c, cam, t) {
    c.save()
    c.globalCompositeOperation = 'lighter'
    const spots = [
      { x: -0.7, z: 2.1 },
      { x: 0.15, z: 2.8 },
      { x: 0.75, z: 1.9 },
    ]
    spots.forEach((s, i) => {
      const p = project({ x: s.x, y: 0.02, z: s.z }, cam)
      if (!p.vis) return
      const a = 0.16 + Math.sin(t * 7 + i) * 0.06
      const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 70)
      g.addColorStop(0, `rgba(255,170,80,${a})`)
      g.addColorStop(1, 'rgba(255,120,40,0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(p.x, p.y, 70, 0, Math.PI * 2)
      c.fill()
    })
    c.restore()
  }

  function drawShadows(c, cam, prizes, rings) {
    for (const p of prizes) {
      if (p.hidden) continue
      const s = project({ x: p.curX, y: 0.01, z: p.curZ }, cam)
      if (!s.vis) continue
      const a = 0.38 * Math.max(0.12, 1 - 0.02 / 1.4)
      c.fillStyle = `rgba(0,0,0,${a})`
      c.beginPath()
      c.ellipse(s.x, s.y, (p.bodyR + 0.02) * s.s, (p.bodyR + 0.02) * s.s * 0.4, 0, 0, Math.PI * 2)
      c.fill()
    }
    for (const r of rings) {
      if (r.collected || !r.body) continue
      const t = r.body.translation()
      const a = 0.38 * Math.max(0.12, 1 - t.y / 1.4)
      const s = project({ x: t.x, y: 0.01, z: t.z }, cam)
      if (!s.vis) continue
      c.fillStyle = `rgba(0,0,0,${a})`
      c.beginPath()
      c.ellipse(s.x, s.y, (r.radius || RING_RADIUS) * s.s, (r.radius || RING_RADIUS) * s.s * 0.4, 0, 0, Math.PI * 2)
      c.fill()
    }
  }

  function drawGoose(c, cam, p) {
    const bodyC = project({ x: p.curX, y: p.bodyR * 0.8, z: p.curZ }, cam)
    const bn = project({ x: p.curX, y: p.bodyR * 1.2, z: p.curZ - p.bodyR * 0.3 }, cam)
    const headS = project(p.head, cam)
    if (!bodyC.vis && !headS.vis) return
    const s = bodyC.s || headS.s
    const rx = p.bodyR * 1.18 * s
    const ry = p.bodyR * 0.85 * s

    const g = c.createLinearGradient(bodyC.x, bodyC.y - ry, bodyC.x, bodyC.y + ry)
    g.addColorStop(0, '#f7f4ec')
    g.addColorStop(0.6, '#e8e3d5')
    g.addColorStop(1, '#b3ad9d')
    c.fillStyle = g
    c.beginPath()
    c.ellipse(bodyC.x, bodyC.y, rx, ry, 0, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgba(90,84,70,0.5)'
    c.lineWidth = Math.max(1, 0.004 * s)
    c.stroke()

    c.strokeStyle = 'rgba(120,114,98,0.5)'
    c.lineWidth = Math.max(1, 0.003 * s)
    c.beginPath()
    c.ellipse(bodyC.x - rx * 0.08, bodyC.y + ry * 0.1, rx * 0.55, ry * 0.42, -0.2, 0.3, Math.PI - 0.3)
    c.stroke()

    c.fillStyle = '#e8e3d5'
    c.beginPath()
    c.ellipse(bodyC.x, bodyC.y - ry * 0.75, rx * 0.3, ry * 0.28, 0, 0, Math.PI * 2)
    c.fill()

    const nw = Math.max(1.5, p.neckR * 2.1 * s)
    const midX = (bn.x + headS.x) / 2 + (headS.x - bn.x) * 0.15
    const midY = (bn.y + headS.y) / 2 + 0.02 * s
    c.strokeStyle = '#efe9db'
    c.lineWidth = nw
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(bn.x, bn.y)
    c.quadraticCurveTo(midX, midY, headS.x, headS.y)
    c.stroke()

    const hr = p.neckR * 1.9 * s
    c.fillStyle = '#f2ede0'
    c.strokeStyle = 'rgba(90,84,70,0.5)'
    c.lineWidth = Math.max(1, 0.003 * s)
    c.beginPath()
    c.arc(headS.x, headS.y, hr, 0, Math.PI * 2)
    c.fill()
    c.stroke()

    c.fillStyle = '#e08a3c'
    c.beginPath()
    c.moveTo(headS.x - hr * 0.75, headS.y + hr * 0.25)
    c.lineTo(headS.x + hr * 0.75, headS.y + hr * 0.25)
    c.lineTo(headS.x, headS.y + hr * 1.15)
    c.closePath()
    c.fill()

    c.fillStyle = '#1c1a16'
    const er = Math.max(0.8, hr * 0.16)
    c.beginPath()
    c.arc(headS.x - hr * 0.42, headS.y - hr * 0.18, er, 0, Math.PI * 2)
    c.arc(headS.x + hr * 0.42, headS.y - hr * 0.18, er, 0, Math.PI * 2)
    c.fill()

    c.strokeStyle = '#e08a3c'
    c.lineWidth = Math.max(1.2, 0.006 * s)
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(bodyC.x - rx * 0.3, bodyC.y + ry)
    c.lineTo(bodyC.x - rx * 0.3, bodyC.y + ry + 0.025 * s)
    c.moveTo(bodyC.x + rx * 0.3, bodyC.y + ry)
    c.lineTo(bodyC.x + rx * 0.3, bodyC.y + ry + 0.025 * s)
    c.stroke()

    if (p.kind === 'boss') {
      const cw = hr * 1.1
      const cy2 = headS.y - hr * 0.85
      c.fillStyle = '#e8b93c'
      c.strokeStyle = '#9a7420'
      c.lineWidth = Math.max(1, 0.004 * s)
      c.beginPath()
      c.moveTo(headS.x - cw, cy2)
      c.lineTo(headS.x - cw, cy2 - 0.5 * cw)
      c.lineTo(headS.x - 0.5 * cw, cy2 - 0.15 * cw)
      c.lineTo(headS.x, cy2 - 0.65 * cw)
      c.lineTo(headS.x + 0.5 * cw, cy2 - 0.15 * cw)
      c.lineTo(headS.x + cw, cy2 - 0.5 * cw)
      c.lineTo(headS.x + cw, cy2)
      c.closePath()
      c.fill()
      c.stroke()
    }
  }

  function ringPts(cam, pose, radius = RING_RADIUS) {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const th = (i / 64) * Math.PI * 2
      const local = { x: Math.cos(th) * radius, y: 0, z: Math.sin(th) * radius }
      const wpos = add(pose.t, rotate(pose.r, local))
      pts.push({ ...project(wpos, cam), th })
    }
    return pts
  }

  function drawRingSeg(c, a, b, th, tube = TUBE_R) {
    if (!a.vis || !b.vis) return
    const zc = (a.zc + b.zc) / 2
    const shade = 0.72 + 0.28 * clamp((-zc - 0.5) / 3, 0, 1)
    const stripe = (th % Math.PI) < 0.5
    const w = 2 * tube * ((a.s + b.s) / 2)
    c.strokeStyle = stripe ? `rgba(255,210,210,${shade})` : `rgba(196,42,48,${shade})`
    c.lineWidth = Math.max(1.2, w)
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.lineTo(b.x, b.y)
    c.stroke()
  }

  function drawTrail(c, ring) {
    if (!ring?.trail || ring.trail.length < 2) return
    c.strokeStyle = 'rgba(220,60,60,.22)'
    c.lineWidth = 3
    c.beginPath()
    ring.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
    c.stroke()
  }

  function drawTrophy(c, cam, p) {
    const C = { x: p.curX, y: p.head.y - p.neckLen * 0.35, z: p.curZ }
    const pose = { t: C, r: { x: 0.18, y: 0, z: 0, w: 0.98 } }
    const pts = ringPts(cam, pose)
    for (let i = 0; i < 64; i++) drawRingSeg(c, pts[i], pts[i + 1], pts[i].th)
  }

  function tagWorld(p) {
    const side = p.curX >= 0 ? 1 : -1
    return {
      x: p.curX + side * (p.bodyR + 0.11),
      y: 0.02,
      z: p.curZ + 0.03,
    }
  }

  function drawCoinDisc(c, cx, cy, r) {
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.12, cx, cy, r)
    g.addColorStop(0, '#ffe7a0')
    g.addColorStop(0.45, '#e2b23a')
    g.addColorStop(1, '#b07a12')
    c.fillStyle = g
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#8a5a10'
    c.lineWidth = Math.max(1, r * 0.18)
    c.stroke()
    c.fillStyle = '#8a5a10'
    c.font = `800 ${Math.max(7, r * 1.15)}px "Smiley Sans", "Noto Sans SC", sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('金', cx, cy + 0.4)
  }

  function drawTag(c, cam, p, coinTags, run) {
    const q = project(tagWorld(p), cam)
    if (!q.vis) return
    const coins = coinTags && run ? coinFor(p, run) : 0
    const prefix = p.kind === 'boss' ? `${p.hp || p.score}血` : ''
    const label = coinTags ? String(coins) : String(p.kind === 'boss' ? `${p.hp || p.score}/血` : p.score)
    const fs = Math.max(9, Math.min(13, 0.026 * q.s))
    c.font = `700 ${fs}px "Smiley Sans", "Noto Sans SC", sans-serif`
    const tw = c.measureText(label).width
    const prefixW = prefix && coinTags ? c.measureText(prefix).width : 0
    const coinR = coinTags ? Math.max(6, fs * 0.52) : 0
    const gap = coinTags ? Math.max(3, fs * 0.22) : 0
    const padX = Math.max(5, 0.012 * q.s)
    const h = Math.max(fs + 7, coinR * 2 + 6)
    const inner = (prefixW ? prefixW + gap : 0) + (coinTags ? coinR * 2 + gap : 0) + tw
    const w = inner + padX * 2
    const x = q.x - w / 2
    const y = q.y - h
    const hot = coinTags ? coins >= 22 : p.score >= 1000
    const mid = coinTags ? coins >= 12 : p.score >= 500
    c.fillStyle = hot ? '#f3c46a' : mid ? '#efe6c2' : '#d7edcc'
    c.strokeStyle = 'rgba(48,32,18,.4)'
    c.lineWidth = 1
    roundRect(c, x, y, w, h, 3)
    c.fill()
    c.stroke()
    const cy = y + h / 2
    let cx = x + padX
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    if (coinTags) {
      if (prefix) {
        c.fillStyle = '#6b3a18'
        c.fillText(prefix, cx, cy + 0.5)
        cx += prefixW + gap
      }
      drawCoinDisc(c, cx + coinR, cy, coinR)
      cx += coinR * 2 + gap
      c.fillStyle = hot ? '#a33b12' : '#8a5a10'
      c.font = `700 ${fs}px "Smiley Sans", "Noto Sans SC", sans-serif`
      c.textAlign = 'left'
      c.textBaseline = 'middle'
      c.fillText(label, cx, cy + 0.5)
    } else {
      c.fillStyle = hot ? '#a33b12' : mid ? '#b07a12' : '#2d7a38'
      c.textAlign = 'center'
      c.fillText(label, q.x, cy + 0.5)
    }
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
  }

  function drawStringLights(c, w, y, t) {
    c.save()
    c.strokeStyle = 'rgba(80,50,30,0.45)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(w * 0.02, y * 0.35)
    c.quadraticCurveTo(w * 0.5, y * 0.08, w * 0.98, y * 0.4)
    c.stroke()
    for (let i = 0; i < 16; i++) {
      const u = i / 15
      const x = w * (0.04 + u * 0.92)
      const yy = y * (0.35 + Math.sin(u * Math.PI) * -0.22 + Math.sin(u * 9) * 0.03)
      const pulse = 0.45 + Math.sin(t * 5 + i) * 0.2
      const g = c.createRadialGradient(x, yy, 1, x, yy, 14)
      g.addColorStop(0, `rgba(255,210,110,${pulse})`)
      g.addColorStop(1, 'rgba(255,120,40,0)')
      c.fillStyle = g
      c.beginPath(); c.arc(x, yy, 14, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#ffd978'
      c.beginPath(); c.arc(x, yy, 3.2, 0, Math.PI * 2); c.fill()
    }
    c.restore()
  }

  function sidePlace(cam, side) {
    const foot = project({ x: side * 1.02, y: 0, z: 1.88 }, cam)
    const bot = clamp(foot.y || cam.h * 0.82, cam.h * 0.62, cam.h * 0.94)
    const x = side < 0
      ? clamp((foot.x || 80) - 28, cam.w * 0.035, cam.w * 0.2)
      : clamp((foot.x || cam.w - 80) + 36, cam.w * 0.8, cam.w * 0.965)
    return { x, bot }
  }

  function drawLuckLantern(c, cam, t) {
    const { x, bot } = sidePlace(cam, -1)
    const h = cam.h * 0.46
    const top = bot - h
    c.strokeStyle = '#5a3a1c'
    c.lineCap = 'round'
    c.lineWidth = Math.max(8, h * 0.028)
    c.beginPath(); c.moveTo(x, bot); c.lineTo(x, top + h * 0.16); c.stroke()
    c.fillStyle = '#4a2e14'
    c.beginPath(); c.ellipse(x, bot, h * 0.045, h * 0.016, 0, 0, Math.PI * 2); c.fill()

    const lx = x
    const ly = top + h * 0.4
    const lw = h * 0.13
    const lh = h * 0.42
    c.save()
    c.globalCompositeOperation = 'lighter'
    const glow = c.createRadialGradient(lx, ly, 6, lx, ly, lw * 2.4)
    const pulse = 0.35 + Math.sin(t * 3.2) * 0.1
    glow.addColorStop(0, `rgba(255,150,60,${pulse})`)
    glow.addColorStop(1, 'rgba(255,80,20,0)')
    c.fillStyle = glow
    c.beginPath(); c.arc(lx, ly, lw * 2.4, 0, Math.PI * 2); c.fill()
    c.restore()

    const lg = c.createLinearGradient(lx - lw, ly, lx + lw, ly)
    lg.addColorStop(0, '#b42328')
    lg.addColorStop(0.45, '#ff6a48')
    lg.addColorStop(1, '#8e1a1c')
    roundRect(c, lx - lw, ly - lh / 2, lw * 2, lh, lw * 0.48)
    c.fillStyle = lg
    c.fill()
    c.strokeStyle = '#f0d48a'
    c.lineWidth = Math.max(3, h * 0.01)
    c.stroke()
    c.fillStyle = '#e2c37a'
    c.fillRect(lx - lw * 0.95, ly - lh / 2 - h * 0.016, lw * 1.9, h * 0.028)
    c.fillRect(lx - lw * 0.95, ly + lh / 2 - h * 0.01, lw * 1.9, h * 0.024)
    c.strokeStyle = '#c9a15b'
    c.lineWidth = 3
    c.beginPath(); c.moveTo(lx, ly + lh / 2); c.lineTo(lx, ly + lh / 2 + h * 0.07); c.stroke()
    c.fillStyle = '#e2c37a'
    c.beginPath()
    c.moveTo(lx, ly + lh / 2 + h * 0.07)
    c.lineTo(lx - h * 0.025, ly + lh / 2 + h * 0.14)
    c.lineTo(lx + h * 0.025, ly + lh / 2 + h * 0.14)
    c.closePath()
    c.fill()

    const chars = ['好', '运', '连', '连']
    c.fillStyle = '#1a0a08'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `800 ${Math.max(16, h * 0.055)}px "Smiley Sans", "Noto Sans SC", sans-serif`
    chars.forEach((ch, i) => c.fillText(ch, lx, ly - lh * 0.32 + i * (lh * 0.21)))
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
  }

  function drawPrizeSign(c, cam) {
    const { x, bot } = sidePlace(cam, 1)
    const h = cam.h * 0.34
    const w = h * 0.72
    const y = bot - h
    c.save()
    c.strokeStyle = '#5a3a1c'
    c.lineWidth = Math.max(7, h * 0.04)
    c.lineCap = 'round'
    c.beginPath(); c.moveTo(x - w * 0.28, bot); c.lineTo(x - w * 0.18, y + h * 0.04); c.stroke()
    c.beginPath(); c.moveTo(x + w * 0.28, bot); c.lineTo(x + w * 0.18, y + h * 0.04); c.stroke()
    roundRect(c, x - w / 2, y, w, h * 0.82, 8)
    c.fillStyle = '#6b4428'
    c.fill()
    c.strokeStyle = '#c9a15b'
    c.lineWidth = 3
    c.stroke()
    roundRect(c, x - w * 0.42, y + h * 0.06, w * 0.84, h * 0.7, 6)
    c.fillStyle = '#f3e0a8'
    c.fill()
    c.fillStyle = '#b42328'
    c.textAlign = 'center'
    c.font = `800 ${Math.max(16, h * 0.11)}px "Smiley Sans", "Noto Sans SC", sans-serif`
    c.fillText('套中有奖', x, y + h * 0.2)
    const gx = x
    const gy = y + h * 0.42
    const gs = h * 0.09
    c.fillStyle = '#f4f0e4'
    c.beginPath(); c.ellipse(gx, gy + gs * 0.15, gs * 1.1, gs * 0.75, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#efe9db'
    c.lineWidth = gs * 0.35
    c.lineCap = 'round'
    c.beginPath(); c.moveTo(gx + gs * 0.15, gy); c.lineTo(gx + gs * 0.05, gy - gs * 1.15); c.stroke()
    c.fillStyle = '#f4f0e4'
    c.beginPath(); c.arc(gx, gy - gs * 1.25, gs * 0.42, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#e07a2a'
    c.beginPath(); c.moveTo(gx + gs * 0.3, gy - gs * 1.28); c.lineTo(gx + gs * 0.7, gy - gs * 1.18); c.lineTo(gx + gs * 0.3, gy - gs * 1.08); c.closePath(); c.fill()
    c.strokeStyle = '#d23a36'
    c.lineWidth = gs * 0.22
    c.beginPath(); c.ellipse(gx, gy - gs * 0.55, gs * 0.85, gs * 0.28, 0, 0, Math.PI * 2); c.stroke()
    c.fillStyle = '#3a2416'
    c.font = `700 ${Math.max(12, h * 0.07)}px "Smiley Sans", "Noto Sans SC", sans-serif`
    c.fillText('大奖等你拿', x, y + h * 0.68)
    c.restore()
    c.textAlign = 'left'
  }

  function drawRingStack(c, cam) {
    const { x, bot } = sidePlace(cam, 1)
    const p = { x: x - cam.w * 0.02, y: bot - 8 }
    const s = cam.h * 0.09
    const cols = ['#5b4db3', '#2fa08c', '#e2b23a', '#e07a2a', '#d23a36', '#3d8adf']
    const rx = s * 0.9
    const ry = rx * 0.34
    cols.forEach((col, i) => {
      const y = p.y - i * ry * 0.85
      c.strokeStyle = 'rgba(0,0,0,0.25)'
      c.lineWidth = Math.max(3, rx * 0.16)
      c.beginPath(); c.ellipse(p.x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke()
      c.strokeStyle = col
      c.lineWidth = Math.max(3, rx * 0.14)
      c.beginPath(); c.ellipse(p.x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke()
    })
  }

  function drawAim(c, cam, aim, power, preview, holdScr) {
    const land = power > 0 && preview ? preview : aim
    const p = project({ x: land.x, y: 0.012, z: land.z }, cam)
    if (p.vis) {
      const rx = 0.16 * p.s
      c.save()
      c.setLineDash([6, 6])
      c.strokeStyle = 'rgba(242,232,213,0.55)'
      c.lineWidth = 2
      c.beginPath()
      c.ellipse(p.x, p.y, rx, rx * 0.35, 0, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }
    if (power > 0) {
      const cx = cam.w * 0.5
      const cy = cam.h * 0.48
      const r = Math.min(cam.w, cam.h) * 0.36
      const col = power < 0.5 ? '#2fa08c' : power < 0.8 ? '#d9a441' : '#e0684e'
      c.save()
      c.lineCap = 'round'
      c.strokeStyle = 'rgba(8,12,20,0.55)'
      c.lineWidth = 2.5
      c.beginPath()
      c.arc(cx, cy, r, 0, Math.PI * 2)
      c.stroke()
      c.strokeStyle = col
      c.lineWidth = 4.5
      c.beginPath()
      c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2)
      c.stroke()
      c.restore()
    }
    void holdScr
  }

  function drawRain(c, w, h) {
    c.fillStyle = 'rgba(40,70,110,.12)'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(180,200,230,.35)'
    c.lineWidth = 1
    for (const r of rain) {
      r.y += r.sp
      if (r.y > 1) { r.y = -0.05; r.x = Math.random() }
      const x = r.x * w
      const y = r.y * h
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + r.l); c.stroke()
    }
  }

  function drawFx(c) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      f.t += 0.016
      if (f.kind === 'catch' || f.kind === 'gold') {
        const k = f.t / 0.95
        if (k >= 1) { fx.splice(i, 1); continue }
        c.save()
        c.strokeStyle = `rgba(255,214,90,${1 - k})`
        c.lineWidth = 5 - k * 3
        c.beginPath(); c.arc(f.x, f.y, 16 + k * 70, 0, Math.PI * 2); c.stroke()
        c.strokeStyle = `rgba(255,255,255,${0.7 - k})`
        c.lineWidth = 2
        c.beginPath(); c.arc(f.x, f.y, 8 + k * 42, 0, Math.PI * 2); c.stroke()
        if (f.text) {
          c.fillStyle = `rgba(255,248,220,${1 - k})`
          c.font = '800 28px "Smiley Sans", "Noto Sans SC", sans-serif'
          c.textAlign = 'center'
          c.fillText(f.text, f.x, f.y - 18 - k * 28)
        }
        if (f.label) {
          c.fillStyle = `rgba(255,214,90,${1 - k})`
          c.font = '800 18px "Smiley Sans", "Noto Sans SC", sans-serif'
          c.textAlign = 'center'
          c.fillText(f.label, f.x, f.y + 10 - k * 20)
        }
        c.restore()
      } else if (f.kind === 'spark') {
        if (f.t > 0.45) { fx.splice(i, 1); continue }
        f.x += f.vx * 0.016
        f.y += f.vy * 0.016
        f.vy += 40 * 0.016
        c.fillStyle = `rgba(255,210,90,${1 - f.t / 0.45})`
        c.beginPath(); c.arc(f.x, f.y, 3, 0, Math.PI * 2); c.fill()
      } else {
        if (f.t > 0.5) { fx.splice(i, 1); continue }
        f.x += f.vx * 0.016
        f.y += f.vy * 0.016
        c.fillStyle = `rgba(210,190,150,${1 - f.t / 0.5})`
        c.beginPath(); c.arc(f.x, f.y, 2, 0, Math.PI * 2); c.fill()
      }
    }
  }

  function vignette(c, w, h) {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.82)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,.22)')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
  }

  return { resize, draw, burst, dust, project }
}
