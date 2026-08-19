import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib'

import { loadPdfJsDocument, renderPdfPage } from './pdf-runtime.ts'
import type {
  PdfDocumentAudit,
  PdfFormFieldAudit,
  PdfFunctionalComparison,
  PdfVisualComparison,
} from './types.ts'

const normalizeText = (value: string) =>
  value.replace(/\s+/g, ' ').trim()

const getFieldValue = (
  field:
    | PDFCheckBox
    | PDFDropdown
    | PDFOptionList
    | PDFRadioGroup
    | PDFTextField,
) => {
  if (field instanceof PDFTextField) return field.getText() ?? ''
  if (field instanceof PDFCheckBox) {
    return field.isChecked() ? 'checked' : 'unchecked'
  }
  if (field instanceof PDFRadioGroup) return field.getSelected() ?? ''
  return field.getSelected().join('|')
}

const auditFormFields = async (bytes: Uint8Array) => {
  const document = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const fields: PdfFormFieldAudit[] = []

  for (const field of document.getForm().getFields()) {
    if (
      field instanceof PDFTextField ||
      field instanceof PDFCheckBox ||
      field instanceof PDFDropdown ||
      field instanceof PDFOptionList ||
      field instanceof PDFRadioGroup
    ) {
      fields.push({
        name: field.getName(),
        type: field.constructor.name,
        value: getFieldValue(field),
      })
    } else {
      fields.push({
        name: field.getName(),
        type: field.constructor.name,
        value: '',
      })
    }
  }

  return {
    fields: fields.sort((first, second) =>
      first.name.localeCompare(second.name),
    ),
    title: document.getTitle() ?? null,
  }
}

export const auditPdfDocument = async (
  filePath: string,
): Promise<PdfDocumentAudit> => {
  const bytes = new Uint8Array(await readFile(filePath))
  const form = await auditFormFields(bytes)
  const { document, destroy } = await loadPdfJsDocument(bytes)
  const pageSizes: { height: number; width: number }[] = []
  const annotationTypes: Record<string, number> = {}
  const linkTargets: string[] = []
  const textParts: string[] = []
  let annotationCount = 0

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const textContent = await page.getTextContent()
      const annotations = await page.getAnnotations({ intent: 'display' })

      pageSizes.push({
        height: Math.round(viewport.height * 1000) / 1000,
        width: Math.round(viewport.width * 1000) / 1000,
      })
      textParts.push(
        ...textContent.items.flatMap((item) =>
          'str' in item ? [item.str] : [],
        ),
      )

      annotationCount += annotations.length
      annotations.forEach((annotation) => {
        const type = annotation.subtype || 'Unknown'
        annotationTypes[type] = (annotationTypes[type] ?? 0) + 1
        const target = annotation.url || annotation.unsafeUrl
        if (target) linkTargets.push(target)
      })
      page.cleanup()
    }
  } finally {
    await destroy()
  }

  const normalizedText = normalizeText(textParts.join(' '))

  return {
    annotationCount,
    annotationTypes,
    formFields: form.fields,
    linkTargets: linkTargets.sort(),
    pageCount: pageSizes.length,
    pageSizes,
    textCharacters: normalizedText.length,
    textHash: createHash('sha256').update(normalizedText).digest('hex'),
    title: form.title,
  }
}

const arePageSizesEqual = (
  first: PdfDocumentAudit['pageSizes'],
  second: PdfDocumentAudit['pageSizes'],
) =>
  first.length === second.length &&
  first.every(
    (size, index) =>
      size.width === second[index]?.width &&
      size.height === second[index]?.height,
  )

export const comparePdfFunctionality = (
  input: PdfDocumentAudit,
  output: PdfDocumentAudit,
): PdfFunctionalComparison => ({
  annotationsPreserved:
    input.annotationCount === output.annotationCount &&
    JSON.stringify(input.annotationTypes) ===
      JSON.stringify(output.annotationTypes),
  formFieldsPreserved:
    JSON.stringify(input.formFields) === JSON.stringify(output.formFields),
  linksPreserved:
    JSON.stringify(input.linkTargets) === JSON.stringify(output.linkTargets),
  pageCountPreserved: input.pageCount === output.pageCount,
  pageGeometryPreserved: arePageSizesEqual(input.pageSizes, output.pageSizes),
  textCharactersPreservedRatio: input.textCharacters
    ? output.textCharacters / input.textCharacters
    : output.textCharacters === 0
      ? 1
      : 0,
  textContentPreserved: input.textHash === output.textHash,
  titlePreserved: input.title === output.title,
})

export const comparePdfVisuals = async (
  inputPath: string,
  outputPath: string,
): Promise<PdfVisualComparison> => {
  const [inputBytes, outputBytes] = await Promise.all([
    readFile(inputPath),
    readFile(outputPath),
  ])
  const input = await loadPdfJsDocument(new Uint8Array(inputBytes))
  const output = await loadPdfJsDocument(new Uint8Array(outputBytes))
  let absoluteError = 0
  let squaredError = 0
  let sampleCount = 0
  let pixelIdentical = input.document.numPages === output.document.numPages

  try {
    const pageCount = Math.min(
      input.document.numPages,
      output.document.numPages,
    )

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const [inputPage, outputPage] = await Promise.all([
        input.document.getPage(pageNumber),
        output.document.getPage(pageNumber),
      ])
      const [inputRender, outputRender] = await Promise.all([
        renderPdfPage(inputPage, 1),
        renderPdfPage(outputPage, 1),
      ])
      const inputPixels = inputRender.canvas
        .getContext('2d')
        .getImageData(
          0,
          0,
          inputRender.canvas.width,
          inputRender.canvas.height,
        ).data
      const outputPixels = outputRender.canvas
        .getContext('2d')
        .getImageData(
          0,
          0,
          outputRender.canvas.width,
          outputRender.canvas.height,
        ).data

      if (inputPixels.length !== outputPixels.length) {
        pixelIdentical = false
        continue
      }

      for (let index = 0; index < inputPixels.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          const difference =
            inputPixels[index + channel] - outputPixels[index + channel]
          absoluteError += Math.abs(difference)
          squaredError += difference * difference
          sampleCount += 1
          if (difference !== 0) pixelIdentical = false
        }
      }

      inputPage.cleanup()
      outputPage.cleanup()
    }
  } finally {
    await Promise.all([input.destroy(), output.destroy()])
  }

  const meanAbsoluteError = sampleCount ? absoluteError / sampleCount : 0
  const meanSquaredError = sampleCount ? squaredError / sampleCount : 0
  const psnrDb =
    meanSquaredError === 0
      ? 99
      : 10 * Math.log10((255 * 255) / meanSquaredError)

  return {
    meanAbsoluteError: Math.round(meanAbsoluteError * 1000) / 1000,
    pixelIdentical,
    psnrDb: Math.round(psnrDb * 100) / 100,
  }
}
