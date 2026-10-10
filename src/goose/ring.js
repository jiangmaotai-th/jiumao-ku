import RAPIER from '@dimforge/rapier3d-compat'
import {
  DT,
  INNER_R,
  RING_MASS,
  RING_RADIUS,
  SEGMENTS,
  TUBE_R,
  add,
  clamp,
  cross,
  dot,
  len,
  quatFromEuler,
  quatFromUnitVectors,
  rotate,
  scale,
} from './math.js'

const Combine = RAPIER.CoefficientCombineRule

export function createRing(world, origin, rot, spec = {}) {
  const radius = spec.radius || RING_RADIUS
  const tube = spec.tube || TUBE_R
  const m = RING_MASS
  const R2 = radius * radius
  const halfH = radius * Math.sin(Math.PI / SEGMENTS) * 0.98
  const rest = spec.sticky ? 0.03 : 0.08
  const fric = spec.sticky ? 0.82 : 0.48
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setCcdEnabled(true)
      .setSoftCcdPrediction(0.24)
      .setAdditionalSolverIterations(6)
      .setTranslation(origin.x, origin.y, origin.z)
      .setRotation(rot)
      .setLinearDamping(spec.sticky ? 0.08 : 0.03)
      .setAngularDamping(0.16)
      .setAdditionalMassProperties(
        m,
        { x: 0, y: 0, z: 0 },
        { x: 0.62 * m * R2, y: m * R2, z: 0.62 * m * R2 },
        { x: 0, y: 0, z: 0, w: 1 },
      ),
  )
  const handles = []
  for (let i = 0; i < SEGMENTS; i++) {
    const th = (i / SEGMENTS) * Math.PI * 2
    const pos = { x: Math.cos(th) * radius, y: 0, z: Math.sin(th) * radius }
    const tangent = { x: -Math.sin(th), y: 0, z: Math.cos(th) }
    const q = quatFromUnitVectors({ x: 0, y: 1, z: 0 }, tangent)
    const col = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfH, tube)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation(q)
        .setDensity(0)
        .setFriction(fric)
        .setRestitution(rest)
        .setFrictionCombineRule(Combine.Average)
        .setRestitutionCombineRule(Combine.Min)
        .setContactSkin(0.0016)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    handles.push(col.handle)
  }
  return {
    body,
    handles,
    radius,
    tube,
    innerR: radius - tube,
    collected: false,
    scored: false,
    born: performance.now(),
    still: 0,
    lastSpeed: 0,
    touchGoose: false,
    gooseHits: 0,
    trail: [],
  }
}

export function applyAero(ring, dt, windX = 0) {
  if (!ring?.body || ring.collected) return
  const v = ring.body.linvel()
  const sp = Math.hypot(v.x, v.y, v.z)
  ring.lastSpeed = sp
  ring.body.applyImpulse({ x: -v.x * 0.03 * sp * dt, y: -v.y * 0.03 * sp * dt, z: -v.z * 0.03 * sp * dt }, true)
  if (windX) ring.body.applyImpulse({ x: windX * RING_MASS * dt, y: 0, z: 0 }, true)
  const rot = ring.body.rotation()
  const n = rotate(rot, { x: 0, y: 1, z: 0 })
  const w = ring.body.angvel()
  const spin = dot(w, n)
  const settle = ring.touchGoose ? 0.12 : clamp(sp / 3.4, 0.22, 1)
  const stab = Math.min(1, Math.abs(spin) / 8) * 2.2 * dt * RING_MASS * settle
  const residual = {
    x: w.x - spin * n.x,
    y: (w.y - spin * n.y) * 0.2,
    z: w.z - spin * n.z,
  }
  ring.body.applyTorqueImpulse({ x: -residual.x * stab, y: -residual.y * stab, z: -residual.z * stab }, true)
  try { ring.body.setAngularDamping(ring.touchGoose ? 0.55 : 0.16) } catch { /* */ }
  try { ring.body.setLinearDamping(ring.touchGoose ? 0.42 : 0.03) } catch { /* */ }
}

export function ringPose(ring) {
  if (!ring?.body || ring.collected) return null
  const t = ring.body.translation()
  const r = ring.body.rotation()
  return { t, r, n: rotate(r, { x: 0, y: 1, z: 0 }) }
}

export function ringStill(ring) {
  if (!ring?.body || ring.collected) return false
  const v = ring.body.linvel()
  const w = ring.body.angvel()
  const lim = ring.touchGoose ? 0.22 : 0.08
  const wlim = ring.touchGoose ? 1.1 : 0.35
  return Math.hypot(v.x, v.y, v.z) < lim && Math.hypot(w.x, w.y, w.z) < wlim
}

export function ringOut(ring) {
  if (!ring?.body || ring.collected) return true
  const t = ring.body.translation()
  if (Math.abs(t.x) > 8 || t.y < -1 || t.z < -2 || t.z > 8) return true
  if (ring.touchGoose && t.y > -0.2) return false
  if ((Math.abs(t.x) > 1.15 || t.z < 1.05 || t.z > 3.9) && t.y < 0.25) return true
  return false
}

export function launchRing(ring, origin, yaw, pitch, speed, spin, roll) {
  const rot = quatFromEuler(-0.35, yaw, roll)
  ring.body.setTranslation(origin, true)
  ring.body.setRotation(rot, true)
  const dir = {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  }
  ring.body.setLinvel({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, true)
  const n = rotate(rot, { x: 0, y: 1, z: 0 })
  ring.body.setAngvel(scale(n, spin), true)
}

export function holdRing(ring, pos, pull = 0) {
  if (!ring?.body || ring.collected) return
  ring.body.setTranslation(pos, true)
  ring.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ring.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  const rot = quatFromEuler(-1.05 - pull * 0.35, 0, 0)
  ring.body.setRotation(rot, true)
}

export function removeRing(world, ring) {
  if (!ring || ring.collected) return
  ring.collected = true
  try { world.removeRigidBody(ring.body) } catch { /* already gone */ }
  ring.body = null
}

export function tameGooseBounce(ring) {
  if (!ring?.body || ring.collected || !ring.touchGoose) return
  const v = ring.body.linvel()
  const sp = Math.hypot(v.x, v.y, v.z)
  const cap = 3.15
  if (sp > cap) {
    const s = cap / sp
    ring.body.setLinvel({
      x: v.x * s,
      y: Math.min(v.y, 1.6) * (v.y > 0 ? s : 1),
      z: v.z * s,
    }, true)
  } else if (v.y > 2.1) {
    ring.body.setLinvel({ x: v.x, y: 2.1, z: v.z }, true)
  }
}

export function catchTest(center, n, a, b, allowR, innerR, minDenom = 0.2, sPad = 0.03, ePad = 0.05) {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const L = len(u)
  if (L < 1e-4) return false
  const dir = scale(u, 1 / L)
  const denom = dot(dir, n)
  if (Math.abs(denom) < minDenom) return false
  const s = dot({ x: center.x - a.x, y: center.y - a.y, z: center.z - a.z }, n) / denom
  if (s < -sPad || s > L + ePad) return false
  const X = add(a, scale(dir, s))
  const d = len({ x: X.x - center.x, y: X.y - center.y, z: X.z - center.z })
  return d < innerR - allowR
}

export { INNER_R, clamp, cross }
