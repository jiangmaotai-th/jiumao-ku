export const DT = 1 / 120
export const GRAVITY = 9.81
export const RING_MASS = 0.06
export const RING_RADIUS = 0.15
export const TUBE_R = 0.013
export const INNER_R = RING_RADIUS - TUBE_R
export const SEGMENTS = 22
export const RING_DIFF = {
  easy: { id: 'easy', radius: 0.155, tube: 0.0062 },
  normal: { id: 'normal', radius: 0.15, tube: 0.013 },
  hard: { id: 'hard', radius: 0.108, tube: 0.012 },
}

export function innerOf(spec) {
  return (spec?.radius || RING_RADIUS) - (spec?.tube || TUBE_R)
}
export const CHARGE_MS = 1400
export const SPEED_MIN = 2.2
export const SPEED_FLICK_MAX = 9.0
export const SPEED_MAX = 9.5
export const SPEED_SEARCH_LO = 1.2
export const AIM_CLAMP_X = 1.0
export const AIM_CLAMP_Z0 = 1.25
export const AIM_CLAMP_Z1 = 3.72

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function easeOutCubic(t) {
  const u = 1 - t
  return 1 - u * u * u
}

export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z }
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s }
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function len(a) {
  return Math.hypot(a.x, a.y, a.z)
}

export function normalize(a) {
  const l = len(a) || 1
  return scale(a, 1 / l)
}

export function quatId() {
  return { x: 0, y: 0, z: 0, w: 1 }
}

export function quatNorm(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }
}

export function quatMul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  }
}

export function quatFromAxisAngle(axis, ang) {
  const n = normalize(axis)
  const s = Math.sin(ang / 2)
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(ang / 2) }
}

export function quatFromEuler(pitch, yaw, roll) {
  return quatMul(quatMul(quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yaw), quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch)), quatFromAxisAngle({ x: 0, y: 0, z: 1 }, roll))
}

export function rotate(q, v) {
  const qv = { x: q.x, y: q.y, z: q.z }
  const t = scale(cross(qv, v), 2)
  return add(add(v, scale(t, q.w)), cross(qv, t))
}

export function quatFromUnitVectors(from, to) {
  const vFrom = normalize(from)
  const vTo = normalize(to)
  let r = dot(vFrom, vTo) + 1
  let q
  if (r < 1e-8) {
    if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) q = { x: -vFrom.y, y: vFrom.x, z: 0, w: 0 }
    else q = { x: 0, y: -vFrom.z, z: vFrom.y, w: 0 }
  } else {
    q = {
      x: vFrom.y * vTo.z - vFrom.z * vTo.y,
      y: vFrom.z * vTo.x - vFrom.x * vTo.z,
      z: vFrom.x * vTo.y - vFrom.y * vTo.x,
      w: r,
    }
  }
  return quatNorm(q)
}

export function cameraBasis(pos, target) {
  const zaxis = normalize(sub(pos, target))
  const xaxis = normalize(cross({ x: 0, y: 1, z: 0 }, zaxis))
  const yaxis = cross(zaxis, xaxis)
  return { xaxis, yaxis, zaxis }
}

export function project(p, cam) {
  const v = sub(p, cam.pos)
  const zc = dot(v, cam.zaxis)
  if (zc >= -0.02) return { x: cam.cx, y: cam.cy, s: 0, zc, vis: false }
  const focal = cam.h / 2 / Math.tan(cam.fov * 0.5)
  const s = focal / -zc
  return {
    x: cam.cx + dot(v, cam.xaxis) * s,
    y: cam.cy - dot(v, cam.yaxis) * s,
    s,
    zc,
    vis: true,
  }
}

export function unprojectToY0(sx, sy, cam) {
  const focal = cam.h / 2 / Math.tan(cam.fov * 0.5)
  const xcam = (sx - cam.cx) / focal
  const ycam = -(sy - cam.cy) / focal
  const dir = {
    x: cam.xaxis.x * xcam + cam.yaxis.x * ycam - cam.zaxis.x,
    y: cam.xaxis.y * xcam + cam.yaxis.y * ycam - cam.zaxis.y,
    z: cam.xaxis.z * xcam + cam.yaxis.z * ycam - cam.zaxis.z,
  }
  if (dir.y >= -0.02) return null
  const t = -cam.pos.y / dir.y
  return add(cam.pos, scale(dir, t))
}

export function aimPointFromHit(g) {
  const p = g || { x: 0, z: 2.4 }
  return {
    x: clamp(p.x, -AIM_CLAMP_X, AIM_CLAMP_X),
    z: clamp(p.z, AIM_CLAMP_Z0, AIM_CLAMP_Z1),
  }
}

export function predictLanding(origin, yaw, pitch, speed) {
  let pos = { ...origin }
  let v = {
    x: -Math.sin(yaw) * Math.cos(pitch) * speed,
    y: Math.sin(pitch) * speed,
    z: Math.cos(yaw) * Math.cos(pitch) * speed,
  }
  for (let i = 0; i < 720; i++) {
    const sp = len(v)
    v = {
      x: v.x - v.x * 0.03 * sp * DT / RING_MASS,
      y: v.y - v.y * 0.03 * sp * DT / RING_MASS - GRAVITY * DT,
      z: v.z - v.z * 0.03 * sp * DT / RING_MASS,
    }
    pos = add(pos, scale(v, DT))
    if (pos.y <= 0.02) return pos
  }
  return pos
}

export function chargeSpeed(need, power) {
  return Math.min(SPEED_MAX, need * (0.6 + power * 0.7))
}

export function requiredSpeed(origin, aim, pitch, yaw) {
  const target = Math.hypot(aim.x - origin.x, aim.z - origin.z)
  let lo = SPEED_SEARCH_LO
  let hi = SPEED_MAX
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const land = predictLanding(origin, yaw, pitch, mid)
    const d = Math.hypot(land.x - origin.x, land.z - origin.z)
    if (d < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
