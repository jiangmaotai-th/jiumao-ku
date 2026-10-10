import RAPIER from '@dimforge/rapier3d-compat'
import {
  DT,
  RING_DIFF,
  aimPointFromHit,
  cameraBasis,
  chargeSpeed,
  clamp,
  easeOutCubic,
  innerOf,
  lerp,
  predictLanding,
  project,
  requiredSpeed,
  unprojectToY0,
} from './math.js'
import { LEVELS, levelById } from './levels.js'
import {
  applyAero,
  createRing,
  holdRing,
  launchRing,
  removeRing,
  ringOut,
  ringPose,
  ringStill,
  tameGooseBounce,
} from './ring.js'
import {
  createPrize,
  neckRoot,
  prizeCatchInfo,
  prizeCaught,
  removePrizePhysics,
  stepPrize,
  syncPrizeKinematics,
  teaseMiss,
} from './prizes.js'
import { createView } from './view2d.js'
import { createGesture, mapFlick } from './gesture.js'
import { createGooseAudio } from './audio.js'
import { createHud } from './hud.js'
import { bossLine, prizeName } from './i18n.js'
import {
  applyEndlessRound,
  applyShopItem,
  coinFor,
  freshRun,
  pickEndlessRound,
  pickShop,
  weaponLabel,
} from './items.js'
import { fetchBoard, submitBoard } from './board.js'

const FOV = (52 * Math.PI) / 180
const CAM_PLAY = { x: 0, y: 1.55, z: 0 }
const CAM_INTRO = { x: 0, y: 1.72, z: -0.55 }
const CAM_TARGET = { x: 0, y: 0.63, z: 3.2 }
const HOLD_WORLD = { x: 0, y: 1.0, z: 0.83 }
const HOLD_LOCAL = { x: 0, y: -0.3, z: -0.95 }

export async function startGoose(root) {
  root.innerHTML = '<div class="goose-boot">圈来运转·套大鹅</div>'
  await RAPIER.init()
  root.innerHTML = ''
  root.className = 'goose-root'

  const stage = document.createElement('div')
  stage.className = 'goose-stage'
  root.appendChild(stage)

  const plate = document.createElement('img')
  plate.className = 'goose-plate'
  plate.src = '/goose/ui-design.png'
  plate.alt = ''
  plate.draggable = false
  stage.appendChild(plate)

  const overlayVer = '20260825-1911'
  const lantern = document.createElement('img')
  lantern.className = 'goose-lantern'
  lantern.src = `/goose/luck-lantern-overlay.png?v=${overlayVer}`
  lantern.alt = ''
  lantern.draggable = false
  stage.appendChild(lantern)

  const prizeSign = document.createElement('img')
  prizeSign.className = 'goose-sign'
  prizeSign.src = `/goose/prize-sign-overlay.png?v=${overlayVer}`
  prizeSign.alt = ''
  prizeSign.draggable = false
  stage.appendChild(prizeSign)

  const canvas = document.createElement('canvas')
  canvas.className = 'goose-canvas'
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  stage.appendChild(canvas)

  const view = createView(canvas)
  const audio = createGooseAudio()
  const hud = createHud(stage)

  function layoutStage() {
    stage.style.width = '100%'
    stage.style.height = '100%'
    hud.layoutHits?.(plate)
  }
  const materials = new Map()
  const gooseByCol = new Map()

  let world = null
  let queue = null
  let matCol = null
  let level = LEVELS[0]
  let lastStory = LEVELS[0]
  let prizes = []
  let rings = []
  let held = null
  let flying = null
  let phase = 'intro'
  let introT = 0
  let score = 0
  let ringsLeft = 10
  let hits = []
  let liveThrows = []
  let volleyHits = []
  let run = freshRun('normal')
  let field = LEVELS[0]
  let shopOpen = false
  let pendingShop = false
  let pendingRemix = false
  let simT = 0
  let acc = 0
  let last = performance.now()
  let paused = false
  let shake = 0
  let lineUntil = 0
  let currentLine = ''
  let aim = { x: 0, z: 2.4 }
  let cursor = { x: 0, y: 0, on: false }
  let previewShown = null
  let needCache = { key: '', v: 6 }
  let fovKick = 0
  let waitUntil = 0
  let catchPopUntil = 0
  let catchPopsLeft = 0
  let pendingResults = false
  let rackN = 0
  let windNow = 0
  let windDir = -1
  let muted = false
  let throwSfxUntil = 0
  try { muted = localStorage.getItem(hud.saveMute) === '1' } catch { /* */ }
  audio.setMuted(muted)
  audio.armAutoplay()

  try {
    const saved = Number(localStorage.getItem('quanyun_level') || 1)
    if (saved >= 1) level = levelById(Math.min(6, saved))
    lastStory = level
  } catch { /* */ }

  function matsFor(h1, h2) {
    return [materials.get(h1), materials.get(h2)]
  }

  function rebuildWorld() {
    if (world) {
      try { world.free() } catch { /* */ }
    }
    if (queue) {
      try { queue.free() } catch { /* */ }
    }
    materials.clear()
    gooseByCol.clear()
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = DT
    world.numSolverIterations = 12
    world.numInternalPgsIterations = 4
    world.maxCcdSubsteps = 2
    queue = new RAPIER.EventQueue(true)

    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.145, 2))
    const groundCol = world.createCollider(
      RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setFriction(0.8).setRestitution(0.05),
      ground,
    )
    materials.set(groundCol.handle, 'mat')

    const matBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.02, 2.45))
    matCol = world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.05, 0.02, 1.35)
        .setFriction(field.matFric)
        .setRestitution(field.matRest),
      matBody,
    )
    materials.set(matCol.handle, 'mat')
  }

  function retuneMat() {
    if (!matCol) return
    try {
      matCol.setFriction(field.matFric ?? 0.55)
      matCol.setRestitution(field.matRest ?? 0.12)
    } catch { /* */ }
  }

  function ringSpec() {
    return { ...RING_DIFF[run.diff] || RING_DIFF.normal, sticky: run.sticky }
  }

  function spawnHeld() {
    const origin = holdWorld()
    const ring = createRing(world, origin, { x: 0, y: 0, z: 0, w: 1 }, ringSpec())
    try { ring.body.setGravityScale(0, true) } catch { /* */ }
    for (const h of ring.handles) materials.set(h, 'ring')
    rings.push(ring)
    held = ring
    flying = null
    liveThrows = []
    if (run.keepMissSave) run.missSave = 1
  }

  function bindPrize(p) {
    materials.set(p.bodyCol.handle, 'goose')
    materials.set(p.neckCol.handle, 'goose')
    gooseByCol.set(p.bodyCol.handle, p)
    gooseByCol.set(p.neckCol.handle, p)
    return p
  }

  function remixField(fromLevel) {
    for (const p of prizes) {
      if (p.scored && !p.rack) collectPrize(p)
      else if (!p.scored) removePrizePhysics(world, p)
    }
    const kept = prizes.filter((p) => p.scored)
    gooseByCol.clear()
    for (const p of kept) {
      if (p.bodyCol) gooseByCol.set(p.bodyCol.handle, p)
      if (p.neckCol) gooseByCol.set(p.neckCol.handle, p)
    }
    const specs = (fromLevel?.prizes || LEVELS[0].prizes).map((s) => ({ ...s }))
    prizes = [
      ...kept,
      ...specs.map((spec, i) => bindPrize(createPrize(world, spec, kept.length + i))),
    ]
    retuneMat()
  }

  function holdWorld(cam = playCam()) {
    if (phase === 'intro') {
      const b = cameraBasis(cam.pos, cam.target)
      return {
        x: cam.pos.x + b.xaxis.x * HOLD_LOCAL.x + b.yaxis.x * HOLD_LOCAL.y + b.zaxis.x * HOLD_LOCAL.z,
        y: cam.pos.y + b.xaxis.y * HOLD_LOCAL.x + b.yaxis.y * HOLD_LOCAL.y + b.zaxis.y * HOLD_LOCAL.z,
        z: cam.pos.z + b.xaxis.z * HOLD_LOCAL.x + b.yaxis.z * HOLD_LOCAL.y + b.zaxis.z * HOLD_LOCAL.z,
      }
    }
    return { ...HOLD_WORLD }
  }

  function playCam() {
    return { pos: { ...CAM_PLAY }, target: { ...CAM_TARGET } }
  }

  function startLevel(id) {
    run = freshRun(run.diff)
    run.mode = 'story'
    level = levelById(id)
    field = level
    score = 0
    ringsLeft = level.rings
    hits = []
    simT = 0
    acc = 0
    shake = 0
    rackN = 0
    fovKick = 0
    introT = 2.6
    phase = 'ready'
    waitUntil = 0
    catchPopUntil = 0
    catchPopsLeft = 0
    pendingResults = false
    shopOpen = false
    pendingShop = false
    pendingRemix = false
    flying = null
    liveThrows = []
    volleyHits = []
    held = null
    rings = []
    currentLine = ''
    lastStory = level
    hud.hideResult()
    hud.hideCatchPop?.()
    hud.clearCatches?.()
    hud.hideShop?.()
    hud.toggleLevels?.(false)
    hud.toggleSettings?.(false)
    rebuildWorld()
    prizes = level.prizes.map((spec, i) => bindPrize(createPrize(world, spec, i)))
    spawnHeld()
    audio.setMode('story')
    audio.setTheme(level.boss ? 'boss' : 'stall')
    if (level.boss) say(bossLine('intro'), 2200)
    audio.setLastRing(ringsLeft === 1)
  }

  function startEndless() {
    run = freshRun(run.diff)
    run.mode = 'endless'
    score = 0
    ringsLeft = 10
    hits = []
    simT = 0
    acc = 0
    shake = 0
    rackN = 0
    fovKick = 0
    introT = 2.6
    phase = 'ready'
    waitUntil = 0
    catchPopUntil = 0
    catchPopsLeft = 0
    pendingResults = false
    shopOpen = false
    pendingShop = false
    pendingRemix = false
    flying = null
    liveThrows = []
    volleyHits = []
    held = null
    rings = []
    currentLine = ''
    hud.hideResult()
    hud.hideCatchPop?.()
    hud.clearCatches?.()
    hud.hideShop?.()
    hud.toggleLevels?.(false)
    hud.toggleSettings?.(false)
    const first = pickEndlessRound('')
    const applied = applyEndlessRound(run, first)
    adoptEndlessStage(applied)
    rebuildWorld()
    prizes = field.prizes.map((spec, i) => bindPrize(createPrize(world, spec, i)))
    spawnHeld()
    audio.setMode('endless')
    audio.setTheme(field.boss ? 'boss' : 'stall')
    say(`${run.styleTitle} · ${run.styleBlurb}`, 2400)
    audio.setLastRing(false)
  }

  function adoptEndlessStage(applied) {
    field = { ...(applied.base || LEVELS[0]) }
    if (applied.wind) field = { ...field, wind: applied.wind }
    level = { ...field, id: 0, name: '无尽夜市', rings: 10, target: 0, boss: !!field.boss }
  }

  function rollEndlessStyle() {
    const next = pickEndlessRound(run.lastLevel)
    const applied = applyEndlessRound(run, next)
    adoptEndlessStage(applied)
    remixField(applied.base)
    audio.setTheme(field.boss ? 'boss' : 'stall')
    say(`${run.styleTitle} · ${run.styleBlurb}`, 2200)
  }

  function say(text, ms = 1600) {
    currentLine = text
    lineUntil = performance.now() + ms
  }

  function setPaused(on) {
    paused = on
    hud.pausedEl.hidden = !on
  }

  function canThrow() {
    return !paused && phase === 'ready' && held && !held.collected
  }

  function readAim(e, cam = lastCam) {
    if (!e) return null
    const rect = canvas.getBoundingClientRect()
    const sx = (e.clientX - rect.left) * (canvas.clientWidth / Math.max(1, rect.width))
    const sy = (e.clientY - rect.top) * (canvas.clientHeight / Math.max(1, rect.height))
    cursor = { x: sx, y: sy, on: true }
    const hit = unprojectToY0(sx, sy, cam)
    return hit ? aimPointFromHit(hit) : null
  }

  function aimFromCursor(cam) {
    if (!cursor.on) return aim
    const hit = unprojectToY0(cursor.x, cursor.y, cam)
    return hit ? aimPointFromHit(hit) : aim
  }

  function throwParamsFromAim(power) {
    const origin = holdWorld()
    const yaw = Math.atan2(-(aim.x - origin.x), aim.z - origin.z)
    const pitch = ((run.light ? field.pitch + 4 * (run.lightBoost || 1) : field.pitch) * Math.PI) / 180
    const key = `${aim.x.toFixed(3)}:${aim.z.toFixed(3)}:${pitch.toFixed(4)}:${yaw.toFixed(4)}`
    let need = needCache.v
    if (needCache.key !== key) {
      need = requiredSpeed(origin, aim, pitch, yaw)
      needCache = { key, v: need }
    }
    const speed = chargeSpeed(need, power)
    return { origin, yaw, pitch, speed, spin: 8, roll: 0 }
  }

  function release(opts) {
    if (!canThrow()) return
    audio.unlock()
    const n = Math.max(1, run.throwCount || 1)
    const yawStep = run.fan || 0.075
    const pitchStep = run.pitchFan || 0
    const offsets = n === 1
      ? [{ yaw: 0, pitch: 0, x: 0 }]
      : Array.from({ length: n }, (_, i) => {
        const k = i - (n - 1) / 2
        const pitchSign = i % 2 === 0 ? -1 : 1
        return {
          yaw: k * yawStep,
          pitch: pitchStep ? pitchSign * pitchStep * (0.55 + Math.abs(k) * 0.4) : 0,
          x: k * (run.fan ? 0.14 : 0.028),
        }
      })
    const speed = run.light ? opts.speed * (1 + 0.08 * (run.lightBoost || 1)) : opts.speed
    liveThrows = []
    volleyHits = []
    for (let i = 0; i < n; i++) {
      let ring
      if (i === 0) {
        ring = held
        held = null
      } else {
        ring = createRing(world, opts.origin, { x: 0, y: 0, z: 0, w: 1 }, ringSpec())
        for (const h of ring.handles) materials.set(h, 'ring')
        rings.push(ring)
      }
      const off = offsets[i]
      const origin = { x: opts.origin.x + off.x, y: opts.origin.y, z: opts.origin.z }
      try { ring.body.setGravityScale(1, true) } catch { /* */ }
      launchRing(ring, origin, opts.yaw + off.yaw, opts.pitch + off.pitch, speed, opts.spin, opts.roll)
      ring.lastSpeed = speed
      ring.touchGoose = false
      ring.gooseHits = 0
      ring.born = performance.now()
      ring.still = 0
      ring.judged = false
      liveThrows.push(ring)
    }
    flying = liveThrows[0]
    ringsLeft = Math.max(0, ringsLeft - 1)
    audio.setLastRing(ringsLeft <= 1)
    audio.playThrow()
    throwSfxUntil = performance.now() + 850
    phase = 'flying'
  }

  function showResults() {
    phase = 'results'
    pendingResults = false
    if (run.mode === 'endless') {
      hud.showEndlessResult(
        { score, geese: run.geese, coins: run.coins, diff: run.diff, hits },
        () => startEndless(),
        () => startLevel(1),
        (name) => submitBoard({ name, geese: run.geese, score, diff: run.diff }),
        () => fetchBoard(),
      )
      return
    }
    hud.showResult(
      { level, score, hits },
      () => startLevel(Math.min(6, level.id + 1)),
      () => hud.toggleLevels(true),
      () => startLevel(level.id),
    )
  }

  function openShop(lastChance = false) {
    shopOpen = true
    pendingShop = false
    phase = 'shop'
    hud.showShop({
      coins: run.coins,
      ringsLeft,
      lastChance,
      items: pickShop(run, lastChance),
      onBuy: (item) => {
        if (!applyShopItem(run, item, simT)) return false
        if (run._ringsGain) {
          ringsLeft += run._ringsGain
          run._ringsGain = 0
        }
        say(`买下了：${item.title}`, 1600)
        return true
      },
      onClose: () => {
        shopOpen = false
        hud.hideShop()
        if (ringsLeft <= 0) {
          if (run.charm) {
            const extra = run.charmN || 3
            run.charm = false
            ringsLeft += extra
            say(`护身符碎了，又有 ${extra} 个圈！`, 1800)
            phase = 'wait'
            waitUntil = performance.now() + 400
            return
          }
          showResults()
          return
        }
        phase = 'wait'
        waitUntil = performance.now() + 350
      },
    })
  }

  function finishThrow(caughtList) {
    for (const r of liveThrows) {
      if (r && !r.collected) r.judged = true
    }
    const now = performance.now()
    if (!caughtList.length) {
      run.streak = 0
      const pos = flying?.body?.translation?.() || liveThrows[0]?.body?.translation?.() || null
      teaseMiss(prizes, simT, pos)
      audio.missSting()
      if (field.boss && Math.random() < 0.45) say(bossLine('miss'))
      if (run.missSave > 0) {
        ringsLeft += 1
        run.missSave = 0
        say('没中也还你：圈回来了', 1400)
      }
    } else if (run.mode === 'endless') {
      run.streak += 1
    }
    flying = null
    liveThrows = []
    for (const p of prizes) {
      if (!p.scored) p.frozen = false
    }
    if (run.mode === 'endless') {
      if (caughtList.length && Math.floor(run.catchN / 3) > Math.floor((run.catchN - caughtList.length) / 3)) pendingShop = true
      pendingRemix = true
      phase = 'wait'
      if (ringsLeft <= 0) {
        waitUntil = now + (caughtList.length ? 900 : 1000)
        pendingResults = !pendingShop
        if (pendingShop) waitUntil = now + 700
        return
      }
      waitUntil = now + 700
      return
    }
    phase = 'wait'
    if (ringsLeft <= 0) {
      pendingResults = true
      waitUntil = now + (caughtList.length ? 1000 : 1100)
      return
    }
    waitUntil = now + 1000
  }

  function ringInner(ring) {
    return (ring?.innerR || innerOf(RING_DIFF[run.diff] || RING_DIFF.normal)) + (run.slack || 0)
  }

  function hangingOn(ring, pose) {
    if (!pose || !ring?.body) return []
    const v = ring.body.linvel()
    const w = ring.body.angvel()
    if (Math.hypot(v.x, v.y, v.z) > 1.45) return []
    if (Math.hypot(w.x, w.y, w.z) > 2.6) return []
    return prizes.filter((p) => !p.scored && prizeCaught(p, pose, ringInner(ring), run.slack))
  }

  function ringHanging(ring, pose) {
    return hangingOn(ring, pose).length > 0
  }

  function catchLog(row) {
    const buf = (window.__gooseCatchLog = window.__gooseCatchLog || [])
    const entry = { at: new Date().toISOString(), ...row }
    buf.push(entry)
    if (buf.length > 40) buf.shift()
    console.info('[goose-catch]', entry)
    try { sessionStorage.setItem('goose-catch-log', JSON.stringify(buf.slice(-20))) } catch { /* */ }
  }

  function nearestCatchInfo(pose, ring) {
    if (!pose) return []
    const hole = ringInner(ring)
    return prizes
      .filter((p) => !p.scored)
      .map((p) => ({
        d: Math.hypot(pose.t.x - p.curX, pose.t.z - p.curZ),
        ...prizeCatchInfo(p, pose, hole, run.slack),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
  }

  function seatRingOnNeck(ring, p) {
    if (!ring?.body || ring.collected) return
    const B = neckRoot(p)
    const y = B.y + p.neckLen * 0.42
    try {
      ring.body.setTranslation({ x: p.curX, y, z: p.curZ - p.bodyR * 0.16 }, true)
      ring.body.setRotation({ x: 0.18, y: 0, z: 0, w: 0.98 }, true)
      ring.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      ring.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      ring.body.setGravityScale(0, true)
    } catch { /* */ }
  }

  function judgeRing(ring) {
    if (!ring || ring.judged || ring.collected) return
    ring.judged = true
    const pose = ringPose(ring)
    if (!pose) {
      catchLog({ event: 'miss', why: 'no-pose' })
      maybeFinishVolley()
      return
    }
    pose.linvel = ring.body?.linvel?.() || { x: 0, y: 0, z: 0 }
    const hung = hangingOn(ring, pose)
    const hitsNow = hung.slice().sort((a, b) => b.score - a.score)
    const takeN = Math.max(1, run.dualMax || (run.dual ? 2 : 1))
    const take = hitsNow.slice(0, takeN)
    catchLog({
      event: take.length ? 'hit' : 'miss',
      why: take.length ? 'neck-hang' : (ringOut(ring) ? 'out' : 'no-neck'),
      still: round3(ring.still),
      y: round3(pose.t.y),
      ny: round3(pose.n?.y),
      take: take.map((p) => p.kind),
      near: nearestCatchInfo(pose, ring),
    })
    if (!take.length) {
      if (ringOut(ring)) removeRing(world, ring)
      maybeFinishVolley()
      return
    }
    for (const winner of take) applyCatch(winner, ring, pose)
    if (run.aoe && take[0]) {
      const origin = take[0]
      const rad = run.aoeR || 0.42
      const cap = run.aoeN || 2
      const near = hung.filter((p) => p !== origin && Math.hypot(p.curX - origin.curX, p.curZ - origin.curZ) < rad)
      for (const extra of near.slice(0, cap)) applyCatch(extra, ring, pose)
    }
    maybeFinishVolley()
  }

  function round3(n) {
    return Math.round(Number(n || 0) * 1000) / 1000
  }

  function maybeFinishVolley() {
    if (liveThrows.some((r) => r && !r.judged && !r.collected)) return
    const caught = volleyHits.splice(0)
    finishThrow(caught)
  }

  function applyCatch(p, ring, pose) {
    if (p.scored && p.kind !== 'boss') return
    volleyHits.push(p)
    const scr = project(pose.t, lastCam)
    const coins = run.mode === 'endless' ? coinFor(p, run) : 0
    if (run.mode === 'endless') {
      run.coins += coins
      run.geese += p.kind === 'boss' && p.hp > 1 ? 0 : 1
      run.catchN += 1
      const gain = 1 + (Math.random() < (run.doubleRingChance || 0) ? 1 : 0)
      ringsLeft += gain
      view.burst('catch', { x: scr.x, y: scr.y })
      audio.catchFanfare()
    } else {
      view.burst('catch', { x: scr.x, y: scr.y })
      audio.catchFanfare()
    }
    if (p.kind === 'boss') {
      p.hp = Math.max(0, (p.hp || 3) - 1)
      score += 500
      hits.push({ name: prizeName('boss'), score: 500 })
      if (p.hp <= 0) {
        p.scored = true
        p.frozen = true
        p.hidden = false
        p.popScore = 500
        p.popCoins = coins
        p.catchAt = performance.now() + 1000
        say(bossLine('dead'), 2200)
        if (ring && !ring.collected && (run.dualMax || (run.dual ? 2 : 1)) < 2) {
          p.catchRing = ring
          seatRingOnNeck(ring, p)
        } else if (ring && (run.dualMax || (run.dual ? 2 : 1)) < 2) removeRing(world, ring)
      } else {
        say(bossLine('hit'))
        if (ring && (run.dualMax || (run.dual ? 2 : 1)) < 2) removeRing(world, ring)
      }
      return
    }
    p.scored = true
    p.frozen = true
    p.hidden = false
    p.popScore = p.score
    p.popCoins = coins
    p.catchRing = ring
    p.catchAt = performance.now() + 1000
    score += p.score
    hits.push({ name: prizeName(p.kind), score: p.score })
    seatRingOnNeck(ring, p)
  }

  function collectPrize(p) {
    if (p.catchRing && !p.catchRing.collected) removeRing(world, p.catchRing)
    p.catchRing = null
    removePrizePhysics(world, p)
    p.hidden = true
    p.rack = { x: 0, z: 0 }
    p.pendingRack = false
    hud.addCatch?.({ kind: p.kind, score: p.popScore || p.score || 0 })
    catchPopsLeft += 1
    catchPopUntil = 1e15
    hud.showCatchPop({
      score: p.popScore || p.score || 0,
      coins: p.popCoins || 0,
      coinsOnly: run.mode === 'endless',
      onShow() {
        audio.honkCatch()
      },
      onDone() {
        catchPopsLeft = Math.max(0, catchPopsLeft - 1)
        if (catchPopsLeft === 0) catchPopUntil = performance.now()
      },
    })
  }

  const gesture = createGesture({
    canvas,
    onFlick(flick) {
      audio.unlock()
      if (!canThrow()) return
      const mapped = mapFlick(flick)
      const origin = holdWorld()
      if (mapped.slip) {
        release({ origin, yaw: 0, pitch: 0.15, speed: 0.55, spin: 0.4, roll: 0 })
        return
      }
      release({
        origin,
        yaw: mapped.yaw,
        pitch: mapped.pitch,
        speed: mapped.speed,
        spin: mapped.spin,
        roll: mapped.roll,
      })
    },
    onAimStart() {
      audio.unlock()
    },
    onCursor(e) {
      readAim(e)
    },
    onAimMove(e) {
      const next = readAim(e)
      if (next) aim = next
    },
    onAimRelease(e, power) {
      audio.unlock()
      const next = readAim(e)
      if (next) aim = next
      if (!canThrow()) return
      release(throwParamsFromAim(power))
    },
    onPower() {
      audio.unlock()
    },
  })

  canvas.addEventListener('pointerdown', () => audio.unlock())
  function toggleMute() {
    muted = !muted
    audio.setMuted(muted)
    try { localStorage.setItem(hud.saveMute, muted ? '1' : '0') } catch { /* */ }
  }
  hud.muteBtn.addEventListener('click', toggleMute)
  hud.muteFab?.addEventListener('click', toggleMute)
  hud.pauseBtn.addEventListener('click', () => setPaused(!paused))
  hud.resumeBtn.addEventListener('click', () => setPaused(false))
  hud.modeStory.addEventListener('click', () => {
    audio.unlock()
    if (run.mode === 'endless') startLevel(lastStory.id || 1)
    else hud.toggleLevels()
  })
  hud.pickOpen?.addEventListener('click', () => {
    audio.unlock()
    hud.toggleLevels()
  })
  hud.modeEndless.addEventListener('click', () => {
    audio.unlock()
    startEndless()
  })
  hud.picks.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]')
    if (!btn || btn.disabled) return
    hud.toggleLevels(false)
    startLevel(Number(btn.dataset.pick))
  })
  hud.boardBtn.addEventListener('click', () => {
    hud.toggleSettings(false)
    hud.showBoard(() => fetchBoard())
  })
  hud.coinPlus.addEventListener('click', () => {
    audio.unlock()
    if (run.mode !== 'endless') return
    if (phase === 'ready' || phase === 'wait') openShop(ringsLeft <= 0)
  })
  hud.diffs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-diff]')
    if (!btn?.dataset.diff) return
    run.diff = btn.dataset.diff
    if (held && !held.collected) {
      removeRing(world, held)
      held = null
      spawnHeld()
    }
  })

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      e.preventDefault()
      setPaused(!paused)
    }
    if (e.code === 'KeyR' && phase === 'results') {
      if (run.mode === 'endless') startEndless()
      else startLevel(level.id)
    }
  })

  let lastCam = makeCam(CAM_INTRO, CAM_TARGET, 1, 1)

  function makeCam(pos, target, w, h, fov = FOV + fovKick) {
    const b = cameraBasis(pos, target)
    return { pos, target, ...b, w, h, cx: w / 2, cy: h / 2, fov }
  }

  function cameraNow(w, h) {
    return makeCam({ ...CAM_PLAY }, { ...CAM_TARGET }, w, h, FOV)
  }

  function stepPhysics(dtMs) {
    const now = performance.now()
    let ringPos = null
    let ringVel = null
    const flyer = liveThrows.find((r) => r && r.body && !r.collected && !r.judged) || flying
    if (flyer && flyer.body && !flyer.collected) {
      ringPos = flyer.body.translation()
      ringVel = flyer.body.linvel()
    }
    const prizeCfg = {
      ...field,
      walk: field.walk,
      noDuck: run.noDuck,
      slowMul: run.slowMul,
      freezeUntil: run.freezeUntil,
    }
    for (const p of prizes) {
      stepPrize(p, simT, DT, ringPos, ringVel, prizeCfg)
      if (p._honkMiss) {
        audio.honkMiss(clamp(p.curX / 1.5, -1, 1))
        p._honkMiss = false
      }
      if (p._honk) {
        if (now >= throwSfxUntil) audio.honkDuck(clamp(p.curX / 1.5, -1, 1))
        p._honk = false
      }
      if (p.bodyRb) syncPrizeKinematics(p)
      if (p.scored && p.catchAt && now >= p.catchAt && !p.rack) collectPrize(p)
    }

    windNow = field.wind
      ? field.wind * (0.6 * Math.sin(simT * 0.7) + 0.4 * Math.sin(simT * 1.9 + 1.3)) * 2
      : 0
    if (windNow) windDir = Math.sign(windNow)

    if (held && held.body && !held.collected) {
      holdRing(held, holdWorld(lastCam), gesture.power())
    }
    for (const r of rings) {
      if (r.collected || !r.body) continue
      if (r === held) continue
      const v = r.body.linvel()
      r.lastSpeed = Math.hypot(v.x, v.y, v.z)
      applyAero(r, DT, run.noWind ? 0 : windNow)
      if (run.magnet && r.body) {
        const t = r.body.translation()
        let best = null
        let bestD = 1e9
        for (const p of prizes) {
          if (p.scored) continue
          const d = Math.hypot(p.curX - t.x, p.curZ - t.z)
          if (d < bestD) { bestD = d; best = p }
        }
        if (best && bestD < 1.4) {
          r.body.applyImpulse({
            x: (best.curX - t.x) * run.magnet * DT,
            y: 0,
            z: (best.curZ - t.z) * run.magnet * DT,
          }, true)
        }
      }
    }

    world.step(queue)
    queue.drainCollisionEvents((h1, h2, started) => {
      const kinds = matsFor(h1, h2)
      if (!kinds.includes('ring')) return
      const ringHandle = kinds[0] === 'ring' ? h1 : h2
      const ring = rings.find((r) => !r.collected && r.body && r.handles.includes(ringHandle))
      if (!ring || ring.collected) return
      const other = kinds.find((k) => k && k !== 'ring')
      if (other === 'goose') {
        ring.gooseHits = Math.max(0, (ring.gooseHits || 0) + (started ? 1 : -1))
        ring.touchGoose = ring.gooseHits > 0
      }
      if (!started) return
      if (ring.born && now - ring.born < 850) return
      const speed = ring.lastSpeed || 0
      if (speed < 0.4) return
      const x = ring.body?.translation?.().x || 0
      if (other === 'goose') audio.hit('goose', speed, x)
      else if (other === 'mat') audio.hit('mat', speed, x)
      if (other === 'goose' && speed > 1.8) {
        const g = gooseByCol.get(h1) || gooseByCol.get(h2)
        if (g) g.flinchUntil = simT + 0.45
      }
      if (other === 'mat' && speed > 2.6 && ring.body) {
        const t = ring.body.translation()
        const scr = project({ x: t.x, y: 0.02, z: t.z }, lastCam)
        view.dust(scr, speed)
      }
    })

    for (const r of rings) {
      if (r.collected || !r.body || r === held) continue
      tameGooseBounce(r)
    }

    if (liveThrows.length) {
      for (const flyer of liveThrows) {
        if (!flyer || flyer.collected || flyer.judged || !flyer.body) continue
        const pose = ringPose(flyer)
        if (pose) {
          pose.linvel = flyer.body.linvel()
          const scr = project(pose.t, lastCam)
          flyer.trail.push({ x: scr.x, y: scr.y })
          if (flyer.trail.length > 14) flyer.trail.shift()
          for (const p of hangingOn(flyer, pose)) p.frozen = true
        }
        const hangNeed = 0.28
        const stillNeed = 0.55
        if (ringOut(flyer)) {
          flyer.still = 999
          judgeRing(flyer)
        } else if (ringHanging(flyer, pose)) {
          flyer.still += DT
          if (flyer.still >= hangNeed) judgeRing(flyer)
        } else if (ringStill(flyer)) {
          flyer.still += DT
          if (flyer.still >= stillNeed) judgeRing(flyer)
        } else {
          flyer.still = 0
          if (now - flyer.born > 10000) judgeRing(flyer)
        }
      }
    }
  }

  function tick(now) {
    const rawDt = Math.min(0.05, (now - last) / 1000)
    last = now
    layoutStage()
    const size = view.resize()
    const power = phase === 'ready' ? gesture.power() : 0
    updateRotateHint()

    if (!paused) {
      introT += rawDt
      if (phase === 'intro' && introT >= 2.6) phase = 'ready'
      fovKick *= Math.exp(-9 * rawDt)
      shake = Math.max(0, shake - rawDt)
      if (now > lineUntil) currentLine = ''
      if (phase === 'wait' && now >= waitUntil && now >= catchPopUntil) {
        if (pendingShop) openShop(ringsLeft <= 0)
        else if (pendingResults) showResults()
        else {
          if (pendingRemix) {
            pendingRemix = false
            rollEndlessStyle()
          }
          spawnHeld()
          phase = 'ready'
        }
      }
      if (phase !== 'results' && phase !== 'shop') {
        acc += rawDt
        let steps = 0
        while (acc >= DT && steps < 8) {
          simT += DT
          stepPhysics(DT)
          acc -= DT
          steps++
        }
        if (steps === 8) acc = 0
      }
      if (held && held.body && !held.collected) {
        const cam = cameraNow(size.w, size.h)
        holdRing(held, holdWorld(cam), power)
      }
    }

    lastCam = cameraNow(size.w, size.h)
    const want = aimFromCursor(lastCam)
    const follow = 1 - Math.exp(-28 * rawDt)
    aim = {
      x: aim.x + (want.x - aim.x) * follow,
      z: aim.z + (want.z - aim.z) * follow,
    }
    let preview = null
    if (phase === 'ready' && power > 0) {
      const p = throwParamsFromAim(power)
      const land = predictLanding(p.origin, p.yaw, p.pitch, p.speed)
      if (!previewShown) previewShown = { x: land.x, z: land.z }
      else {
        previewShown.x += (land.x - previewShown.x) * follow
        previewShown.z += (land.z - previewShown.z) * follow
      }
      preview = previewShown
    } else {
      previewShown = null
    }
    const holdScr = held && held.body && !held.collected
      ? project(held.body.translation(), lastCam)
      : null
    view.draw({
      w: size.w,
      h: size.h,
      cam: lastCam,
      prizes,
      rings,
      t: simT,
      rainOn: field.rain,
      aim: phase === 'ready' ? aim : null,
      preview,
      holdScr,
      power,
      shake,
      bossLine: currentLine,
      coinTags: run.mode === 'endless',
      run: run.mode === 'endless' ? run : null,
    })
    hud.paint({
      level,
      storyLevel: lastStory,
      score,
      ringsLeft,
      muted,
      windNow: windDir || 0,
      windStr: field.wind || 0,
      bossLine: currentLine,
      mode: run.mode,
      coins: run.mode === 'endless' ? run.coins : run.coins,
      geese: run.geese,
      diff: run.diff,
      styleTitle: run.styleTitle,
      weapon: run.mode === 'endless' && (run.throwCount || 1) > 1 ? weaponLabel(run) : '',
      catchN: run.catchN,
    })
    requestAnimationFrame(tick)
  }

  function updateRotateHint() {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const portrait = window.matchMedia('(orientation: portrait)').matches
    hud.rotateEl.hidden = !(coarse && portrait)
  }

  startLevel(level.id)
  window.__quanyun = {
    get phase() { return phase },
    get score() { return score },
    get catchLog() { return window.__gooseCatchLog || [] },
    startLevel,
  }
  requestAnimationFrame(tick)
}
