export type WebOutputFormat = 'JPEG' | 'PNG' | 'WEBP' | 'BMP' | 'HEIC'
export type WebInputFormat = 'JPEG' | 'PNG' | 'WEBP' | 'BMP' | 'HEIC' | 'TIFF'

export const WEB_OUTPUT_FORMATS: WebOutputFormat[] = ['JPEG', 'PNG', 'WEBP', 'BMP', 'HEIC']

export const LOSSY_OUTPUT_FORMATS: WebOutputFormat[] = ['JPEG', 'WEBP', 'HEIC']

export function isLossyOutputFormat(format: WebOutputFormat): boolean {
  return LOSSY_OUTPUT_FORMATS.includes(format)
}

export function extensionFor(format: WebOutputFormat): string {
  switch (format) {
    case 'JPEG':
      return 'jpg'
    case 'PNG':
      return 'png'
    case 'WEBP':
      return 'webp'
    case 'BMP':
      return 'bmp'
    case 'HEIC':
      return 'heic'
  }
}

export function mimeFor(format: WebOutputFormat): string {
  switch (format) {
    case 'JPEG':
      return 'image/jpeg'
    case 'PNG':
      return 'image/png'
    case 'WEBP':
      return 'image/webp'
    case 'BMP':
      return 'image/bmp'
    case 'HEIC':
      return 'image/heic'
  }
}

export function detectInputFormat(name: string): WebInputFormat | null {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'JPEG'
    case 'png':
      return 'PNG'
    case 'webp':
      return 'WEBP'
    case 'bmp':
      return 'BMP'
    case 'heic':
    case 'heif':
      return 'HEIC'
    case 'tif':
    case 'tiff':
      return 'TIFF'
    default:
      return null
  }
}

export const ACCEPT_INPUT =
  'image/jpeg,image/png,image/webp,image/bmp,image/heic,image/heif,image/tiff,.jpg,.jpeg,.png,.webp,.bmp,.heic,.heif,.tif,.tiff'
