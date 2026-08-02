import {
  extensionFor,
  mimeFor,
  type WebOutputFormat,
} from '../formats'
import { loadBitmap, validateDecodedBitmap } from './decode'
import { encodeHeicBlob } from './heicEncode'

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
    if (!ctx) throw new Error('无法读取画布像素')
    return encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height))
  }

  if (format === 'HEIC') {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法读取画布像素')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const blob = await encodeHeicBlob(imageData, quality)
    if (!blob.size) throw new Error('HEIC 编码结果为空')
    return blob
  }

  const mime = mimeFor(format)
  const q = format === 'PNG' ? undefined : quality / 100
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mime, q)
  })

  if (!blob || blob.size === 0) {
    throw new Error(`浏览器无法编码为 ${format}`)
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
  if (!ctx) throw new Error('无法创建画布')

  if (flattenWhite) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

export interface ConvertOptions {
  format: WebOutputFormat
  quality: number
  minQuality: number
  targetBytes: number
  allowResize: boolean
  suffix: string
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

function compressionTargetBytes(targetBytes: number): number {
  return Math.max(1, Math.round(targetBytes * 0.95))
}

function qualitySteps(start: number, min: number): number[] {
  const steps: number[] = []
  let q = Math.min(100, Math.max(1, start))
  const floor = Math.min(q, Math.max(1, min))
  while (q >= floor) {
    steps.push(q)
    if (q === floor) break
    q = Math.max(floor, q - 5)
  }
  return steps
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
    throw new Error('输出文件大小为 0')
  }
  if (width === 0 || height === 0) {
    throw new Error('输出图片宽高异常')
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
    const blob = await canvasToBlob(canvas, options.format, quality)
    await validateOutputBlob(blob, canvas.width, canvas.height)
    return {
      blob,
      filename: outputName('image', options.suffix, options.format),
      size: blob.size,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Match desktop order: quality ladder at full size, then optional resize ladder at min quality.
 */
export async function convertImageFile(
  file: File,
  options: ConvertOptions,
): Promise<ConvertedFile> {
  if (file.size === 0) throw new Error('输入文件大小为 0')

  const bitmap = await loadBitmap(file)
  try {
    await validateDecodedBitmap(bitmap)
    options.onPhase?.('converting', 28)

    const target = compressionTargetBytes(options.targetBytes)
    const filename = outputName(file.name, options.suffix, options.format)
    const lossy = options.format === 'JPEG' || options.format === 'WEBP' || options.format === 'HEIC'
    const qualities = lossy ? qualitySteps(options.quality, options.minQuality) : [100]
    let best: ConvertedFile | null = null

    for (const quality of qualities) {
      const candidate = await encodeAtScale(bitmap, options, 1, quality)
      candidate.filename = filename
      if (!best || candidate.size < best.size) best = candidate
      if (candidate.size <= target) {
        options.onPhase?.('compressing', 90)
        return candidate
      }
    }

    options.onPhase?.('compressing', 72)

    if (options.allowResize) {
      const minQuality = lossy ? options.minQuality : 100
      for (const percent of [95, 90, 85, 80, 75, 70, 65, 60, 55, 50]) {
        const candidate = await encodeAtScale(bitmap, options, percent / 100, minQuality)
        candidate.filename = filename
        if (!best || candidate.size < best.size) best = candidate
        if (candidate.size <= target) {
          options.onPhase?.('compressing', 92)
          return candidate
        }
      }
    }

    if (!best) throw new Error('转换失败：未生成文件')
    options.onPhase?.('compressing', 95)
    return {
      ...best,
      warning: lossy
        ? '已降到最低质量仍超过目标大小；请允许缩小图片尺寸或提高目标大小'
        : '无损格式超过目标大小；请允许缩小图片尺寸、提高目标大小，或改用有损格式',
    }
  } finally {
    bitmap.close()
  }
}

export async function previewImageSize(
  file: File,
  options: ConvertOptions,
): Promise<PreviewEstimate> {
  const bitmap = await loadBitmap(file)
  try {
    await validateDecodedBitmap(bitmap)
    const target = compressionTargetBytes(options.targetBytes)
    const lossy = options.format === 'JPEG' || options.format === 'WEBP' || options.format === 'HEIC'
    const quality = lossy ? options.quality : 100
    const first = await encodeAtScale(bitmap, options, 1, quality)
    if (first.size <= target) {
      return { size: first.size }
    }

    if (options.allowResize) {
      for (const percent of [90, 80, 70, 60, 50]) {
        const resized = await encodeAtScale(
          bitmap,
          options,
          percent / 100,
          lossy ? options.minQuality : 100,
        )
        if (resized.size <= target) {
          return { size: resized.size }
        }
      }
    }

    return {
      size: first.size,
      warning: '预估仍超目标；可降低质量或勾选允许缩小尺寸',
    }
  } finally {
    bitmap.close()
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
