import { FISH, TANKS, tankById, fishById, FOOD, isCrustacean } from './data.js'
import { uniqueTags } from './sim.js'
import { drawTankLight } from './lights.js'
import {
  drawFryShape,
  growthOf,
  lookFromSeed,
  makeLookCanvas,
  scrubFishImage,
} from './look.js'

const LAYER = {
  upper: [0.14, 0.42],
  mid: [0.32, 0.68],
  bottom: [0.68, 0.84],
}
const PELLET_FLOOR = 0.82
const FISH_FLOOR = 0.84
const SAND = { x0: 0.07, x1: 0.93, y0: 0.76, y1: 0.91, rest: 0.85 }
const SCENE_FRAME = 0.11
const SCENE_WARP = true

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (img.decode) {
        img.decode().then(() => resolve(img)).catch(() => resolve(img))
      } else {
        resolve(img)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function speciesInPlay(state) {
  const ids = new Set()
  for (const fish of state?.fish || []) {
    if (fish?.species) ids.add(fish.species)
  }
  for (const rec of state?.boxed || []) {
    if (rec?.species) ids.add(rec.species)
  }
  return ids
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function gauss() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v)
}

function hash(str) {
  let h = 2166136261
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export function createWorld(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d')
  const images = new Map()
  const pellets = []
  const motes = []
  const ambient = []
  const fireworks = []
  const lookCache = new Map()
  let dpr = 1
  let cssW = 1
  let cssH = 1
  let t = 0
  let intro = null
  let highlightSand = false
  let hoverDrop = null
  let upgradeBurst = 0
  let sceneCovered = false
  let openWaterGrad = null
  let volumeGrad = null

  const pending = new Map()

  function ensureImage(key, src, scrub = false) {
    if (!src) return Promise.resolve(null)
    if (images.has(key)) return Promise.resolve(images.get(key))
    if (pending.has(key)) return pending.get(key)
    const job = loadImage(src).then((img) => {
      const readyImg = img && scrub ? scrubFishImage(img) : img
      images.set(key, readyImg)
      pending.delete(key)
      return readyImg
    })
    pending.set(key, job)
    return job
  }

  function ensureTank(id) {
    const tank = tankById(id)
    if (!tank?.bg) return Promise.resolve(null)
    return ensureImage(`tank:${tank.id}`, tank.bg)
  }

  function ensureFish(id) {
    const spec = fishById(id)
    if (!spec?.src) return Promise.resolve(null)
    return ensureImage(spec.id, spec.src, true)
  }

  function warm(state) {
    const jobs = [
      ensureTank(state?.tank),
      ensureImage('bag', '/tank/bag.png'),
    ]
    for (const id of speciesInPlay(state)) {
      const fish = (state?.fish || []).find((f) => f.species === id)
      const patterned = fish ? growthOf(fish).patterned : true
      if (patterned) jobs.push(ensureFish(id))
    }
    return Promise.all(jobs)
  }

  function prefetch(state) {
    const skipFish = speciesInPlay(state)
    const skipTank = state?.tank
    const queue = [
      () => ensureImage('chest-common', '/tank/ui/chest-common.png'),
      () => ensureImage('chest-rare', '/tank/ui/chest-rare.png'),
    ]
    for (const tank of TANKS) {
      if (tank.id === skipTank || !tank.bg) continue
      queue.push(() => ensureTank(tank.id))
    }
    for (const spec of FISH) {
      if (skipFish.has(spec.id) || !spec.src) continue
      queue.push(() => ensureFish(spec.id))
    }
    const schedule = (fn) => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 600 })
      else setTimeout(fn, 40)
    }
    const run = () => {
      const job = queue.shift()
      if (!job) return
      Promise.resolve()
        .then(job)
        .catch(() => {})
        .finally(() => schedule(run))
    }
    schedule(run)
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) return
    const nextW = rect.width
    const nextH = rect.height
    const nextDpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = Math.round(nextW * nextDpr)
    const bh = Math.round(nextH * nextDpr)
    const sameStore = canvas.width === bw && canvas.height === bh
    const sameCss = Math.abs(nextW - cssW) < 0.5 && Math.abs(nextH - cssH) < 0.5 && dpr === nextDpr
    if (sameStore && sameCss) return
    cssW = nextW
    cssH = nextH
    dpr = nextDpr
    if (!sameStore) {
      canvas.width = bw
      canvas.height = bh
      openWaterGrad = null
      volumeGrad = null
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function sceneBox(state) {
    const tank = tankById(state.tank)
    const bg = images.get(`tank:${tank.id}`) || (tank.bg ? null : images.get('bg'))
    if (!bg) return { x: 0, y: 0, w: cssW, h: cssH }
    const visH = bg.height * (1 - SCENE_FRAME)
    const scale = Math.max(cssW / bg.width, cssH / visH)
    const w = bg.width * scale
    const fullH = bg.height * scale
    const h = visH * scale
    return { x: (cssW - w) / 2, y: cssH - h, w, h, fullH, img: bg }
  }

  function activeZones(state) {
    const tank = tankById(state.tank)
    const box = sceneBox(state)
    const fullH = box.fullH || box.h
    return (tank.zones || []).map((z) => ({
      ...z,
      x: (box.x + z.x * box.w) / cssW,
      y: (box.y + z.y * fullH) / cssH,
      halfW: (z.halfW * box.w) / cssW,
      halfH: (z.halfH * fullH) / cssH,
    }))
  }

  function inZone(z, x, y, pad = 0) {
    return Math.abs(x - z.x) < z.halfW + pad && Math.abs(y - z.y) < z.halfH + pad
  }

  function dropOnSand(px, py) {
    const nx = px / cssW
    const ny = py / cssH
    if (nx < -0.02 || nx > 1.02 || ny < -0.02 || ny > 1.02) return null
    return {
      x: clamp(nx, SAND.x0, SAND.x1),
      y: clamp(ny > 0.70 ? ny : SAND.rest, SAND.y0, SAND.y1),
    }
  }

  function decorDrawSize(spec) {
    const base = spec?.size || 120
    return base * (cssW < 640 ? 0.9 : cssW > 900 ? 1.12 : 1)
  }

  function decorFoot(item) {
    return { x: (item.x ?? 0.5) * cssW, y: (item.y ?? SAND.rest) * cssH }
  }

  function tunnelLayers(spec) {
    const key = `${spec.id}:tun`
    const cached = images.get(key)
    if (cached) return cached
    const img = images.get(spec.id)
    if (!img || !img.width) return null
    const w = img.width
    const h = img.height
    const src = document.createElement('canvas')
    src.width = w
    src.height = h
    const sctx = src.getContext('2d')
    sctx.drawImage(img, 0, 0)
    try {
      const m = spec.tunnel || spec.den || { mx: 0.5, my: 0.62, hw: 0.22, hh: 0.2 }
      const srcData = sctx.getImageData(0, 0, w, h)
      const front = sctx.createImageData(w, h)
      const back = sctx.createImageData(w, h)
      const sp = srcData.data
      const fp = front.data
      const bp = back.data
      for (let i = 0; i < sp.length; i += 4) {
        const a = sp[i + 3]
        if (a < 10) continue
        const px = (i / 4) % w
        const py = Math.floor(i / 4 / w)
        const lum = 0.3 * sp[i] + 0.59 * sp[i + 1] + 0.11 * sp[i + 2]
        const inMouth = Math.abs(px / w - m.mx) < m.hw * 1.45 && Math.abs(py / h - m.my) < m.hh * 1.55
        const dest = lum < 58 && inMouth ? bp : fp
        dest[i] = sp[i]
        dest[i + 1] = sp[i + 1]
        dest[i + 2] = sp[i + 2]
        dest[i + 3] = a
      }
      const toCanvas = (data) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d').putImageData(data, 0, 0)
        return c
      }
      const layers = { front: toCanvas(front), back: toCanvas(back) }
      images.set(key, layers)
      return layers
    } catch {
      return null
    }
  }

  function openingGeom(item, spec, mouth) {
    const size = decorDrawSize(spec)
    const img = images.get(spec.id)
    const h = img ? size * (img.height / img.width) : size
    const foot = decorFoot(item)
    const top = foot.y - h + 10
    const m = mouth || spec.tunnel || spec.den || { mx: 0.5, my: 0.62, hw: 0.2, hh: 0.18 }
    return {
      x: (foot.x - size / 2 + size * m.mx) / cssW,
      y: (top + h * m.my) / cssH,
      halfW: (size * m.hw) / cssW,
      halfH: (h * m.hh) / cssH,
    }
  }

  function tunnelGeom(item, spec) {
    return openingGeom(item, spec, spec.tunnel || spec.den)
  }

  function drawDecorItem(item, spec, img) {
    if (!img) return
    const size = decorDrawSize(spec)
    const foot = decorFoot(item)
    const sway = spec.tag === 'plants' ? Math.sin(t * 1.4 + hash(item.id)) * 0.035 : 0
    const h = size * (img.height / img.width)
    ctx.save()
    ctx.translate(foot.x, foot.y)
    ctx.rotate(sway)
    ctx.drawImage(img, -size / 2, -h + 10, size, h)
    ctx.restore()
  }

  function toXY(nx, ny) {
    return { x: nx * cssW, y: ny * cssH }
  }

  function spawnPellets() {
    pellets.length = 0
    const pinches = Math.random() < 0.42 ? 2 : 1
    let delay = 0
    for (let n = 0; n < pinches; n++) {
      const cx = clamp(0.24 + Math.random() * 0.52 + gauss() * 0.05, 0.18, 0.82)
      const count = 5 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const tight = Math.random() < 0.4
        delay += 0.02 + Math.random() * 0.14
        pellets.push({
          x: clamp(cx + gauss() * (tight ? 0.028 : 0.1) + (Math.random() < 0.12 ? gauss() * 0.16 : 0), 0.1, 0.9),
          y: -0.05 - Math.random() * 0.08,
          vx: gauss() * 0.05,
          vy: 0.1 + Math.random() * 0.09,
          wobble: Math.random() * Math.PI * 2,
          size: 0.7 + Math.random() * 0.75,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 2.4,
          delay,
          kind: FOOD.FLAKE,
          wet: false,
          eaten: false,
        })
      }
    }
  }

  function dust(nx, ny) {
    for (let i = 0; i < 5; i++) {
      motes.push({
        x: nx,
        y: ny,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.04 - Math.random() * 0.05,
        life: 0.45,
        age: 0,
      })
    }
  }

  function spark(nx, ny) {
    for (let i = 0; i < 6; i++) {
      motes.push({
        x: nx,
        y: ny,
        vx: Math.cos((i / 6) * Math.PI * 2) * 0.12,
        vy: Math.sin((i / 6) * Math.PI * 2) * 0.12,
        life: 0.35,
        age: 0,
        spark: true,
      })
    }
  }

  function setIntro(fish) {
    intro = { species: fish.species, id: fish.id, t: 0, dur: 1.8 }
  }

  function skipIntro() {
    if (intro) intro.t = intro.dur
  }

  function chestSize(chest) {
    const base = chest?.tier === 'rare' ? 72 : 60
    return base * (cssW < 700 ? 0.86 : 1)
  }

  function hit(state, x, y) {
    if (state.chest) {
      const p = toXY(state.chest.x, state.chest.y)
      const s = chestSize(state.chest)
      if (Math.abs(x - p.x) < s * 0.48 && Math.abs(y - p.y) < s * 0.42) {
        return { type: 'chest', chest: state.chest }
      }
    }
    for (let i = state.fish.length - 1; i >= 0; i--) {
      const fish = state.fish[i]
      if (fish.entering) continue
      const spec = fishById(fish.species)
      const p = toXY(fish.x, fish.y)
      const ripe = Boolean(fish.bubble)
      const grow = Math.max(0.42, growthOf(fish).scale)
      const s = (spec?.size || 60) * (ripe ? 0.68 : 0.55) * grow
      if (Math.abs(x - p.x) < s * 0.72 && Math.abs(y - p.y) < s * 0.52) {
        return { type: 'fish', fish }
      }
    }
    if (intro && intro.t < intro.dur) {
      const p = toXY(0.5, 0.22 + Math.min(1, intro.t / 0.8) * 0.28)
      if (Math.hypot(x - p.x, y - p.y) < 60) return { type: 'intro' }
    }
    return null
  }

  function fishDrawSize(spec, fish) {
    const grow = fish ? growthOf(fish).scale : 1
    return (spec?.size || 60) * (cssW < 700 ? 0.78 : 1) * grow
  }

  function faceDir(fish) {
    if (fish.faceDir !== 1 && fish.faceDir !== -1) {
      fish.faceDir = (fish.vx || 0) >= 0 ? 1 : -1
    }
    return fish.faceDir
  }

  function turnTo(fish, dir) {
    if (dir !== 1 && dir !== -1) return
    if (fish.faceDir !== dir) {
      fish.faceDir = dir
      fish.turning = fish.turnLen || 0.18
    }
  }

  function gaitOf(spec) {
    const id = spec.id
    if (id === 'jelly') return 'pulse'
    if (id.includes('horse')) return 'hover'
    if (id.includes('eel') || id === 'peel') return 'snake'
    if (id.includes('ray')) return 'wing'
    if (isCrustacean(spec)) return 'crawl'
    if (id.includes('pu') || id === 'puffer' || id === 'spike') return 'puff'
    if (id.includes('angel') || id === 'discus' || id === 'stara') return 'sail'
    if (spec.layer === 'bottom') return 'graze'
    if (spec.trait === 'school' && spec.size <= 62) return 'flick'
    if (spec.trait === 'solo') return 'idle'
    return 'cruise'
  }

  function pickPose(gait) {
    const r = Math.random()
    if (gait === 'graze') return r < 0.42 ? 'rest' : r < 0.78 ? 'graze' : r < 0.9 ? 'climb' : 'cruise'
    if (gait === 'hover' || gait === 'pulse') return r < 0.5 ? 'hover' : r < 0.78 ? 'climb' : 'cruise'
    if (gait === 'flick') return r < 0.3 ? 'dart' : r < 0.48 ? 'hover' : r < 0.62 ? 'glide' : 'cruise'
    if (gait === 'sail') return r < 0.32 ? 'hover' : r < 0.55 ? 'climb' : r < 0.72 ? 'glide' : 'cruise'
    if (gait === 'puff' || gait === 'wing') return r < 0.35 ? 'glide' : r < 0.55 ? 'hover' : r < 0.7 ? 'climb' : 'cruise'
    if (gait === 'idle') return r < 0.22 ? 'hover' : r < 0.38 ? 'inspect' : r < 0.5 ? 'glide' : r < 0.62 ? 'dart' : 'cruise'
    if (gait === 'snake') return r < 0.2 ? 'dart' : r < 0.4 ? 'climb' : r < 0.55 ? 'glide' : 'cruise'
    return r < 0.16 ? 'glide' : r < 0.28 ? 'hover' : r < 0.4 ? 'dart' : r < 0.52 ? 'climb' : r < 0.62 ? 'inspect' : 'cruise'
  }

  function poseDuration(pose) {
    if (pose === 'dart') return 0.28 + Math.random() * 0.45
    if (pose === 'glide') return 1.1 + Math.random() * 1.8
    if (pose === 'hover') return 0.9 + Math.random() * 1.6
    if (pose === 'rest') return 1.6 + Math.random() * 2.4
    if (pose === 'climb') return 1.1 + Math.random() * 1.5
    if (pose === 'inspect') return 0.7 + Math.random() * 1.1
    if (pose === 'graze') return 1.4 + Math.random() * 2.2
    return 2.2 + Math.random() * 3.2
  }

  function refreshPose(fish, spec, hunting, leftovers) {
    const gait = gaitOf(spec)
    fish.gait = gait
    fish.turnLen = gait === 'flick' ? 0.1 : gait === 'sail' || gait === 'puff' ? 0.28 : gait === 'snake' ? 0.22 : 0.18
    if (hunting) {
      fish.pose = 'chase'
      return
    }
    if ((fish.hideUntil || 0) > t) {
      fish.pose = 'tuck'
      return
    }
    if (leftovers) return
    if (fish.poseUntil == null) {
      fish.pose = 'cruise'
      fish.poseUntil = t + (hash(fish.id) % 19) * 0.14
    }
    if (t < fish.poseUntil) return
    fish.pose = pickPose(gait)
    fish.poseUntil = t + poseDuration(fish.pose)
  }

  function wanderTarget(fish, y0, y1, leftovers) {
    if (leftovers) {
      return { x: 0.12 + Math.random() * 0.76, y: clamp(fish.y, 0.55, FISH_FLOOR) }
    }
    const pose = fish.pose || 'cruise'
    const midY = (y0 + y1) * 0.5
    if (pose === 'rest' || pose === 'graze') {
      return {
        x: clamp(fish.x + (Math.random() - 0.5) * 0.22, 0.1, 0.9),
        y: clamp(y1 - 0.02 + Math.random() * 0.03, y0, FISH_FLOOR),
      }
    }
    if (pose === 'hover') {
      return {
        x: clamp(fish.x + (Math.random() - 0.5) * 0.08, 0.12, 0.88),
        y: clamp(fish.y + (Math.random() - 0.5) * 0.05, y0, y1),
      }
    }
    if (pose === 'climb') {
      const up = fish.y > midY
      return {
        x: clamp(fish.x + (Math.random() - 0.5) * 0.35, 0.1, 0.9),
        y: up ? y0 + Math.random() * 0.06 : y1 - Math.random() * 0.06,
      }
    }
    if (pose === 'dart') {
      const dir = faceDir(fish)
      return {
        x: clamp(fish.x + dir * (0.22 + Math.random() * 0.28), 0.1, 0.9),
        y: clamp(fish.y + (Math.random() - 0.5) * 0.1, y0, y1),
      }
    }
    if (pose === 'inspect') {
      return {
        x: clamp(fish.x + (Math.random() - 0.5) * 0.12, 0.1, 0.9),
        y: clamp(fish.y + (Math.random() - 0.5) * 0.08, y0, y1),
      }
    }
    if (pose === 'glide') {
      return {
        x: fish.x > 0.5 ? 0.12 + Math.random() * 0.1 : 0.78 + Math.random() * 0.1,
        y: clamp(fish.y + (Math.random() - 0.5) * 0.04, y0, y1),
      }
    }
    if (Math.random() < 0.45) {
      return {
        x: fish.x > 0.5 ? 0.12 + Math.random() * 0.16 : 0.72 + Math.random() * 0.16,
        y: clamp(fish.y + (Math.random() - 0.5) * 0.08, y0, y1),
      }
    }
    return { x: 0.1 + Math.random() * 0.8, y: y0 + Math.random() * (y1 - y0) }
  }

  function mouthOf(fish) {
    const spec = fishById(fish.species)
    const size = fishDrawSize(spec, fish)
    const dir = faceDir(fish)
    return {
      x: fish.x + dir * (size * (isCrustacean(spec) ? 0.22 : 0.4)) / cssW,
      y: fish.y + (size * (isCrustacean(spec) ? 0.16 : 0.04)) / cssH,
    }
  }

  function livePellets() {
    return pellets.filter((p) => !p.eaten && p.delay <= 0)
  }

  function pelletOnFloor(p) {
    return p.y >= PELLET_FLOOR - 0.03
  }

  function pelletEdible(p, spec) {
    if (!p || p.eaten || p.delay > 0) return false
    if (isCrustacean(spec)) {
      if (!pelletOnFloor(p)) return false
      return p.kind == null || p.kind === FOOD.FLAKE || p.kind === FOOD.WAFER
    }
    if (p.kind === FOOD.WAFER) return false
    return true
  }

  function thinkCrawlerFood(fish, spec, dt) {
    if (fish.eatWait > 0) fish.eatWait -= dt
    if (fish.eatBurst > 0) fish.eatBurst -= dt
    if (fish.peck > 0) fish.peck -= dt
    if (fish.food?.eaten) fish.food = null
    if (fish.entering) return
    const live = livePellets().filter((p) => pelletEdible(p, spec))
    if (!live.length) {
      fish.food = null
      return
    }
    if (fish.eatWait > 0) return
    const mouth = mouthOf(fish)
    if (fish.food && pelletEdible(fish.food, spec)) {
      const d = Math.hypot(mouth.x - fish.food.x, mouth.y - fish.food.y)
      if (d < 0.055 && fish.eatBurst <= 0) fish.eatBurst = 0.14 + Math.random() * 0.06
      return
    }
    fish.food = null
    if (Math.random() > dt * 4) return
    let best = null
    let bestScore = Infinity
    for (const p of live) {
      const dx = Math.abs(p.x - fish.x)
      if (dx > 0.16) continue
      const score = dx + Math.random() * 0.02
      if (score < bestScore) {
        bestScore = score
        best = p
      }
    }
    if (!best) return
    fish.food = best
    fish.eatWait = 0.16 + Math.random() * 0.2
    turnTo(fish, best.x >= fish.x ? 1 : -1)
  }

  function thinkFood(fish, dt) {
    const spec = fishById(fish.species)
    if (isCrustacean(spec)) {
      thinkCrawlerFood(fish, spec, dt)
      return
    }
    if (fish.eatWait > 0) fish.eatWait -= dt
    if (fish.eatBurst > 0) fish.eatBurst -= dt
    if (fish.peck > 0) fish.peck -= dt
    if (fish.food?.eaten) fish.food = null
    if (fish.entering) return
    if ((fish.hideUntil || 0) > t && livePellets().length) {
      fish.hideUntil = 0
    }

    const live = livePellets().filter((p) => p.y > 0.04 && pelletEdible(p, spec))
    if (!live.length) {
      fish.food = null
      return
    }
    if (fish.eatWait > 0) return
    const mouth = mouthOf(fish)
    if (fish.food) {
      const d = Math.hypot(mouth.x - fish.food.x, mouth.y - fish.food.y)
      if (d < 0.06 && fish.eatBurst <= 0) fish.eatBurst = 0.12 + Math.random() * 0.06
      return
    }
    if (Math.random() > dt * 5) return
    let best = null
    let bestScore = Infinity
    for (const p of live) {
      const dx = p.x - mouth.x
      const dy = p.y - mouth.y
      const d = Math.hypot(dx, dy)
      const facing = faceDir(fish)
      const behind = Math.sign(dx || facing) !== facing ? 0.06 : 0
      const score = d + behind + Math.random() * 0.03
      if (score < bestScore) {
        bestScore = score
        best = p
      }
    }
    if (!best) return
    fish.food = best
    fish.eatWait = 0.12 + Math.random() * 0.18
    turnTo(fish, best.x >= fish.x ? 1 : -1)
  }

  function steerCrawler(fish, spec, state, dt) {
    const floorY = FISH_FLOOR
    const hopTop = 0.67
    const food = fish.food && pelletEdible(fish.food, spec) ? fish.food : null
    if (!fish.pose || (fish.pose !== 'crawl' && fish.pose !== 'idle' && fish.pose !== 'hop' && fish.pose !== 'sink')) {
      fish.pose = 'crawl'
      fish.gait = 'crawl'
      fish.poseUntil = t + 1.2
      fish.target = { x: fish.x, y: floorY }
    }

    if (food) {
      fish.pose = 'crawl'
      fish.target = { x: food.x, y: floorY }
      fish.poseUntil = t + 0.8
    } else if (fish.demoHopAt && t >= fish.demoHopAt && fish.pose !== 'hop' && fish.pose !== 'sink') {
      fish.demoHopAt = 0
      fish.pose = 'hop'
      fish.poseUntil = t + 0.36
      fish.target = {
        x: clamp(fish.x + faceDir(fish) * 0.08, 0.1, 0.9),
        y: hopTop,
      }
    } else if (fish.pose === 'hop' && fish.y <= hopTop + 0.03) {
      fish.pose = 'sink'
      fish.poseUntil = t + 1.5
      fish.target = { x: clamp(fish.x + faceDir(fish) * 0.05, 0.1, 0.9), y: floorY }
    } else if (!fish.poseUntil || t >= fish.poseUntil) {
      if (fish.pose === 'hop') {
        fish.pose = 'sink'
        fish.poseUntil = t + 1.5
        fish.target = { x: clamp(fish.x + faceDir(fish) * 0.05, 0.1, 0.9), y: floorY }
      } else if (Math.random() < (fish._crawlerDemo ? 0.18 : 0.1)) {
        fish.pose = 'hop'
        fish.poseUntil = t + 0.32 + Math.random() * 0.2
        fish.target = {
          x: clamp(fish.x + faceDir(fish) * (0.05 + Math.random() * 0.08), 0.1, 0.9),
          y: hopTop + Math.random() * 0.04,
        }
      } else {
        fish.pose = Math.random() < 0.26 ? 'idle' : 'crawl'
        fish.poseUntil = t + (fish.pose === 'idle' ? 1.6 + Math.random() * 2.8 : 3.2 + Math.random() * 5)
        const dir = Math.random() < 0.5 ? -1 : 1
        fish.target = {
          x: clamp(fish.x + dir * (0.12 + Math.random() * 0.34), 0.1, 0.9),
          y: floorY,
        }
      }
    }

    if (!fish.target) fish.target = { x: fish.x, y: floorY }
    const dx = fish.target.x - fish.x
    const crawlSpeed = 0.02 * (0.88 + (hash(fish.id) % 28) / 90)
    let vx = 0
    let vy = 0
    if (fish.pose === 'idle' && !food) {
      vx = Math.sin(t * 3.2 + hash(fish.id)) * 0.003
      vy = (floorY - fish.y) * 2.8
    } else if (fish.pose === 'hop') {
      vx = Math.sign(dx || faceDir(fish)) * crawlSpeed * 0.7
      vy = -0.26
    } else if (fish.pose === 'sink') {
      vx = Math.sign(dx || 0) * crawlSpeed * 0.28
      vy = 0.24
    } else {
      vx = Math.abs(dx) < 0.01 ? Math.sin(t * 5.5 + hash(fish.id)) * 0.004 : Math.sign(dx) * crawlSpeed
      vy = (floorY - fish.y) * 3.6
    }

    fish.vx += (vx - fish.vx) * Math.min(1, dt * 4.2)
    fish.vy += (vy - fish.vy) * Math.min(1, dt * 3.4)
    if (Math.abs(fish.vx) > 0.006) turnTo(fish, fish.vx > 0 ? 1 : -1)

    const wantPitch = fish.pose === 'hop' ? -0.2 : fish.pose === 'sink' ? 0.16 : 0.03
    fish.pitch = (fish.pitch || 0) + (wantPitch - (fish.pitch || 0)) * Math.min(1, dt * 5)
    fish.x = clamp(fish.x + fish.vx * dt, 0.07, 0.93)
    fish.y = clamp(fish.y + fish.vy * dt, 0.54, FISH_FLOOR)
    if (fish.pose !== 'hop' && fish.pose !== 'sink') {
      fish.y = clamp(fish.y + (floorY - fish.y) * Math.min(1, dt * 8), 0.8, FISH_FLOOR)
    }
    if (fish.x <= 0.072) turnTo(fish, 1)
    else if (fish.x >= 0.928) turnTo(fish, -1)
    if (fish.turning > 0) fish.turning -= dt
  }

  function applyEcology(fish, state, dt, busy) {
    const spec = fishById(fish.species)
    if (!spec || fish.entering) return { avx: 0, avy: 0 }
    let avx = 0
    let avy = 0
    const dir = faceDir(fish)
    const solo = spec.trait === 'solo'
    const schooler = spec.trait === 'school'
    const space = solo ? 0.09 : schooler ? 0.052 : 0.068
    const others = state.fish.filter((f) => f.id !== fish.id && !f.entering)
    const joinRate = schooler ? 0.42 : solo ? 0 : 0.16
    const joinRange = schooler ? 0.26 : 0.16

    if (!fish.schoolUntil) fish.schoolUntil = 0
    if (t > fish.schoolUntil) {
      if (fish.schoolWith) fish.schoolCool = t + 1.2 + Math.random() * 2.4
      fish.schoolWith = null
      if (!busy && joinRate && t > (fish.schoolCool || 0) && Math.random() < dt * joinRate) {
        const clustered = others.find((o) => (
          o.species === fish.species
          && t < (o.schoolUntil || 0)
          && Math.hypot(fish.x - o.x, fish.y - o.y) < joinRange + 0.04
        ))
        if (clustered) {
          const leaderId = clustered.schoolWith || clustered.id
          fish.schoolWith = leaderId
          fish.schoolUntil = clustered.schoolUntil
          const leadFish = leaderId === clustered.id ? clustered : others.find((f) => f.id === leaderId) || clustered
          turnTo(fish, faceDir(leadFish))
        } else {
          let buddy = null
          let best = joinRange
          for (const o of others) {
            if (o.species !== fish.species) continue
            const d = Math.hypot(fish.x - o.x, fish.y - o.y)
            if (d < best) {
              best = d
              buddy = o
            }
          }
          if (buddy) {
            const until = t + (schooler ? 3.2 : 1.8) + Math.random() * (schooler ? 5.5 : 2.4)
            const leaderId = fish.id < buddy.id ? fish.id : buddy.id
            fish.schoolWith = leaderId
            fish.schoolUntil = until
            buddy.schoolWith = leaderId
            buddy.schoolUntil = until
            const leadFish = leaderId === fish.id ? fish : buddy
            if (leaderId !== fish.id) turnTo(fish, faceDir(leadFish))
          }
        }
      }
    }

    const leader = !busy && fish.schoolWith && fish.schoolWith !== fish.id
      ? others.find((f) => f.id === fish.schoolWith)
      : null
    if (leader) {
      const gap = Math.hypot(fish.x - leader.x, fish.y - leader.y)
      if (gap > 0.34) {
        fish.schoolUntil = t
        fish.schoolWith = null
        fish.schoolCool = t + 1 + Math.random() * 1.6
      } else {
        const lead = faceDir(leader)
        avx += (leader.x + lead * 0.08 - fish.x) * (schooler ? 0.38 : 0.18)
        avy += (leader.y - fish.y) * (schooler ? 0.22 : 0.1)
        avx += (leader.vx - fish.vx) * 0.2
        avy += (leader.vy - fish.vy) * 0.12
        if (lead !== dir && Math.random() < dt * 1.1) turnTo(fish, lead)
      }
    }

    if (solo) {
      for (const o of others) {
        const d = Math.hypot(fish.x - o.x, fish.y - o.y)
        if (d < 0.2 && d > 0.001) {
          avx += ((fish.x - o.x) / d) * 0.035
          avy += ((fish.y - o.y) / d) * 0.018
        }
      }
    }

    if (!fish.dodgeUntil) fish.dodgeUntil = 0
    for (const o of others) {
      const dx = fish.x - o.x
      const dy = fish.y - o.y
      const d = Math.hypot(dx, dy) || 0.0001
      const other = fishById(o.species)
      const need = space + ((spec.size + (other?.size || 60)) * 0.00028)
      const same = o.species === fish.species
      const limit = same ? need * 0.82 : need * 1.18
      if (d >= limit) continue
      const nx = dx / d
      const ny = dy / d
      const push = (limit - d) / limit
      const str = same ? 0.05 : solo ? 0.13 : 0.085
      avx += nx * push * str
      avy += ny * push * str * 0.72
      const headOn = !same && nx * dir < -0.4 && d < limit * 0.82
      if (headOn && t > fish.dodgeUntil && !busy) {
        const away = -dir
        fish.dodgeUntil = t + 1.15 + Math.random() * 0.85
        turnTo(fish, away)
        const lift = dy >= 0 ? 0.05 : -0.05
        avy += lift
        fish.target = {
          x: clamp(fish.x + away * (0.16 + Math.random() * 0.14), 0.1, 0.9),
          y: clamp(fish.y + lift * 1.4, 0.16, FISH_FLOOR),
        }
      }
    }

    avx = clamp(avx, -0.06, 0.06)
    avy = clamp(avy, -0.04, 0.04)
    return { avx, avy }
  }

  function steerFish(fish, state, dt, now) {
    const spec = fishById(fish.species) || FISH[0]
    if (isCrustacean(spec)) {
      steerCrawler(fish, spec, state, dt)
      return
    }
    const seed = hash(fish.id)
    const [y0, y1] = LAYER[spec.layer] || LAYER.mid
    const food = fish.food && !fish.food.eaten && fish.food.delay <= 0 ? fish.food : null
    const noticing = Boolean(food && fish.eatWait > 0)
    const lunging = Boolean(food && fish.eatBurst > 0)
    const chewing = fish.eatWait > 0 && !food
    const chasing = Boolean(food && !noticing)
    const hunting = chasing || lunging || noticing
    const feeding = now < state.feedUntil
    const leftovers = pellets.some((p) => !p.eaten && p.delay <= 0)
    refreshPose(fish, spec, hunting, leftovers)

    if ((fish.hideUntil || 0) > t && !hunting) {
      fish.vx *= Math.max(0, 1 - dt * 8)
      fish.vy *= Math.max(0, 1 - dt * 8)
      if (fish.hideX != null) fish.x += (fish.hideX - fish.x) * Math.min(1, dt * 8)
      if (fish.hideY != null) fish.y += (fish.hideY - fish.y) * Math.min(1, dt * 8)
      fish.x = clamp(fish.x, 0.07, 0.93)
      fish.y = clamp(fish.y, 0.12, FISH_FLOOR)
      return
    }
    if (fish.hideUntil && t >= fish.hideUntil && fish.emerge) {
      fish.target = fish.emerge
      fish.hideUntil = 0
      fish.emerge = null
      fish.seekDen = null
    }

    const base = (spec.layer === 'bottom' ? 0.056 : spec.id === 'jelly' ? 0.042 : 0.062)
      * (0.88 + (seed % 40) / 120)
    const speed = chewing || noticing
      ? base * 0.18
      : lunging
        ? base * 1.15
        : chasing
          ? base * 0.82
          : feeding
            ? base * 1.05
            : base

    if (!hunting && t < (fish.dodgeUntil || 0) && fish.target) {
      /* keep the dodge heading */
    } else if (!hunting && (!fish.target || Math.hypot(fish.x - fish.target.x, fish.y - fish.target.y) < 0.04 || Math.random() < (fish.pose === 'hover' || fish.pose === 'rest' ? dt * 0.08 : dt * 0.2))) {
      const buddy = fish.schoolWith && fish.schoolWith !== fish.id && t < (fish.schoolUntil || 0)
        ? state.fish.find((f) => f.id === fish.schoolWith && !f.entering)
        : null
      if (buddy) {
        fish.target = {
          x: clamp(buddy.x + faceDir(buddy) * 0.1 + (Math.random() - 0.5) * 0.08, 0.1, 0.9),
          y: leftovers ? clamp(fish.y, 0.55, FISH_FLOOR) : clamp(buddy.y + (Math.random() - 0.5) * 0.05, y0, y1),
        }
      } else {
        const zones = activeZones(state)
        const dens = zones.filter((z) => z.kind === 'den')
        const tunnels = zones.filter((z) => z.kind === 'tunnel')
        const hideBias = spec.prefer === 'hide' ? 1 : 0.45
        let picked = false
        if (!leftovers && dens.length && Math.random() < 0.12 * hideBias) {
          const den = dens[Math.floor(Math.random() * dens.length)]
          fish.target = { x: den.x, y: clamp(den.y, y0, y1) }
          fish.seekDen = den.id
          picked = true
        } else if (!leftovers && tunnels.length && Math.random() < 0.4 * hideBias) {
          const gate = tunnels[Math.floor(Math.random() * tunnels.length)]
          const side = fish.x < gate.x ? 1 : -1
          fish.target = {
            x: clamp(gate.x + side * (gate.halfW + 0.1), 0.1, 0.9),
            y: clamp(gate.y + (Math.random() - 0.5) * gate.halfH * 0.5, y0, y1),
          }
          fish.seekDen = null
          picked = true
        }
        if (!picked) {
          fish.seekDen = null
          fish.target = wanderTarget(fish, y0, y1, leftovers)
        }
      }
    }

    if (food) {
      const locked = faceDir(fish)
      if ((food.x - fish.x) * locked < -0.12) turnTo(fish, -locked)
      const size = fishDrawSize(spec, fish)
      const mouthOffX = faceDir(fish) * (size * 0.4) / cssW
      const mouthOffY = (size * 0.04) / cssH
      fish.target = {
        x: food.x - mouthOffX,
        y: food.y - mouthOffY,
      }
    } else if (feeding && !chewing && !leftovers) {
      fish.target = { x: 0.5 + Math.sin(t * 0.7 + seed) * 0.16, y: clamp(0.62, y0, y1) }
    }

    if (!hunting && !leftovers) {
      const tags = uniqueTags(state)
      if (now < fish.happyUntil && tags.has(spec.prefer)) {
        const zones = activeZones(state)
        const liked = zones.find((z) => z.tag === spec.prefer)
          || (spec.prefer === 'hide' ? zones.find((z) => z.kind === 'den' || z.kind === 'tunnel') : null)
          || (spec.prefer === 'sparkle' ? zones.find((z) => z.kind === 'solid') : null)
          || (spec.prefer === 'plants' ? zones.find((z) => z.kind === 'soft') : null)
        if (liked) {
          fish.target.x = fish.target.x * 0.6 + liked.x * 0.4
          fish.target.y = fish.target.y * 0.75 + (liked.y - 0.08) * 0.25
        }
      }

      if (state.starTide && !feeding) {
        const ang = t * 0.4 + (seed % 360) * 0.02
        fish.target = { x: 0.5 + Math.cos(ang) * 0.28, y: 0.48 + Math.sin(ang * 0.8) * 0.18 }
      }
    }

    if (!fish.target) fish.target = { x: fish.x, y: fish.y }
    let dx = fish.target.x - fish.x
    let dy = fish.target.y - fish.y
    let vx
    let vy
    if (hunting) {
      const dir = faceDir(fish)
      const ahead = dx * dir
      if (ahead > 0.012) vx = dir * speed
      else if (ahead > -0.006) vx = dir * speed * (lunging ? 0.45 : 0.12)
      else vx = dir * Math.min(speed * 0.1, 0.008)
      const dive = food && food.y > fish.y + 0.04 ? 0.07 : 0.028
      vy = clamp(dy * 2.4, -0.028, dive)
    } else {
      const dist = Math.hypot(dx, dy) || 1
      vx = (dx / dist) * speed
      vy = (dy / dist) * speed * 0.5
    }

    if (!hunting) {
      for (const z of activeZones(state)) {
        if (z.kind === 'den') {
          if (fish.seekDen === z.id) {
            vx += (z.x - fish.x) * 0.55
            vy += (z.y - fish.y) * 0.7
            if (Math.hypot(fish.x - z.x, fish.y - z.y) < 0.04) {
              fish.hideUntil = t + 0.7 + Math.random() * 0.9
              fish.hideX = clamp(z.x, 0.08, 0.92)
              fish.hideY = clamp(z.y, 0.16, FISH_FLOOR)
              const out = Math.random() < 0.5 ? -1 : 1
              fish.emerge = {
                x: clamp(z.x + out * (0.12 + Math.random() * 0.06), 0.1, 0.9),
                y: clamp(z.y + (Math.random() - 0.5) * 0.03, 0.2, FISH_FLOOR),
              }
              fish.seekDen = null
            }
          } else {
            const d = Math.hypot(fish.x - z.x, fish.y - z.y)
            if (d < 0.12 && d > 0.001 && !inZone(z, fish.x, fish.y, 0.04)) {
              vx += ((fish.x - z.x) / d) * 0.06
              vy += ((fish.y - z.y) / d) * 0.04
            }
          }
          continue
        }
        if (z.kind === 'tunnel') {
          const dxh = fish.x - z.x
          const dyh = fish.y - z.y
          if (Math.abs(dxh) < z.halfW + 0.08) {
            vy += (z.y - fish.y) * 0.55
            if (Math.abs(dyh) > z.halfH) {
              vy += Math.sign(z.y - fish.y) * 0.02
            }
          } else if (Math.abs(dyh) > z.halfH + 0.03) {
            const px = z.x + Math.sign(dxh || 1) * (z.halfW + 0.08)
            const d = Math.hypot(fish.x - px, fish.y - z.y) || 0.001
            if (d < 0.1) {
              vx += ((fish.x - px) / d) * 0.05
              vy += ((fish.y - z.y) / d) * 0.04
            }
          }
          continue
        }
        if (z.kind !== 'solid') continue
        const d = Math.hypot(fish.x - z.x, fish.y - z.y)
        const rad = Math.max(z.halfW, z.halfH) + 0.02
        if (d < rad && d > 0.001) {
          vx += ((fish.x - z.x) / d) * 0.08
          vy += ((fish.y - z.y) / d) * 0.05
        }
      }
      if (spec.id === 'jelly') vy += Math.sin(t * 2.2 + seed) * 0.03
      if (spec.id.includes('horse')) { vx *= 0.65; vy += Math.sin(t * 1.4 + seed) * 0.02 }
      const gait = fish.gait || gaitOf(spec)
      const pose = fish.pose || 'cruise'
      const wave = Math.sin(t * (gait === 'snake' ? 3.6 : 1.15) + seed * 0.01)
      vy += wave * (gait === 'snake' ? 0.016 : 0.007)
      if (pose === 'glide') { vx *= 0.58; vy *= 0.42 }
      else if (pose === 'hover') {
        vx *= 0.18
        vy = Math.sin(t * 2.6 + seed) * 0.014 + ((fish.target?.y ?? fish.y) - fish.y) * 0.15
      } else if (pose === 'dart') { vx *= 1.7; vy *= 0.55 }
      else if (pose === 'rest') { vx *= 0.12; vy += 0.025 }
      else if (pose === 'graze') { vx *= 0.45; vy += 0.018 }
      else if (pose === 'climb') { vy += ((fish.target?.y ?? fish.y) < fish.y ? -0.018 : 0.016) }
      else if (pose === 'inspect') {
        vx *= 0.28
        vy *= 0.45
        vy += Math.sin(t * 5 + seed) * 0.008
      }
      const eco = applyEcology(fish, state, dt, leftovers)
      vx += eco.avx
      vy += eco.avy
    } else {
      const eco = applyEcology(fish, state, dt, true)
      vx += eco.avx * 0.35
      vy += eco.avy * 0.25
    }

    const snap = lunging ? 3.6 : hunting ? 2.2 : 3.2
    fish.vx += (vx - fish.vx) * Math.min(1, dt * snap)
    fish.vy += (vy - fish.vy) * Math.min(1, dt * (hunting ? 2.4 : snap * 0.75))
    if (chewing) {
      fish.vx *= Math.max(0, 1 - dt * 3.2)
      fish.vy *= Math.max(0, 1 - dt * 4.5)
    }
    if (!hunting && t >= (fish.dodgeUntil || 0) && Math.abs(fish.vx) > 0.028) {
      turnTo(fish, fish.vx > 0 ? 1 : -1)
    }

    if (!hunting && leftovers) {
      /* stay down until the last pellet is gone */
    } else if (!hunting && fish.y > y1) {
      fish.vy -= dt * 0.12
    } else if (!hunting && fish.y < y0) {
      fish.vy += dt * 0.12
    }

    let wantPitch = clamp(fish.vy * 8.5, -0.4, 0.4)
    if (fish.pose === 'hover' || fish.pose === 'rest' || fish.pose === 'tuck') wantPitch *= 0.3
    if (fish.pose === 'graze') wantPitch = 0.1
    if (spec.id === 'jelly') wantPitch *= 0.2
    fish.pitch = (fish.pitch || 0) + (wantPitch - (fish.pitch || 0)) * Math.min(1, dt * 4.5)

    const minY = 0.12
    const maxY = FISH_FLOOR
    fish.x = clamp(fish.x + fish.vx * dt, 0.07, 0.93)
    fish.y = clamp(fish.y + fish.vy * dt, minY, maxY)
    if (fish.x <= 0.072) turnTo(fish, 1)
    else if (fish.x >= 0.928) turnTo(fish, -1)
    if (fish.turning > 0) fish.turning -= dt
  }

  function stepPellets(state, dt, onBite) {
    const floor = PELLET_FLOOR
    for (const p of pellets) {
      if (p.eaten) continue
      if (p.delay > 0) {
        p.delay -= dt
        continue
      }
      p.wobble += dt * 1.4
      p.rot += p.spin * dt
      p.x += p.vx * dt + Math.sin(p.wobble) * dt * (p.wet ? 0.008 : 0.002)
      p.y += p.vy * dt
      if (!p.wet && p.y >= 0.075) {
        p.wet = true
        p.vy *= 0.18
        p.vx *= 0.45
      }
      if (p.y >= floor) {
        p.y = floor
        p.vy = 0
        p.vx *= Math.max(0, 1 - dt * 1.6)
        p.spin *= Math.max(0, 1 - dt * 2)
      } else if (p.wet) {
        const sink = 0.014 + p.size * 0.012
        p.vy = Math.min(sink, p.vy + dt * 0.006)
        p.vx *= Math.max(0.35, 1 - dt * 0.18)
      } else {
        p.vy = Math.min(0.22, p.vy + dt * 0.35)
      }
      p.x = clamp(p.x, 0.08, 0.92)
    }

    for (const fish of state.fish) {
      if (fish.entering || (fish.eatBurst <= 0 && fish.peck <= 0)) continue
      const spec = fishById(fish.species)
      const mouth = mouthOf(fish)
      for (const p of pellets) {
        if (p.eaten || p.delay > 0) continue
        if (!pelletEdible(p, spec)) continue
        const reach = (isCrustacean(spec) ? 0.048 : 0.028) + p.size * 0.01
        if (Math.hypot(mouth.x - p.x, mouth.y - p.y) > reach) continue
        if (Math.random() < 0.88) {
          p.eaten = true
          spark(p.x, p.y)
          onBite?.(fish)
          fish.eatBurst = 0
          fish.peck = 0.16
          const next = livePellets().find((q) => q !== p && !q.eaten)
          fish.food = next || null
          fish.eatWait = next ? 0.18 + Math.random() * 0.12 : 0.28 + Math.random() * 0.18
          if (next) turnTo(fish, next.x >= fish.x ? 1 : -1)
        } else {
          p.vx += faceDir(fish) * 0.02 + (Math.random() - 0.5) * 0.02
          p.vy = Math.max(-0.006, p.vy * 0.5)
          fish.food = null
          fish.eatBurst = 0
          fish.peck = 0.1
          fish.eatWait = 0.14 + Math.random() * 0.1
        }
        break
      }
    }

    for (let i = pellets.length - 1; i >= 0; i--) if (pellets[i].eaten) pellets.splice(i, 1)
  }

  function stepMotes(dt) {
    for (const m of motes) {
      m.age += dt
      m.x += m.vx * dt
      m.y += m.vy * dt
      m.vy += dt * 0.08
    }
    for (let i = motes.length - 1; i >= 0; i--) if (motes[i].age > motes[i].life) motes.splice(i, 1)
    const want = 28
    if (ambient.length < want && Math.random() < dt * 8) {
      const stream = Math.random() < 0.5
      const origin = stream
        ? (Math.random() < 0.5 ? 0.16 : 0.82) + (Math.random() - 0.5) * 0.1
        : 0.08 + Math.random() * 0.84
      ambient.push({
        x: origin,
        y: stream ? 0.84 + Math.random() * 0.06 : 0.28 + Math.random() * 0.58,
        r: stream ? 1.4 + Math.random() * 4.2 : 0.9 + Math.random() * 2.6,
        v: 0.045 + Math.random() * 0.1,
        a: 0.2 + Math.random() * 0.32,
        wob: Math.random() * Math.PI * 2,
        layer: Math.random() < 0.34 ? 1 : 0,
      })
    }
    for (const b of ambient) {
      b.y -= b.v * dt
      b.x += Math.sin(t * 2.4 + (b.wob || 0)) * dt * 0.028
    }
    for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].y < 0.045) ambient.splice(i, 1)
  }

  function stepFireworks(dt) {
    if (fireworks.length < 10 && Math.random() < dt * 3) {
      fireworks.push({
        x: 0.2 + Math.random() * 0.6,
        y: 0.85,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.22 - Math.random() * 0.1,
        life: 1.2,
        age: 0,
        hue: 40 + Math.random() * 80,
      })
    }
    for (const f of fireworks) {
      f.age += dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += dt * 0.12
    }
    for (let i = fireworks.length - 1; i >= 0; i--) if (fireworks[i].age > fireworks[i].life) fireworks.splice(i, 1)
  }

  function drawCrawlerFry(c, size) {
    c.fillStyle = '#7aa7c8'
    c.beginPath()
    c.ellipse(size * 0.08, 0, size * 0.3, size * 0.26, -0.2, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#3a5d78'
    c.lineWidth = Math.max(1.2, size * 0.045)
    c.beginPath()
    c.arc(size * 0.1, 0, size * 0.17, 0.35, Math.PI * 2.5)
    c.stroke()
    c.beginPath()
    c.arc(size * 0.12, 0, size * 0.08, 0.2, Math.PI * 2.3)
    c.stroke()
    c.fillStyle = '#d7ebf4'
    c.beginPath()
    c.ellipse(-size * 0.2, size * 0.02, size * 0.14, size * 0.11, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#1a2a33'
    c.beginPath()
    c.arc(-size * 0.24, -size * 0.01, size * 0.028, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#e8a0b0'
    c.beginPath()
    c.arc(-size * 0.18, size * 0.05, size * 0.03, 0, Math.PI * 2)
    c.fill()
  }

  function drawFish(fish, state, now) {
    const spec = fishById(fish.species)
    if (!spec || fish.entering) return
    const hiding = (fish.hideUntil || 0) > t
    const img = images.get(spec.id)
    const p = toXY(fish.x, fish.y)
    const crawler = isCrustacean(spec)
    const hunting = fish.food || fish.eatBurst > 0 || fish.peck > 0
    const seed = hash(fish.id)
    const gait = fish.gait || gaitOf(spec)
    const pose = fish.pose || (crawler ? 'crawl' : 'cruise')
    const speed = Math.hypot(fish.vx || 0, fish.vy || 0)
    const tailHz = crawler ? 4.2 : gait === 'flick' ? 13 : gait === 'puff' || gait === 'wing' ? 3.4 : gait === 'hover' || gait === 'pulse' ? 2.6 : gait === 'snake' ? 8.5 : 6.4
    const tailAmp = crawler
      ? (pose === 'crawl' ? 0.012 : 0.006)
      : pose === 'glide' || pose === 'rest' || pose === 'hover' || pose === 'tuck'
        ? 0.018
        : pose === 'dart' ? 0.07 : gait === 'snake' ? 0.08 : 0.045
    const tail = Math.sin(t * tailHz + seed * 0.002) * tailAmp * (0.4 + Math.min(1.2, speed * 22))
    const bobHz = crawler ? 1.8 : pose === 'hover' || gait === 'hover' ? 2.1 : gait === 'pulse' ? 1.6 : 3.0 + (seed % 9) * 0.12
    const bobAmp = crawler
      ? (pose === 'hop' ? 1.8 : pose === 'sink' ? 1.1 : 0.35)
      : hiding
        ? 1.1
        : hunting
          ? 0.6
          : pose === 'hover'
            ? 4.2
            : pose === 'rest' || pose === 'graze'
              ? 0.8
              : pose === 'dart'
                ? 1.4
                : 2.2 + (seed % 5) * 0.25
    const bob = Math.sin(t * bobHz + seed) * bobAmp
    const sway = crawler
      ? Math.sin(t * 2.6 + seed) * (pose === 'crawl' ? 0.55 : 0.2)
      : Math.sin(t * tailHz * 0.55 + seed) * (pose === 'hover' || pose === 'rest' ? 0.5 : 1.7)
    const grow = growthOf(fish, now)
    const size = spec.size * (cssW < 700 ? 0.78 : 1) * grow.scale * (hiding ? 0.86 : 1)
    let squashX = crawler ? 1 : 1 + tail
    let squashY = crawler ? 1 : 1 - tail * 0.5
    if (!crawler && fish.turning > 0) {
      const u = Math.max(0, fish.turning / (fish.turnLen || 0.18))
      squashX *= 0.7 + (1 - u) * 0.3
      squashY *= 1.16 - (1 - u) * 0.16
    }
    if (crawler && pose === 'hop') squashY = 0.94
    if (crawler && pose === 'sink') squashY = 1.05
    if (!crawler && pose === 'dart') squashX *= 1.08
    if (gait === 'pulse') {
      const pulse = 0.92 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.2 + seed))
      squashX *= pulse
      squashY *= 1.06 / pulse
    }
    if (fish.eatBurst > 0) squashX *= 1.06
    if (fish.peck > 0) squashX *= 1.04
    const facingRight = faceDir(fish) > 0
    const spriteRight = grow.patterned ? spec.face > 0 : true
    const flip = facingRight === spriteRight ? 1 : -1
    const ripe = Boolean(fish.bubble)
    const remain = ripe ? (fish.bubble.until - now) / 1000 : 0
    const glow = ripe ? 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(t * (remain < 1.6 ? 9 : 4.2))) : 0
    const roll = crawler
      ? (pose === 'hop' ? -0.06 : pose === 'sink' ? 0.05 : Math.sin(t * 4.6 + seed) * 0.028)
      : (pose === 'dart' ? 0.1 : 0.04) * Math.sin(t * 1.7 + seed)
        + (fish.turning > 0 ? 0.1 * Math.sign(fish.vy || 1) : 0)
    ctx.save()
    ctx.translate(p.x + sway, p.y + bob)
    ctx.rotate(faceDir(fish) * (fish.pitch || 0) + roll)
    ctx.scale(flip * squashX, squashY)
    if (ripe) {
      ctx.save()
      ctx.globalAlpha = glow
      const rg = ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size * 0.58)
      rg.addColorStop(0, 'rgba(227,182,91,0.55)')
      rg.addColorStop(1, 'rgba(227,182,91,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.55, size * 0.38, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
    if (crawler && grow.patterned) {
      ctx.fillStyle = 'rgba(20,16,10,.22)'
      ctx.beginPath()
      ctx.ellipse(0, size * 0.34, size * 0.28, size * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (!grow.patterned) {
      if (crawler) drawCrawlerFry(ctx, size * 1.15)
      else drawFryShape(ctx, size * 1.35)
    } else if (img && crawler) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      const h = size * (img.height / Math.max(1, img.width))
      ctx.drawImage(img, -size / 2, -h * 0.62, size, h)
    } else if (img) {
      const look = lookFromSeed(fish.lookSeed || seed)
      const key = `${fish.id}:${fish.lookSeed}:${Math.round(size)}:recolor`
      let sprite = lookCache.get(key)
      if (!sprite) {
        sprite = makeLookCanvas(img, look, size)
        lookCache.set(key, sprite)
        if (lookCache.size > 24) {
          const first = lookCache.keys().next().value
          lookCache.delete(first)
        }
      }
      ctx.drawImage(sprite, -size / 2, -sprite.height / 2, size, sprite.height)
    } else {
      ctx.fillStyle = '#E3B65B'
      ctx.beginPath()
      ctx.ellipse(0, 0, size / 2, size / 3.2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function drawChest(state) {
    if (!state.chest) return
    const p = toXY(state.chest.x, state.chest.y)
    const rare = state.chest.tier === 'rare'
    const img = images.get(rare ? 'chest-rare' : 'chest-common')
    const s = chestSize(state.chest)
    const bob = Math.sin(t * 2.2) * 1.4
    ctx.save()
    ctx.translate(p.x, p.y + bob)
    ctx.fillStyle = 'rgba(0,0,0,.22)'
    ctx.beginPath()
    ctx.ellipse(0, s * 0.28, s * 0.34, s * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    if (img) {
      const h = s * (img.height / img.width)
      ctx.drawImage(img, -s / 2, -h * 0.72, s, h)
    } else {
      ctx.fillStyle = rare ? '#E3B65B' : '#8a4b1e'
      ctx.fillRect(-s * 0.28, -s * 0.12, s * 0.56, s * 0.28)
    }
    ctx.restore()
  }

  let sceneBuf = null
  let sceneBufKey = ''

  function sceneBuffer(img, srcH, w, h) {
    const bw = Math.max(1, Math.round(w))
    const bh = Math.max(1, Math.round(h))
    const key = `${img.src || img.width}x${img.height}|${srcH}|${bw}x${bh}`
    if (sceneBuf && sceneBufKey === key) return sceneBuf
    sceneBufKey = key
    if (!sceneBuf || sceneBuf.width !== bw || sceneBuf.height !== bh) {
      sceneBuf = document.createElement('canvas')
      sceneBuf.width = bw
      sceneBuf.height = bh
    }
    const g = sceneBuf.getContext('2d')
    g.clearRect(0, 0, bw, bh)
    g.drawImage(img, 0, 0, img.width, srcH, 0, 0, bw, bh)
    return sceneBuf
  }

  function waterHeight(nx, ny, time) {
    return (
      Math.sin(nx * 6.2 + time * 0.36) * 0.5
      + Math.sin(ny * 4.4 - time * 0.24 + 0.7) * 0.28
      + Math.sin((nx * 0.85 + ny) * 7.8 + time * 0.18) * 0.3
      + Math.sin(nx * 2.4 + ny * 1.8 - time * 0.1) * 0.2
    )
  }

  function smoothstep(a, b, value) {
    const t = clamp((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }

  function waterMask(nx, ny) {
    const side = smoothstep(0.06, 0.14, Math.min(nx, 1 - nx))
    const top = smoothstep(0.03, 0.1, ny)
    const floor = smoothstep(0.16, 0.3, 1 - ny)
    return side * top * floor
  }

  function drawSceneWavy(img, srcH, box) {
    const { x, y, w, h } = box
    if (!img || w < 8 || h < 8) return
    const buf = sceneBuffer(img, srcH, w, h)
    const bw = buf.width
    const bh = buf.height
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, cssW, cssH)
    ctx.clip()
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(buf, 0, 0, bw, bh, x, y, w, h)
    if (sceneCovered || !SCENE_WARP) {
      ctx.restore()
      return
    }
    const cellW = 48
    const cellH = 16
    const eps = 0.02
    const insetL = w * 0.06
    const insetR = w * 0.06
    const insetT = h * 0.04
    const insetB = h * 0.2
    ctx.beginPath()
    ctx.rect(x + insetL, y + insetT, Math.max(0, w - insetL - insetR), Math.max(0, h - insetT - insetB))
    ctx.clip()
    const x0 = Math.max(insetL, Math.floor(-x / cellW) * cellW)
    const y0 = Math.max(insetT, Math.floor(-y / cellH) * cellH)
    const x1 = Math.min(w - insetR, cssW - x)
    const y1 = Math.min(h - insetB, cssH - y)
    for (let destY = y0; destY < y1; destY += cellH) {
      const dh = Math.min(cellH + 1.2, y1 - destY + 1.2)
      const ny = (destY + dh * 0.5) / h
      const depth = 0.12 + 0.88 * (1 - ny) ** 1.25
      for (let destX = x0; destX < x1; destX += cellW) {
        const dw = Math.min(cellW + 1.2, x1 - destX + 1.2)
        const nx = (destX + dw * 0.5) / w
        const fade = waterMask(nx, ny)
        if (fade < 0.04) continue
        const dhdx = waterHeight(nx + eps, ny, t) - waterHeight(nx - eps, ny, t)
        const dhdy = waterHeight(nx, ny + eps, t) - waterHeight(nx, ny - eps, t)
        const ox = dhdx * 22 * depth * fade
        const oy = dhdy * 12 * depth * fade
        const sx = clamp(destX + ox, 0, Math.max(0, bw - dw))
        const sy = clamp(destY + oy, 0, Math.max(0, bh - dh))
        ctx.drawImage(buf, sx, sy, dw, dh, x + destX, y + destY, dw, dh)
      }
    }
    ctx.restore()
  }

  function drawOpenWater() {
    if (!openWaterGrad) {
      openWaterGrad = ctx.createLinearGradient(0, 0, 0, cssH)
      openWaterGrad.addColorStop(0, '#9ad7ef')
      openWaterGrad.addColorStop(0.14, '#4aa0c8')
      openWaterGrad.addColorStop(0.55, '#1c5c86')
      openWaterGrad.addColorStop(1, '#12364f')
    }
    ctx.fillStyle = openWaterGrad
    ctx.fillRect(0, 0, cssW, cssH)
  }

  function drawWaterVolume() {
    if (!volumeGrad) {
      volumeGrad = ctx.createLinearGradient(0, 0, 0, cssH)
      volumeGrad.addColorStop(0, 'rgba(190,235,255,0.08)')
      volumeGrad.addColorStop(0.55, 'rgba(18,70,110,0.06)')
      volumeGrad.addColorStop(1, 'rgba(6,24,42,0.18)')
    }
    ctx.fillStyle = volumeGrad
    ctx.fillRect(0, 0, cssW, cssH)
  }

  function drawBubble(b) {
    ctx.fillStyle = `rgba(190,235,255,${0.18 + b.a * 0.35})`
    ctx.beginPath()
    ctx.arc(b.x * cssW, b.y * cssH, b.r, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawSurface() {
    const y0 = cssH * 0.028
    ctx.save()
    ctx.strokeStyle = 'rgba(230,250,255,0.35)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let x = 0; x <= cssW; x += 8) {
      const y = y0
        + Math.sin(x * 0.028 + t * 1.7) * 2.2
        + Math.sin(x * 0.07 + t * 2.4) * 1.1
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  function draw(state, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowBlur = 0
    ctx.clearRect(0, 0, cssW, cssH)
    const box = sceneBox(state)
    drawOpenWater()
    if (box.img) {
      const srcH = box.img.height * (1 - SCENE_FRAME)
      drawSceneWavy(box.img, srcH, box)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, cssH)
      g.addColorStop(0, '#4aa0c8')
      g.addColorStop(0.7, '#173B59')
      g.addColorStop(1, '#BD8143')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cssW, cssH)
    }
    drawWaterVolume()
    drawSurface()

    if (state.starTide) {
      ctx.fillStyle = 'rgba(8, 18, 40, 0.28)'
      ctx.fillRect(0, 0, cssW, cssH)
    }

    if (upgradeBurst > 0) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, upgradeBurst)
      ctx.strokeStyle = '#A7EFF4'
      ctx.lineWidth = 3
      ctx.strokeRect(8, 8, cssW - 16, cssH - 16)
      ctx.restore()
    }

    for (const b of ambient) {
      if (b.layer) continue
      drawBubble(b)
    }

    if (highlightSand) {
      ctx.save()
      ctx.fillStyle = 'rgba(167,239,244,0.07)'
      ctx.fillRect(cssW * 0.04, cssH * 0.74, cssW * 0.92, cssH * 0.22)
      ctx.strokeStyle = 'rgba(167,239,244,0.4)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(cssW * 0.05, cssH * 0.76, cssW * 0.9, cssH * 0.16)
      if (hoverDrop) {
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.strokeStyle = '#A7EFF4'
        ctx.fillStyle = 'rgba(167,239,244,0.18)'
        ctx.lineWidth = 2
        ctx.ellipse(hoverDrop.x * cssW, hoverDrop.y * cssH, 42, 16, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
    }

    const list = state.fish
    if (list.length > 1) {
      const ordered = list.slice().sort((a, b) => a.y - b.y)
      for (const fish of ordered) drawFish(fish, state, now)
    } else {
      for (const fish of list) drawFish(fish, state, now)
    }
    drawChest(state)
    for (const b of ambient) {
      if (!b.layer) continue
      drawBubble(b)
    }

    for (const p of pellets) {
      if (p.eaten || p.delay > 0 || p.y < -0.02) continue
      const px = p.x * cssW
      const py = p.y * cssH
      const s = 3.2 * p.size
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(p.rot || 0)
      ctx.fillStyle = '#BD8143'
      ctx.beginPath()
      ctx.ellipse(0, 1, s * 1.05, s * 0.78, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#E3B65B'
      ctx.beginPath()
      ctx.ellipse(0, 0, s, s * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,244,200,.7)'
      ctx.beginPath()
      ctx.ellipse(-s * 0.28, -s * 0.18, s * 0.32, s * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    for (const m of motes) {
      const a = 1 - m.age / m.life
      ctx.fillStyle = m.spark ? `rgba(227,182,91,${a})` : `rgba(189,129,67,${a})`
      ctx.fillRect(m.x * cssW, m.y * cssH, 3, 3)
    }

    if (intro && intro.t < intro.dur) {
      const dropT = Math.min(1, intro.t / 0.8)
      const bag = images.get('bag')
      const x = cssW * 0.5
      const y = cssH * (0.08 + dropT * 0.32)
      const pop = intro.t > 0.8 && intro.t < 1.05
      const size = 86 * (pop ? 1.12 : 1)
      if (bag) ctx.drawImage(bag, x - size / 2, y - size / 2, size, size)
      if (intro.t > 1.05) {
        const spec = fishById(intro.species)
        if (spec) {
          const swim = Math.min(1, (intro.t - 1.35) / 0.45)
          const fs = Math.max(18, spec.size * 0.28)
          ctx.save()
          ctx.translate(x + swim * 28, y + 10 - swim * 8)
          drawFryShape(ctx, fs)
          ctx.restore()
        }
      }
    }

    if (state.starTide) {
      for (const f of fireworks) {
        const a = 1 - f.age / f.life
        ctx.fillStyle = `hsla(${f.hue},80%,70%,${a})`
        ctx.beginPath()
        ctx.arc(f.x * cssW, f.y * cssH, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    drawTankLight(ctx, cssW, cssH, now, state.light)
  }

  function tick(dt, state, now, hooks) {
    t += dt
    if (upgradeBurst > 0) upgradeBurst = Math.max(0, upgradeBurst - dt / 1.2)
    if (intro) {
      intro.t += dt
      if (intro.t >= intro.dur) {
        const id = intro.id
        intro = null
        const fish = state.fish.find((f) => f.id === id)
        if (fish) fish.entering = false
        hooks?.onIntroDone?.(fish?.species)
      }
    }
    for (const fish of state.fish) {
      if (fish.entering && (!intro || intro.id !== fish.id)) fish.entering = false
      const grow = growthOf(fish, now)
      if (fish._wasFry && grow.patterned) spark(fish.x, fish.y)
      fish._wasFry = !grow.patterned
    }
    for (const fish of state.fish) thinkFood(fish, dt)
    for (const fish of state.fish) steerFish(fish, state, dt, now)
    stepPellets(state, dt, hooks?.onBite)
    stepMotes(dt)
    if (state.starTide) stepFireworks(dt)
    draw(state, now)
  }

  return {
    warm,
    prefetch,
    ensureTank,
    ensureFish,
    resize,
    tick,
    hit,
    dropOnSand,
    spawnPellets,
    dust,
    spark,
    setIntro,
    skipIntro,
    introActive: () => Boolean(intro),
    setHighlight(on, drop = null) {
      highlightSand = on
      hoverDrop = drop
    },
    burstUpgrade() { upgradeBurst = 1 },
    setCovered(on) { sceneCovered = Boolean(on) },
    toXY,
  }
}
