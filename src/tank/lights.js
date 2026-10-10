import { lightById } from './data.js'

function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
}

export function drawTankLight(ctx, w, h, now, lightId) {
  const spec = lightById(lightId)
  if (!spec) return

  if (spec.dark) {
    ctx.fillStyle = `rgba(4,10,22,${spec.dark})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.save()
  ctx.globalCompositeOperation = spec.tintMode || 'multiply'
  ctx.fillStyle = rgba(spec.tint, spec.tintA)
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  if (spec.id === 'plant') {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(255,90,170,0.08)'
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
}
