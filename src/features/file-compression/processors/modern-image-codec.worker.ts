import type {
  ModernImageCodecOptions,
  ModernImageCodecResult,
} from './modern-image-codec'

type ModernImageWorkerRequest = {
  readonly input: ArrayBuffer
  readonly options: ModernImageCodecOptions
}

type ModernImageWorkerResponse =
  | { readonly result: ModernImageCodecResult }
  | { readonly error: string }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ModernImageWorkerRequest>) => void) | null
  postMessage: (
    message: ModernImageWorkerResponse,
    transfer?: readonly Transferable[],
  ) => void
}

const processImage = async ({
  input,
  options,
}: ModernImageWorkerRequest): Promise<ModernImageCodecResult> => {
  if (options.format === 'webp') {
    const { decode, encode } = await import('@jsquash/webp')
    const image = await decode(input)

    if (options.mode === 'inspect') {
      return { height: image.height, width: image.width }
    }

    const output = await encode(image, {
      method: 4,
      quality: options.quality,
      use_sharp_yuv: 1,
    })
    return {
      height: image.height,
      output,
      width: image.width,
    }
  }

  const { decode, encode } = await import('@jsquash/avif')
  const image = await decode(input)

  if (!image) throw new Error('No se pudo decodificar la imagen AVIF.')
  if (options.mode === 'inspect') {
    return { height: image.height, width: image.width }
  }

  const output = await encode(image, {
    quality: options.quality,
    speed: 6,
  })
  return {
    height: image.height,
    output,
    width: image.width,
  }
}

workerScope.onmessage = (event) => {
  void processImage(event.data).then(
    (result) => {
      const transfer = result.output ? [result.output] : undefined
      workerScope.postMessage({ result }, transfer)
    },
    (error: unknown) =>
      workerScope.postMessage({
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo procesar la imagen.',
      }),
  )
}
