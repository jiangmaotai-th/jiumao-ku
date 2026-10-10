import {
  extensionFor,
  mimeFor,
  type WebOutputFormat,
} from '../formats'
import { loadBitmap, validateDecodedBitmap } from './decode'
import { encodeHeicBlob } from './heicEncode'
import { t } from '../../i18n'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function encodeBmp(imageData: ImageData): Blob {
  const { width, height, data } = imageData
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const fileSize = 54 + pixelBytes
  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  bytes[0] = 0x42
  bytes[1] = 0x4d
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, -height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelBytes, true)

  let offset = 54
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const alpha = data[i + 3] / 255
      const r = Math.round(data[i] * alpha + 255 * (1 - alpha))
      const g = Math.round(data[i + 1] * alpha + 255 * (1 - alpha))
      const b = Math.round(data[i + 2] * alpha + 255 * (1 - alpha))
      bytes[offset++] = b
      bytes[offset++] = g
      bytes[offset++] = r
    }
    offset += rowSize - width * 3
  }

  return new Blob([buffer], { type: 'image/bmp' })
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: WebOutputFormat,
  quality: number,
): Promise<Blob> {
  if (format === 'BMP') {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to read canvas pixels')
    return encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height))
  }

  if (format === 'HEIC') {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to read canvas pixels')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const blob = await encodeHeicBlob(imageData, quality)
    if (!blob.size) throw new Error('Empty HEIC encode result')
    return blob
  }

  const mime = mimeFor(format)
  const q = format === 'PNG' ? undefined : quality / 100
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mime, q)
  })

  if (!blob || blob.size === 0) {
    throw new Error(`Browser cannot encode ${format}`)
  }
  return blob
}

function drawBitmap(
  bitmap: ImageBitmap,
  scale: number,
  flattenWhite: boolean,
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create canvas')

  if (flattenWhite) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

/** Draw into a fixed frame (ID photo). cover = center-crop; contain = letterbox. */
function drawBitmapToSize(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  fit: 'cover' | 'contain',
  flattenWhite: boolean,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create canvas')

  if (flattenWhite || fit === 'contain') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }

  const scale =
    fit === 'cover'
      ? Math.max(w / bitmap.width, h / bitmap.height)
      : Math.min(w / bitmap.width, h / bitmap.height)
  const dw = bitmap.width * scale
  const dh = bitmap.height * scale
  const dx = (w - dw) / 2
  const dy = (h - dh) / 2
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, dx, dy, dw, dh)
  return canvas
}

export interface ConvertOptions {
  format: WebOutputFormat
  quality: number
  minQuality: number
  targetBytes: number
  allowResize: boolean
  suffix: string
  /** Fixed output pixel size (e.g. 1-inch / 2-inch ID photo). */
  outputWidth?: number
  outputHeight?: number
  fit?: 'cover' | 'contain'
  /** Quality step for the ladder (default 5; use 2 for extreme KB targets). */
  qualityStep?: number
  onPhase?: (phase: 'converting' | 'compressing', progress: number) => void
}

export interface ConvertedFile {
  blob: Blob
  filename: string
  size: number
  width: number
  height: number
  warning?: string
}

export interface PreviewEstimate {
  size: number
  warning?: string
}

function outputName(inputName: string, suffix: string, format: WebOutputFormat): string {
  const base = inputName.split(/[\\/]/).pop() || inputName
  const stem = base.replace(/\.[^.]+$/, '') || 'converted'
  return `${stem}${suffix}.${extensionFor(format)}`
}

async function validateOutputBlob(
  blob: Blob,
  width: number,
  height: number,
): Promise<void> {
  if (!blob || blob.size === 0) {
    throw new Error('Output file size is 0')
  }
  if (width === 0 || height === 0) {
    throw new Error('Invalid output image dimensions')
  }

  // HEIC may not decode via createImageBitmap in all browsers; size/dims already checked.
  if (blob.type === 'image/heic' || blob.type === 'image/heif') {
    return
  }

  try {
    const bitmap = await createImageBitmap(blob)
    try {
      await validateDecodedBitmap(bitmap)
    } finally {
      bitmap.close()
    }
  } catch {
    // Some browsers cannot re-decode WebP/BMP variants; keep size/dim gates.
  }
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  options: ConvertOptions,
  quality: number,
  filename: string,
): Promise<ConvertedFile> {
  const blob = await canvasToBlob(canvas, options.format, quality)
  await validateOutputBlob(blob, canvas.width, canvas.height)
  return {
    blob,
    filename,
    size: blob.size,
    width: canvas.width,
    height: canvas.height,
  }
}

async function encodeAtScale(
  bitmap: ImageBitmap,
  options: ConvertOptions,
  scale: number,
  quality: number,
): Promise<ConvertedFile> {
  const flattenWhite =
    options.format === 'JPEG' || options.format === 'BMP' || options.format === 'HEIC'
  const canvas = drawBitmap(bitmap, scale, flattenWhite)
  try {
    return await encodeCanvas(canvas, options, quality, outputName('image', options.suffix, options.format))
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

async function encodeAtFixedSize(
  bitmap: ImageBitmap,
  options: ConvertOptions,
  width: number,
  height: number,
  quality: number,
): Promise<ConvertedFile> {
  const flattenWhite =
    options.format === 'JPEG' || options.format === 'BMP' || options.format === 'HEIC'
  const fit = options.fit ?? 'cover'
  const canvas = drawBitmapToSize(bitmap, width, height, fit, flattenWhite)
  try {
    return await encodeCanvas(canvas, options, quality, outputName('image', options.suffix, options.format))
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Find the highest quality whose encoded size is ≤ target (prefer clarity, stay under budget).
 * Returns the best under-target file, plus the overall smallest attempt (for fallback warnings).
 */
async function fitQualityUnderTarget(
  encode: (quality: number) => Promise<ConvertedFile>,
  minQuality: number,
  maxQuality: number,
  target: number,
): Promise<{ bestUnder: ConvertedFile | null; smallest: ConvertedFile }> {
  const floor = Math.max(1, Math.min(100, minQuality))
  const ceiling = Math.max(floor, Math.min(100, maxQuality))

  const atMax = await encode(ceiling)
  let smallest = atMax
  if (atMax.size <= target) {
    // Already under budget at max quality — keep clarity, do not crush further.
    return { bestUnder: atMax, smallest: atMax }
  }

  const atMin = await encode(floor)
  if (atMin.size < smallest.size) smallest = atMin
  if (atMin.size > target) {
    return { bestUnder: null, smallest }
  }

  // Binary search highest quality that still fits under target.
  let lo = floor
  let hi = ceiling
  let bestUnder = atMin
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = await encode(mid)
    if (candidate.size < smallest.size) smallest = candidate
    if (candidate.size <= target) {
      bestUnder = candidate
      lo = mid
    } else {
      hi = mid
    }
  }
  return { bestUnder, smallest }
}

/**
 * Encode under a byte budget while maximizing quality (clarity first).
 * Fixed output size (ID photo) uses the same strategy; resize only if min quality still overflows.
 */
export async function convertImageFile(
  file: File,
  options: ConvertOptions,
): Promise<ConvertedFile> {
  if (file.size === 0) throw new Error('Input file size is 0')

  const bitmap = await loadBitmap(file)
  try {
    await validateDecodedBitmap(bitmap)
    options.onPhase?.('converting', 28)

    // Keep nearly the full budget so results sit close to the user-set size.
    const target = Math.max(1, Math.round(options.targetBytes * 0.99))
    const filename = outputName(file.name, options.suffix, options.format)
    const lossy = options.format === 'JPEG' || options.format === 'WEBP' || options.format === 'HEIC'
    const minQuality = lossy ? options.minQuality : 100
    const maxQuality = lossy ? Math.max(minQuality, options.quality) : 100

    const fixedW = options.outputWidth
    const fixedH = options.outputHeight
    const useFixed =
      typeof fixedW === 'number' &&
      typeof fixedH === 'number' &&
      fixedW > 0 &&
      fixedH > 0

    const encodeAt = async (quality: number) => {
      const candidate = useFixed
        ? await encodeAtFixedSize(bitmap, options, fixedW!, fixedH!, quality)
        : await encodeAtScale(bitmap, options, 1, quality)
      candidate.filename = filename
      return candidate
    }

    if (!lossy) {
      const only = await encodeAt(100)
      options.onPhase?.('compressing', 90)
      if (only.size <= target) return only
      if (options.allowResize && !useFixed) {
        let best = only
        for (const percent of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
          const candidate = await encodeAtScale(bitmap, options, percent / 100, 100)
          candidate.filename = filename
          if (candidate.size < best.size) best = candidate
          if (candidate.size <= target) {
            options.onPhase?.('compressing', 92)
            return candidate
          }
        }
        return { ...best, warning: t('image.warnLosslessOverTarget') }
      }
      return { ...only, warning: t('image.warnLosslessOverTarget') }
    }

    options.onPhase?.('compressing', 55)
    const fittedFull = await fitQualityUnderTarget(encodeAt, minQuality, maxQuality, target)
    if (fittedFull.bestUnder) {
      options.onPhase?.('compressing', 90)
      return fittedFull.bestUnder
    }

    options.onPhase?.('compressing', 72)
    let fallback = fittedFull.smallest

    // Still over at min quality: shrink as last resort (ID photo keeps aspect of the frame).
    if (options.allowResize) {
      if (useFixed) {
        const aspect = fixedW! / fixedH!
        for (const percent of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40]) {
          const w = Math.max(32, Math.round((fixedW! * percent) / 100))
          const h = Math.max(32, Math.round(w / aspect))
          const { bestUnder: fitted, smallest: localSmall } = await fitQualityUnderTarget(
            async (q) => {
              const candidate = await encodeAtFixedSize(bitmap, options, w, h, q)
              candidate.filename = filename
              return candidate
            },
            minQuality,
            maxQuality,
            target,
          )
          if (localSmall.size < fallback.size) fallback = localSmall
          if (fitted) {
            options.onPhase?.('compressing', 92)
            return fitted
          }
        }
      } else {
        for (const percent of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
          const { bestUnder: fitted, smallest: localSmall } = await fitQualityUnderTarget(
            async (q) => {
              const candidate = await encodeAtScale(bitmap, options, percent / 100, q)
              candidate.filename = filename
              return candidate
            },
            minQuality,
            maxQuality,
            target,
          )
          if (localSmall.size < fallback.size) fallback = localSmall
          if (fitted) {
            options.onPhase?.('compressing', 92)
            return fitted
          }
        }
      }
    }

    options.onPhase?.('compressing', 95)
    return {
      ...fallback,
      warning: t('image.warnStillOverTarget'),
    }
  } finally {
    bitmap.close()
  }
}

export async function previewImageSize(
  file: File,
  options: ConvertOptions,
): Promise<PreviewEstimate> {
  try {
    // Same pipeline as real convert so preview matches final size/clarity tradeoff.
    const result = await convertImageFile(file, {
      ...options,
      onPhase: undefined,
    })
    return {
      size: result.size,
      warning: result.warning
        ? t('image.warnEstimateOverTarget')
        : undefined,
    }
  } catch {
    return {
      size: 0,
      warning: t('image.warnEstimateOverTarget'),
    }
  }
}

export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldCancel: () => boolean,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function runWorker() {
    while (true) {
      if (shouldCancel()) return
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  const count = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: count }, () => runWorker()))
  return results
}
