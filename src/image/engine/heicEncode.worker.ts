import { heic } from 'icodec'
import heicEncWasm from 'icodec/heic-enc.wasm?url'

type WorkerRequest = {
  id: string
  width: number
  height: number
  data: ArrayBuffer
  quality: number
}

type WorkerResponse =
  | { id: string; ok: true; bytes: ArrayBuffer }
  | { id: string; ok: false; error: string }

let encoderReady: Promise<void> | null = null

function ensureEncoder() {
  if (!encoderReady) {
    encoderReady = heic.loadEncoder(heicEncWasm).then(() => undefined)
  }
  return encoderReady
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, width, height, data, quality } = event.data

  void (async () => {
    try {
      await ensureEncoder()
      const pixels = new Uint8ClampedArray(data)
      const encoded = heic.encode(
        {
          data: pixels,
          width,
          height,
          depth: 8,
        },
        {
          quality: Math.max(0, Math.min(100, quality)),
          preset: 'faster',
          complexity: 35,
          tune: 'ssim',
        },
      )
      const copy = new ArrayBuffer(encoded.byteLength)
      new Uint8Array(copy).set(encoded)
      const response: WorkerResponse = { id, ok: true, bytes: copy }
      ;(self as unknown as Worker).postMessage(response, [copy])
    } catch (error) {
      const response: WorkerResponse = {
        id,
        ok: false,
        error: String(error instanceof Error ? error.message : error),
      }
      ;(self as unknown as Worker).postMessage(response)
    }
  })()
}
