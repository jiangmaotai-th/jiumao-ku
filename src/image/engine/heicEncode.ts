let worker: Worker | null = null
let sequence = 0

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./heicEncode.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return worker
}

export async function encodeHeicBlob(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const id = `heic-${sequence++}`
  const workerInstance = getWorker()
  const payload = imageData.data.buffer.slice(
    imageData.data.byteOffset,
    imageData.data.byteOffset + imageData.data.byteLength,
  )

  return new Promise<Blob>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.id !== id) return
      workerInstance.removeEventListener('message', onMessage)
      workerInstance.removeEventListener('error', onError)
      if (!event.data.ok) {
        reject(new Error(event.data.error || 'HEIC encode failed'))
        return
      }
      resolve(new Blob([event.data.bytes], { type: 'image/heic' }))
    }
    const onError = (error: ErrorEvent) => {
      workerInstance.removeEventListener('message', onMessage)
      workerInstance.removeEventListener('error', onError)
      reject(new Error(error.message || 'HEIC worker error'))
    }

    workerInstance.addEventListener('message', onMessage)
    workerInstance.addEventListener('error', onError)
    workerInstance.postMessage(
      {
        id,
        width: imageData.width,
        height: imageData.height,
        data: payload,
        quality,
      },
      [payload],
    )
  })
}
