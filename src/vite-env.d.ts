/// <reference types="vite/client" />

declare module 'iwork-preview' {
  export function extractPreviewPdf(fileBuf: Uint8Array | ArrayBuffer): Uint8Array | null
  export function kindForFilename(name: string): 'pages' | 'numbers' | 'keynote' | null
}

declare module 'snappyjs' {
  const SnappyJS: {
    uncompress(buf: ArrayBuffer | Uint8Array): ArrayBuffer | Uint8Array
    compress(buf: ArrayBuffer | Uint8Array): ArrayBuffer | Uint8Array
  }
  export default SnappyJS
}
