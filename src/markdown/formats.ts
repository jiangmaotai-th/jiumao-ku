export const MAX_FILES = 20
export const MAX_FILE_BYTES = 200 * 1024 * 1024

/** Accept list — broader than MarkItDown; conversion quality varies by engine. */
export const DOCUMENT_EXTENSIONS = new Set([
  // Documents
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'pages',
  'numbers',
  'key',
  'epub',
  // Web / text / data
  'html',
  'htm',
  'xhtml',
  'mhtml',
  'mht',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'xml',
  'rss',
  'atom',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'log',
  'txt',
  'text',
  'md',
  'markdown',
  'mdown',
  'rst',
  'org',
  'tex',
  'latex',
  'ipynb',
  'eml',
  'msg',
  'zip',
  // Images
  'png',
  'jpg',
  'jpeg',
  'bmp',
  'gif',
  'tif',
  'tiff',
  'webp',
  'heic',
  'heif',
  'svg',
])

export const MEDIA_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'ogg',
  'wma',
  'opus',
  'aiff',
  'aif',
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  'm4v',
  'mpeg',
  'mpg',
  'wmv',
])

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function isSupported(name: string): boolean {
  const ext = extensionOf(name)
  return DOCUMENT_EXTENSIONS.has(ext) || MEDIA_EXTENSIONS.has(ext)
}

export function isMedia(name: string): boolean {
  return MEDIA_EXTENSIONS.has(extensionOf(name))
}

export function isImage(name: string): boolean {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff', 'webp', 'heic', 'heif'].includes(
    extensionOf(name),
  )
}

export function acceptAttribute(): string {
  return [...DOCUMENT_EXTENSIONS, ...MEDIA_EXTENSIONS].map((e) => `.${e}`).join(',')
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

