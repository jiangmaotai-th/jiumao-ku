import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as REPointerEvent,
} from 'react'
import type { CropRect } from './presets'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_NORM = 0.08

function clampRect(r: CropRect): CropRect {
  let { x, y, w, h } = r
  w = Math.max(MIN_NORM, Math.min(1, w))
  h = Math.max(MIN_NORM, Math.min(1, h))
  x = Math.max(0, Math.min(1 - w, x))
  y = Math.max(0, Math.min(1 - h, y))
  return { x, y, w, h }
}

/** lockAspect is pixel aspect (outW/outH). videoAR = videoW/videoH. */
function enforceAspect(r: CropRect, lockAspect: number | null, videoAR: number): CropRect {
  if (!lockAspect || lockAspect <= 0 || !videoAR) return clampRect(r)
  const targetNorm = lockAspect / videoAR
  let { x, y, w, h } = r
  const cx = x + w / 2
  const cy = y + h / 2
  if (w / h > targetNorm) w = h * targetNorm
  else h = w / targetNorm
  if (w > 1) {
    w = 1
    h = w / targetNorm
  }
  if (h > 1) {
    h = 1
    w = h * targetNorm
  }
  w = Math.max(MIN_NORM, w)
  h = Math.max(MIN_NORM, h)
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h })
}

function contentBox(
  stageW: number,
  stageH: number,
  videoAR: number,
): { left: number; top: number; width: number; height: number } {
  if (!stageW || !stageH || !videoAR) {
    return { left: 0, top: 0, width: stageW, height: stageH }
  }
  const stageAR = stageW / stageH
  if (stageAR > videoAR) {
    const width = stageH * videoAR
    return { left: (stageW - width) / 2, top: 0, width, height: stageH }
  }
  const height = stageW / videoAR
  return { left: 0, top: (stageH - height) / 2, width: stageW, height }
}

export function CropStage({
  src,
  crop,
  onCropChange,
  lockAspect,
  videoWidth,
  videoHeight,
  emptyLabel,
  emptyHint,
  onPickFile,
}: {
  src: string | null
  crop: CropRect
  onCropChange: (next: CropRect) => void
  lockAspect: number | null
  videoWidth: number
  videoHeight: number
  emptyLabel: string
  emptyHint: string
  onPickFile: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const dragRef = useRef<{
    handle: Handle
    startX: number
    startY: number
    origin: CropRect
  } | null>(null)

  const videoAR = videoWidth && videoHeight ? videoWidth / videoHeight : 16 / 9

  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    setBox(contentBox(rect.width, rect.height, videoAR))
  }, [videoAR])

  useLayoutEffect(() => {
    measure()
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [measure, src])

  const clientToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current
      if (!stage || !box.width || !box.height) return { x: 0, y: 0 }
      const rect = stage.getBoundingClientRect()
      const nx = (clientX - rect.left - box.left) / box.width
      const ny = (clientY - rect.top - box.top) / box.height
      return { x: nx, y: ny }
    },
    [box],
  )

  const onPointerDown = (handle: Handle) => (e: REPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const p = clientToNorm(e.clientX, e.clientY)
    dragRef.current = {
      handle,
      startX: p.x,
      startY: p.y,
      origin: { ...crop },
    }
  }

  const onPointerMove = (e: REPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const p = clientToNorm(e.clientX, e.clientY)
    const dx = p.x - drag.startX
    const dy = p.y - drag.startY
    const o = drag.origin
    let next: CropRect

    if (drag.handle === 'move') {
      next = { x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }
    } else {
      let x = o.x
      let y = o.y
      let w = o.w
      let h = o.h
      if (drag.handle.includes('e')) w = o.w + dx
      if (drag.handle.includes('w')) {
        x = o.x + dx
        w = o.w - dx
      }
      if (drag.handle.includes('s')) h = o.h + dy
      if (drag.handle.includes('n')) {
        y = o.y + dy
        h = o.h - dy
      }
      if (w < MIN_NORM) {
        if (drag.handle.includes('w')) x = o.x + o.w - MIN_NORM
        w = MIN_NORM
      }
      if (h < MIN_NORM) {
        if (drag.handle.includes('n')) y = o.y + o.h - MIN_NORM
        h = MIN_NORM
      }
      next = { x, y, w, h }
    }
    onCropChange(enforceAspect(next, lockAspect, videoAR))
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [src])

  if (!src) {
    return (
      <div
        className="crop-empty"
        role="button"
        tabIndex={0}
        onClick={onPickFile}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPickFile()
          }
        }}
      >
        <strong>{emptyLabel}</strong>
        <span>{emptyHint}</span>
      </div>
    )
  }

  const layerStyle = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  } as CSSProperties

  return (
    <div className="crop-stage-wrap">
      <div
        ref={stageRef}
        className="crop-stage"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <video
          ref={videoRef}
          className="crop-video"
          src={src}
          playsInline
          preload="metadata"
        />
        <div className="crop-layer" style={layerStyle}>
          <div
            className="crop-shade"
            style={
              {
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${crop.x * 100}% ${crop.y * 100}%,
                  ${crop.x * 100}% ${(crop.y + crop.h) * 100}%,
                  ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%,
                  ${(crop.x + crop.w) * 100}% ${crop.y * 100}%,
                  ${crop.x * 100}% ${crop.y * 100}%
                )`,
              } as CSSProperties
            }
          />
          <div
            className="crop-box"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
            }}
            onPointerDown={onPointerDown('move')}
          >
            <div className="crop-grid" aria-hidden="true" />
            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Handle[]).map((h) => (
              <span
                key={h}
                className={`crop-handle crop-handle-${h}`}
                onPointerDown={onPointerDown(h)}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="crop-play"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            const v = videoRef.current
            if (!v) return
            if (v.paused) void v.play()
            else v.pause()
          }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
      </div>
    </div>
  )
}
