import { CHARGE_MS, SPEED_FLICK_MAX, SPEED_MIN, clamp } from './math.js'

export function createGesture({ canvas, onFlick, onAimStart, onAimMove, onAimRelease, onPower, onCursor }) {
  const pts = []
  let down = false
  let aim = false
  let powerT = 0
  let powering = false

  function isMouse(e) {
    const t = e.pointerType
    return t !== 'touch' && t !== 'pen'
  }

  function push(e) {
    pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    while (pts.length && performance.now() - pts[0].t > 140) pts.shift()
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    e.preventDefault()
    down = true
    pts.length = 0
    push(e)
    if (isMouse(e)) {
      aim = true
      powering = true
      powerT = performance.now()
      onAimStart?.(e)
    } else {
      aim = false
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    if (isMouse(e)) onCursor?.(e)
    if (!down) {
      if (isMouse(e)) onAimMove?.(e)
      return
    }
    push(e)
    if (aim) onAimMove?.(e)
  })

  function flickFrom() {
    const now = performance.now()
    const win = pts.filter((p) => now - p.t <= 140)
    if (win.length < 2) return { slip: true, speedPx: 0, up: 0, vx: 0, vy: 0 }
    const a = win[0]
    const b = win[win.length - 1]
    const dt = Math.max(16, b.t - a.t) / 1000
    const vx = (b.x - a.x) / dt
    const vy = (b.y - a.y) / dt
    const speedPx = Math.hypot(vx, vy)
    const up = a.y - b.y
    const slip = speedPx < 450 || up < 24
    return { slip, speedPx, up, vx, vy }
  }

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return
    down = false
    push(e)
    if (aim) {
      const power = powering ? Math.min(1, (performance.now() - powerT) / CHARGE_MS) : 0
      powering = false
      aim = false
      const flick = flickFrom()
      if (!flick.slip) {
        onFlick?.(flick)
        return
      }
      onAimRelease?.(e, power)
      return
    }
    const flick = flickFrom()
    onFlick?.(flick)
  })

  canvas.addEventListener('pointercancel', () => {
    down = false
    aim = false
    powering = false
  })

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !powering) {
      e.preventDefault()
      powering = true
      powerT = performance.now()
      onPower?.(0)
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return
    e.preventDefault()
    const power = powering ? Math.min(1, (performance.now() - powerT) / CHARGE_MS) : 0
    powering = false
    onAimRelease?.(null, power)
  })

  return {
    power() {
      if (!powering) return 0
      return Math.min(1, (performance.now() - powerT) / CHARGE_MS)
    },
  }
}

export function mapFlick(flick) {
  if (flick.slip) return { slip: true }
  const u = clamp((flick.speedPx - 450) / (1800 - 450), 0, 1)
  const speed = SPEED_MIN + u * (SPEED_FLICK_MAX - SPEED_MIN)
  const yaw = clamp(Math.atan2(flick.vx, -flick.vy) * 0.55, (-14 * Math.PI) / 180, (14 * Math.PI) / 180)
  const pitchT = clamp((flick.up - 60) / (400 - 60), 0, 1)
  const pitch = ((18 + pitchT * (40 - 18)) * Math.PI) / 180
  const roll = clamp(flick.vx / 1800, -1, 1) * ((20 * Math.PI) / 180)
  const spin = (6 + Math.random() * 8) * (flick.vx >= 0 ? 1 : -1)
  return { slip: false, speed, yaw, pitch, roll, spin }
}
