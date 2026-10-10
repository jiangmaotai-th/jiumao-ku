import RAPIER from '@dimforge/rapier3d-compat'
import { INNER_R, add, clamp, len, quatFromUnitVectors, scale, sub } from './math.js'
import { catchTest } from './ring.js'

export function neckRoot(p) {
  return { x: p.curX, y: p.bodyR * 1.2, z: p.curZ - p.bodyR * 0.3 }
}

export function bodyCenter(p) {
  return { x: p.curX, y: p.bodyR * 0.8, z: p.curZ }
}

export function createPrize(world, spec, index) {
  const phase = index * 1.7
  const prize = {
    ...spec,
    id: `p-${index}`,
    phase,
    walkPhase: spec.walkPhase ?? phase,
    curX: spec.x,
    curZ: spec.z,
    duck: 0,
    duckUntil: 0,
    cooldownUntil: 0,
    flinchUntil: 0,
    tauntUntil: 0,
    tauntStart: 0,
    tauntAmp: 0,
    tauntCycles: 4,
    taunt2Start: 0,
    taunt2Until: 0,
    taunt2Cycles: 1,
    frozen: false,
    scored: false,
    hidden: false,
    hp: spec.hp || 0,
    head: { x: spec.x, y: spec.bodyR * 1.2 + spec.neckLen, z: spec.z - spec.bodyR * 0.3 },
    rack: null,
  }
  const y = spec.bodyR * 0.8
  const bodyFric = spec.kind === 'boss' ? 0.85 : 0.55
  const bodyRest = spec.kind === 'boss' ? 0.03 : 0.05
  const Combine = RAPIER.CoefficientCombineRule
  prize.bodyRb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spec.x, y, spec.z),
  )
  prize.bodyCol = world.createCollider(
    RAPIER.ColliderDesc.ball(spec.bodyR * 0.92)
      .setFriction(bodyFric)
      .setRestitution(bodyRest)
      .setFrictionCombineRule(Combine.Average)
      .setRestitutionCombineRule(Combine.Average)
      .setContactSkin(0.002),
    prize.bodyRb,
  )
  prize.neckRb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spec.x, spec.bodyR * 1.2 + spec.neckLen / 2, spec.z - spec.bodyR * 0.3),
  )
  prize.neckCol = world.createCollider(
    RAPIER.ColliderDesc.capsule(spec.neckLen / 2, spec.neckR)
      .setFriction(0.58)
      .setRestitution(0.06)
      .setFrictionCombineRule(Combine.Average)
      .setRestitutionCombineRule(Combine.Average)
      .setContactSkin(0.0018),
    prize.neckRb,
  )
  return prize
}

export function stepPrize(p, t, dt, ringPos, ringVel, cfg) {
  if (p.frozen && !p.scored) {
    const B = neckRoot(p)
    const amp = (p.swayAmp || 0.05) * 0.12
    p.head = {
      x: B.x + Math.sin(t * 1.1 + p.phase) * amp,
      y: B.y + p.neckLen,
      z: B.z + Math.cos(t * 0.9 + p.phase) * amp * 0.4,
    }
    return
  }

  if (p.scored && p.rack) {
    p.curX = p.rack.x
    p.curZ = p.rack.z
    const B = neckRoot(p)
    const amp = (p.swayAmp || 0.05) * 0.35
    p.head = {
      x: B.x + Math.sin(t * 1.7 + p.phase) * amp,
      y: B.y + p.neckLen,
      z: B.z + Math.cos(t * 1.3 + p.phase * 1.7) * amp * 0.5,
    }
    return
  }

  if (cfg.freezeUntil && t < cfg.freezeUntil) {
    p.curX = p.x
    p.curZ = p.z
  } else if (p.walk || cfg.walk) {
    const sp = (p.walkSpeed || 0.62) * (cfg.slowMul || 1)
    p.curX = p.x + Math.sin(t * sp + p.walkPhase) * (p.walkAmpX || 0.11)
    p.curZ = p.z + Math.cos(t * sp * 0.8 + p.walkPhase) * (p.walkAmpZ || 0.05)
  } else {
    p.curX = p.x
    p.curZ = p.z
  }

  const B = neckRoot(p)
  const scoredWait = p.scored && !p.rack
  const flinchMul = (!scoredWait && t < p.flinchUntil) ? 2.6 : 1
  let swayX = Math.sin(t * 1.7 + p.phase) * (p.swayAmp || 0.05) * (cfg.swayMul || 1) * flinchMul
  let swayZ = Math.cos(t * 1.3 + p.phase * 1.7) * (p.swayAmp || 0.05) * 0.5 * (cfg.swayMul || 1) * flinchMul

  if (!scoredWait && !cfg.noDuck && ringPos && t > p.cooldownUntil) {
    const dx = p.head.x - ringPos.x
    const dz = p.head.z - ringPos.z
    const dist = Math.hypot(dx, dz)
    const closing = ringVel ? (ringVel.x * dx + ringVel.z * dz) / Math.max(0.001, dist) : 0
    const react = (p.react || 0.6) * (cfg.reactMul || 1)
    if (dist < react && closing > 0.5) {
      p.duckUntil = t + 0.7
      p.cooldownUntil = t + (cfg.duckCd || 1.8)
      p._honk = true
    }
  }

  const shake = missShake(p, t)
  if (!scoredWait && shake) {
    swayX += shake.x
    swayZ *= 0.35
  }

  const duckTarget = (!scoredWait && t < p.duckUntil) ? 1 : 0
  p.duck += (duckTarget - p.duck) * Math.min(1, 14 * dt)

  p.head = {
    x: B.x + swayX,
    y: B.y + p.neckLen - p.duck * p.neckLen * 0.75,
    z: B.z + swayZ + p.duck * 0.06,
  }
}

/** sfx-honk-miss.mp3: first phrase 0–0.78s, rest, second honk ~1.88–2.28s */
const MISS_SHAKE_1 = 0.78
const MISS_SHAKE_2_AT = 1.88
const MISS_SHAKE_2 = 0.42

function missShake(p, t) {
  const windows = [
    {
      start: p.tauntStart,
      until: p.tauntUntil,
      cycles: p.tauntCycles || 4,
      amp: p.tauntAmp || 0.08,
    },
    {
      start: p.taunt2Start,
      until: p.taunt2Until,
      cycles: p.taunt2Cycles || 1,
      amp: (p.tauntAmp || 0.08) * 0.92,
    },
  ]
  for (const w of windows) {
    if (!(t < (w.until || 0) && t >= (w.start || 0))) continue
    const dur = Math.max(0.08, w.until - (w.start || t))
    const u = clamp((t - (w.start || t)) / dur, 0, 1)
    const env = Math.sin(u * Math.PI)
    return {
      x: Math.sin(u * w.cycles * Math.PI * 2) * w.amp * env,
    }
  }
  return null
}

export function teaseMiss(prizes, t, ringPos) {
  const live = prizes.filter((p) => !p.scored)
  if (!live.length) return []
  const ranked = ringPos
    ? [...live].sort((a, b) => (
      Math.hypot(a.curX - ringPos.x, a.curZ - ringPos.z)
      - Math.hypot(b.curX - ringPos.x, b.curZ - ringPos.z)
    ))
    : live
  const picked = []
  for (const p of ranked) {
    const near = ringPos && Math.hypot(p.curX - ringPos.x, p.curZ - ringPos.z) < 0.9
    const chance = p.kind === 'boss' ? 0.9 : near ? 0.7 : 0.32
    if (Math.random() < chance) picked.push(p)
    if (picked.length >= 3) break
  }
  if (!picked.length) picked.push(ranked[Math.floor(Math.random() * ranked.length)])
  for (const p of picked) {
    p.tauntStart = t
    p.tauntUntil = t + MISS_SHAKE_1
    p.tauntCycles = 3.5 + Math.random() * 1.4
    p.tauntAmp = (p.kind === 'boss' ? 0.11 : 0.075) + Math.random() * 0.02
    p.taunt2Start = t + MISS_SHAKE_2_AT
    p.taunt2Until = t + MISS_SHAKE_2_AT + MISS_SHAKE_2
    p.taunt2Cycles = 1
  }
  if (picked[0]) picked[0]._honkMiss = true
  return picked
}

export function syncPrizeKinematics(p) {
  if (!p.bodyRb || !p.neckRb) return
  p.bodyRb.setNextKinematicTranslation({ x: p.curX, y: p.bodyR * 0.8, z: p.curZ })
  const B = neckRoot(p)
  const H = p.head
  const d = sub(H, B)
  const L = Math.max(0.03, len(d))
  const q = quatFromUnitVectors({ x: 0, y: 1, z: 0 }, scale(d, 1 / L))
  p.neckRb.setNextKinematicTranslation({
    x: (B.x + H.x) / 2,
    y: (B.y + H.y) / 2,
    z: (B.z + H.z) / 2,
  })
  p.neckRb.setNextKinematicRotation(q)
}

export function prizeCatchInfo(p, pose, innerR = INNER_R, slack = 0) {
  if (!pose || p.scored) return { ok: false, why: 'dead' }
  const C = pose.t
  const n = pose.n
  const B = neckRoot(p)
  const hx = (B.x + p.head.x) / 2
  const hz = (B.z + p.head.z) / 2
  const dist = Math.hypot(C.x - hx, C.z - hz)
  const neckLo = B.y + p.neckLen * 0.12
  const neckHi = p.head.y - Math.max(0.01, p.neckR)
  const base = {
    kind: p.kind,
    y: round3(C.y),
    dist: round3(dist),
    ny: n ? round3(n.y) : null,
    neckLo: round3(neckLo),
    neckHi: round3(neckHi),
  }
  if (C.y < 0.008) return { ok: false, why: 'under', ...base }
  if (C.y > p.head.y + 0.06) return { ok: false, why: 'above-head', ...base }
  if (!n || Math.abs(n.y) < 0.28) return { ok: false, why: 'tilt', ...base }
  const hole = innerR + slack
  const through = dist + p.neckR * 1.1 < hole
  const fromGround = { x: B.x, y: 0.02, z: B.z }
  const seg = catchTest(
    C, n, fromGround, p.head,
    p.neckR * 0.7, hole, 0.22, 0.06, 0.05,
  )
  if (!through && !seg) return { ok: false, why: 'miss-neck', ...base }
  return { ok: true, why: C.y >= neckLo ? 'on-neck' : 'on-body', through, seg, ...base }
}

export function prizeCaught(p, pose, innerR = INNER_R, slack = 0) {
  return prizeCatchInfo(p, pose, innerR, slack).ok
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000
}

export function removePrizePhysics(world, p) {
  if (p.bodyRb) try { world.removeRigidBody(p.bodyRb) } catch { /* */ }
  if (p.neckRb) try { world.removeRigidBody(p.neckRb) } catch { /* */ }
  p.bodyRb = null
  p.neckRb = null
}

export { clamp, add }
