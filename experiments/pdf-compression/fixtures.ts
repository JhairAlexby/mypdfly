import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createCanvas } from '@napi-rs/canvas'
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFPage,
} from 'pdf-lib'

import type { PdfExperimentFixture } from './types.ts'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const LINK_TARGET = 'https://example.com/mypdfly-pdf-experiment'

const saveFixture = async (
  document: PDFDocument,
  path: string,
) => {
  const bytes = await document.save({
    addDefaultPage: false,
    objectsPerTick: 100,
    updateFieldAppearances: true,
    useObjectStreams: false,
  })
  await writeFile(path, bytes)
}

const addExternalLink = (
  document: PDFDocument,
  page: PDFPage,
  rectangle: readonly [number, number, number, number],
  target = LINK_TARGET,
) => {
  const annotation = document.context.obj({
    A: {
      S: PDFName.of('URI'),
      Type: PDFName.of('Action'),
      URI: PDFString.of(target),
    },
    Border: [0, 0, 0],
    Rect: [...rectangle],
    Subtype: PDFName.of('Link'),
    Type: PDFName.of('Annot'),
  })
  page.node.addAnnot(document.context.register(annotation))
}

const createTextVectorFixture = async (path: string) => {
  const document = await PDFDocument.create({ updateMetadata: false })
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  document.setTitle('Corpus controlado: texto y vectores')
  document.setAuthor('mypdfly benchmark')

  for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawRectangle({
      color: rgb(0.96, 0.97, 1),
      height: PAGE_HEIGHT,
      width: PAGE_WIDTH,
      x: 0,
      y: 0,
    })
    page.drawText(`Informe vectorial · página ${pageIndex + 1}`, {
      color: rgb(0.08, 0.12, 0.22),
      font: bold,
      size: 24,
      x: 48,
      y: 724,
    })

    for (let row = 0; row < 18; row += 1) {
      const y = 675 - row * 31
      page.drawRectangle({
        borderColor: rgb(0.75, 0.79, 0.88),
        borderWidth: 0.6,
        color: row % 2 ? rgb(1, 1, 1) : rgb(0.93, 0.95, 1),
        height: 24,
        width: 516,
        x: 48,
        y: y - 5,
      })
      page.drawText(
        `Registro ${pageIndex + 1}.${row + 1}: contenido seleccionable para verificar estructura, búsqueda y copia.`,
        {
          color: rgb(0.16, 0.2, 0.3),
          font: regular,
          size: 9.5,
          x: 58,
          y,
        },
      )
    }

    page.drawText('Abrir referencia del experimento', {
      color: rgb(0.1, 0.35, 0.78),
      font: regular,
      size: 11,
      x: 48,
      y: 65,
    })
    page.drawLine({
      color: rgb(0.1, 0.35, 0.78),
      end: { x: 222, y: 62 },
      start: { x: 48, y: 62 },
      thickness: 0.8,
    })
    addExternalLink(document, page, [46, 58, 225, 80])
  }

  await saveFixture(document, path)
}

const createDeterministicPhoto = (seed: number) => {
  const width = 1000
  const height = 1300
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  const image = context.createImageData(width, height)
  let randomState = seed >>> 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      randomState = (randomState * 1664525 + 1013904223) >>> 0
      const noise = ((randomState >>> 24) - 128) * 0.38
      const offset = (y * width + x) * 4
      const wave = Math.sin((x + seed * 11) / 43) * 30
      image.data[offset] = Math.max(
        0,
        Math.min(255, 45 + (x / width) * 170 + wave + noise),
      )
      image.data[offset + 1] = Math.max(
        0,
        Math.min(255, 35 + (y / height) * 185 - wave * 0.4 + noise),
      )
      image.data[offset + 2] = Math.max(
        0,
        Math.min(
          255,
          80 + ((x + y) / (width + height)) * 120 + noise,
        ),
      )
      image.data[offset + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  context.fillStyle = 'rgba(255,255,255,0.72)'
  context.fillRect(55, 55, 420, 95)
  context.fillStyle = '#172033'
  context.font = 'bold 42px sans-serif'
  context.fillText(`Escaneo controlado ${seed}`, 82, 115)

  return canvas.toBuffer('image/jpeg', 94)
}

const createPhotoScanFixture = async (path: string) => {
  const document = await PDFDocument.create({ updateMetadata: false })
  document.setTitle('Corpus controlado: escaneo fotográfico')

  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const photo = await document.embedJpg(
      createDeterministicPhoto(1701 + pageIndex * 97),
    )
    page.drawImage(photo, {
      height: PAGE_HEIGHT,
      width: PAGE_WIDTH,
      x: 0,
      y: 0,
    })
  }

  await saveFixture(document, path)
}

const createTransparentGraphic = () => {
  const canvas = createCanvas(720, 520)
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)

  for (let index = 0; index < 32; index += 1) {
    context.fillStyle = `rgba(${40 + (index * 17) % 180}, ${70 + (index * 31) % 150}, ${120 + (index * 13) % 120}, ${0.12 + (index % 5) * 0.13})`
    context.beginPath()
    context.arc(
      60 + (index * 97) % 620,
      55 + (index * 61) % 410,
      24 + (index % 6) * 14,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  context.fillStyle = 'rgba(15,23,42,0.84)'
  context.font = 'bold 54px sans-serif'
  context.fillText('PNG con alfa', 160, 278)
  return canvas.toBuffer('image/png')
}

const createMixedFixture = async (path: string) => {
  const document = await PDFDocument.create({ updateMetadata: false })
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const transparentGraphic = await document.embedPng(createTransparentGraphic())
  const photo = await document.embedJpg(createDeterministicPhoto(911))
  document.setTitle('Corpus controlado: contenido mixto')

  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawRectangle({
      color: rgb(0.98, 0.98, 0.97),
      height: PAGE_HEIGHT,
      width: PAGE_WIDTH,
      x: 0,
      y: 0,
    })
    page.drawText(`Documento mixto ${pageIndex + 1}`, {
      color: rgb(0.08, 0.12, 0.2),
      font: bold,
      size: 22,
      x: 42,
      y: 736,
    })
    page.drawText(
      'Texto seleccionable, formas vectoriales, fotografía y una capa PNG con transparencia.',
      {
        color: rgb(0.2, 0.24, 0.32),
        font: regular,
        size: 10,
        x: 42,
        y: 710,
      },
    )
    page.drawImage(photo, {
      height: 285,
      width: 220,
      x: 42,
      y: 385,
    })
    page.drawImage(transparentGraphic, {
      height: 250,
      width: 346,
      x: 224,
      y: 405,
    })
    page.drawEllipse({
      borderColor: rgb(0.85, 0.25, 0.18),
      borderWidth: 4,
      color: rgb(1, 0.82, 0.76),
      opacity: 0.7,
      x: 185 + pageIndex * 12,
      xScale: 95,
      y: 228,
      yScale: 82,
    })
    page.drawText(
      `Control funcional ${pageIndex + 1}: esta frase debe seguir disponible para búsqueda y copia.`,
      {
        color: rgb(0.12, 0.16, 0.24),
        font: regular,
        size: 11,
        x: 42,
        y: 92,
      },
    )
    addExternalLink(document, page, [40, 84, 490, 106])
  }

  await saveFixture(document, path)
}

const createInteractiveFixture = async (path: string) => {
  const document = await PDFDocument.create({ updateMetadata: false })
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const form = document.getForm()
  document.setTitle('Corpus controlado: formulario interactivo')

  page.drawText('Formulario de validación funcional', {
    color: rgb(0.08, 0.12, 0.22),
    font: bold,
    size: 24,
    x: 48,
    y: 720,
  })
  page.drawText('Nombre', {
    font: regular,
    size: 11,
    x: 48,
    y: 657,
  })
  const name = form.createTextField('participant.name')
  name.setText('Ana Mendoza')
  name.addToPage(page, {
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.42, 0.48, 0.62),
    borderWidth: 1,
    font: regular,
    height: 30,
    width: 250,
    x: 48,
    y: 615,
  })

  const accepted = form.createCheckBox('terms.accepted')
  accepted.addToPage(page, {
    borderColor: rgb(0.18, 0.45, 0.3),
    borderWidth: 1,
    height: 20,
    width: 20,
    x: 48,
    y: 560,
  })
  accepted.check()
  page.drawText('Acepto conservar campos interactivos', {
    font: regular,
    size: 11,
    x: 78,
    y: 565,
  })

  const profile = form.createDropdown('compression.profile')
  profile.setOptions(['Estructural', 'Visual equilibrado', 'Visual agresivo'])
  profile.select('Estructural')
  profile.addToPage(page, {
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.42, 0.48, 0.62),
    borderWidth: 1,
    font: regular,
    height: 30,
    width: 250,
    x: 48,
    y: 490,
  })

  page.drawText('Abrir referencia externa', {
    color: rgb(0.1, 0.35, 0.78),
    font: regular,
    size: 11,
    x: 48,
    y: 430,
  })
  addExternalLink(document, page, [46, 424, 190, 446])

  const secondPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  secondPage.drawText('Segunda página de control', {
    font: bold,
    size: 22,
    x: 48,
    y: 720,
  })
  secondPage.drawText(
    'La cantidad de páginas, sus dimensiones y este texto deben permanecer accesibles.',
    {
      font: regular,
      size: 11,
      x: 48,
      y: 680,
    },
  )
  form.updateFieldAppearances(regular)

  await saveFixture(document, path)
}

export const createControlledPdfFixtures = async (
  directory: string,
): Promise<PdfExperimentFixture[]> => {
  const fixtures: PdfExperimentFixture[] = [
    {
      id: 'text-vector',
      label: 'Texto y vectores',
      path: join(directory, 'text-vector.pdf'),
    },
    {
      id: 'photo-scan',
      label: 'Escaneo fotográfico',
      path: join(directory, 'photo-scan.pdf'),
    },
    {
      id: 'mixed-content',
      label: 'Contenido mixto con transparencia',
      path: join(directory, 'mixed-content.pdf'),
    },
    {
      id: 'interactive-form',
      label: 'Formulario y enlace interactivo',
      path: join(directory, 'interactive-form.pdf'),
    },
  ]

  await createTextVectorFixture(fixtures[0].path)
  await createPhotoScanFixture(fixtures[1].path)
  await createMixedFixture(fixtures[2].path)
  await createInteractiveFixture(fixtures[3].path)

  return fixtures
}
