import heic2any from 'heic2any'
import UTIF from 'utif'

import { detectInputFormat } from '../formats'

async function bitmapFromImageData(imageData: ImageData): Promise<ImageBitmap> {
  if (imageData.width === 0 || imageData.height === 0) {
    throw new Error('图片宽高异常')
  }
  return createImageBitmap(imageData)
}

async function decodeHeic(file: File): Promise<ImageBitmap> {
  const converted = await heic2any({
    blob: file,
    toType: 'image/png',
    quality: 1,
  })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob || blob.size === 0) {
    throw new Error('HEIC 解码结果为空')
  }
  return createImageBitmap(blob)
}

async function decodeTiff(file: File): Promise<ImageBitmap> {
  const buffer = await file.arrayBuffer()
  const ifds = UTIF.decode(buffer)
  if (!ifds.length) {
    throw new Error('TIFF 无可用页面')
  }
  UTIF.decodeImage(buffer, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const width = ifds[0].width as number
  const height = ifds[0].height as number
  if (!width || !height || !rgba?.length) {
    throw new Error('TIFF 宽高异常')
  }
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height)
  return bitmapFromImageData(imageData)
}

async function decodeNative(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('浏览器无法解码该图片'))
        img.src = url
      })
      return await createImageBitmap(image)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (file.size === 0) {
    throw new Error('输入文件大小为 0')
  }

  const format = detectInputFormat(file.name)

  if (format === 'HEIC') {
    try {
      return await decodeNative(file)
    } catch {
      return decodeHeic(file)
    }
  }

  if (format === 'TIFF') {
    return decodeTiff(file)
  }

  return decodeNative(file)
}

export async function validateDecodedBitmap(bitmap: ImageBitmap): Promise<void> {
  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close()
    throw new Error('输出图片宽高异常')
  }
}
