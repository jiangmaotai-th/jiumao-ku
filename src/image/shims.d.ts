declare module 'heic2any' {
  type Heic2AnyOptions = {
    blob: Blob
    toType?: string
    quality?: number
  }

  export default function heic2any(
    options: Heic2AnyOptions,
  ): Promise<Blob | Blob[]>
}

declare module 'utif' {
  type IFD = {
    width: number
    height: number
    [key: string]: unknown
  }

  const UTIF: {
    decode: (buffer: ArrayBuffer) => IFD[]
    decodeImage: (buffer: ArrayBuffer, ifd: IFD) => void
    toRGBA8: (ifd: IFD) => Uint8Array
  }

  export default UTIF
}

declare module 'icodec/heic-enc.wasm?url' {
  const url: string
  export default url
}
