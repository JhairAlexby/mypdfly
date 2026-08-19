import { readFile, writeFile } from 'node:fs/promises'

import { PDFDocument } from 'pdf-lib'

import { loadPdfJsDocument, renderPdfPage } from './pdf-runtime.ts'
import type {
  PdfExperimentMethod,
  PdfExperimentMethodId,
} from './types.ts'

type MemorySampler = () => void

export const PDF_EXPERIMENT_METHODS: readonly PdfExperimentMethod[] = [
  {
    id: 'structural',
    kind: 'structural',
    label: 'Reestructuración con object streams',
  },
  {
    id: 'visual-balanced',
    jpegQuality: 0.78,
    kind: 'visual',
    label: 'Raster JPEG equilibrado (1.5x, 78%)',
    renderScale: 1.5,
  },
  {
    id: 'visual-aggressive',
    jpegQuality: 0.58,
    kind: 'visual',
    label: 'Raster JPEG agresivo (1x, 58%)',
    renderScale: 1,
  },
]

const getMethod = (methodId: PdfExperimentMethodId) => {
  const method = PDF_EXPERIMENT_METHODS.find(
    (candidate) => candidate.id === methodId,
  )

  if (!method) {
    throw new Error(`Método PDF desconocido: ${methodId}`)
  }

  return method
}

const runStructuralOptimization = async (
  inputPath: string,
  outputPath: string,
  sampleMemory: MemorySampler,
) => {
  const inputBytes = new Uint8Array(await readFile(inputPath))
  sampleMemory()
  const document = await PDFDocument.load(inputBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  sampleMemory()
  const outputBytes = await document.save({
    addDefaultPage: false,
    objectsPerTick: 100,
    updateFieldAppearances: false,
    useObjectStreams: true,
  })
  sampleMemory()
  await writeFile(outputPath, outputBytes)
  sampleMemory()
}

const runVisualCompression = async (
  inputPath: string,
  outputPath: string,
  method: PdfExperimentMethod,
  sampleMemory: MemorySampler,
) => {
  if (method.jpegQuality === undefined || method.renderScale === undefined) {
    throw new Error(`El método visual ${method.id} no tiene perfil completo`)
  }

  const inputBytes = new Uint8Array(await readFile(inputPath))
  sampleMemory()
  const metadataDocument = await PDFDocument.load(inputBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const outputDocument = await PDFDocument.create({ updateMetadata: false })
  const title = metadataDocument.getTitle()
  if (title) outputDocument.setTitle(title)
  sampleMemory()

  const source = await loadPdfJsDocument(inputBytes)

  try {
    for (
      let pageNumber = 1;
      pageNumber <= source.document.numPages;
      pageNumber += 1
    ) {
      const sourcePage = await source.document.getPage(pageNumber)
      const logicalViewport = sourcePage.getViewport({ scale: 1 })
      const rendered = await renderPdfPage(sourcePage, method.renderScale)
      sampleMemory()

      const jpegBytes = rendered.canvas.toBuffer(
        'image/jpeg',
        Math.round(method.jpegQuality * 100),
      )
      sampleMemory()
      const image = await outputDocument.embedJpg(jpegBytes)
      const outputPage = outputDocument.addPage([
        logicalViewport.width,
        logicalViewport.height,
      ])
      outputPage.drawImage(image, {
        height: logicalViewport.height,
        width: logicalViewport.width,
        x: 0,
        y: 0,
      })
      sampleMemory()

      rendered.canvas.width = 1
      rendered.canvas.height = 1
      sourcePage.cleanup()
    }
  } finally {
    await source.destroy()
  }

  const outputBytes = await outputDocument.save({
    addDefaultPage: false,
    objectsPerTick: 100,
    updateFieldAppearances: false,
    useObjectStreams: true,
  })
  sampleMemory()
  await writeFile(outputPath, outputBytes)
  sampleMemory()
}

export const runPdfCompressionMethod = async (
  inputPath: string,
  outputPath: string,
  methodId: PdfExperimentMethodId,
  sampleMemory: MemorySampler,
) => {
  const method = getMethod(methodId)

  if (method.kind === 'structural') {
    await runStructuralOptimization(inputPath, outputPath, sampleMemory)
  } else {
    await runVisualCompression(inputPath, outputPath, method, sampleMemory)
  }

  return method
}
