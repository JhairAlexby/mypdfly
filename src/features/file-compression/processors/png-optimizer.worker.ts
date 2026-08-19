import { optimise } from '@jsquash/oxipng'

type PngWorkerRequest = {
  readonly input: ArrayBuffer
  readonly level: number
}

type PngWorkerResponse =
  | { readonly output: ArrayBuffer }
  | { readonly error: string }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PngWorkerRequest>) => void) | null
  postMessage: (
    message: PngWorkerResponse,
    transfer?: readonly Transferable[],
  ) => void
}

workerScope.onmessage = (event) => {
  void optimise(event.data.input, {
    interlace: false,
    level: event.data.level,
    optimiseAlpha: false,
  }).then(
    (output) => workerScope.postMessage({ output }, [output]),
    (error: unknown) =>
      workerScope.postMessage({
        error:
          error instanceof Error
            ? error.message
            : 'OxiPNG no pudo optimizar el archivo.',
      }),
  )
}
