import { t } from '../../i18n'
import { createWorker, type Worker } from 'tesseract.js'
import { extensionOf } from '../formats'

let workerPromise: Promise<Worker> | null = null

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('chi_sim+eng', 1, {
        // Keep logs quiet in production UI
        logger: () => undefined,
      })
      return worker
    })()
  }
  return workerPromise
}

async function heicToPngBlob(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default
  const converted = await heic2any({ blob: file, toType: 'image/png' })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob) throw new Error(t('markdown.heicDecodeFailed'))
  return blob
}

async function prepareImageBlob(file: File): Promise<Blob> {
  const ext = extensionOf(file.name)
  if (ext === 'heic' || ext === 'heif') return heicToPngBlob(file)
  return file
}

export async function ocrImageToText(file: File): Promise<string> {
  const blob = await prepareImageBlob(file)
  const worker = await getOcrWorker()
  const {
    data: { text },
  } = await worker.recognize(blob)
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
