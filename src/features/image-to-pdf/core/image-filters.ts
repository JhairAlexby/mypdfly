type ImageFilterOperation = {
  readonly amount: number
  readonly type: 'brightness' | 'contrast' | 'grayscale' | 'saturate'
}

export const IMAGE_FILTERS = [
  {
    description: 'Sin ajustes: conserva los colores y el contraste originales.',
    id: 'original',
    label: 'Original',
    operations: [] as readonly ImageFilterOperation[],
  },
  {
    description: 'Realza ligeramente el color sin perder un aspecto natural.',
    id: 'natural',
    label: 'Natural',
    operations: [
      { amount: 1.04, type: 'brightness' },
      { amount: 1.06, type: 'contrast' },
      { amount: 1.08, type: 'saturate' },
    ] as const,
  },
  {
    description: 'Aumenta la claridad y el contraste para documentos escaneados.',
    id: 'clean-document',
    label: 'Documento limpio',
    operations: [
      { amount: 1, type: 'grayscale' },
      { amount: 1.08, type: 'brightness' },
      { amount: 1.35, type: 'contrast' },
    ] as const,
  },
  {
    description: 'Convierte la imagen a tonos de gris conservando sus detalles.',
    id: 'grayscale',
    label: 'Grises',
    operations: [{ amount: 1, type: 'grayscale' }] as const,
  },
  {
    description: 'Separa el fondo y el contenido con un contraste blanco y negro intenso.',
    id: 'black-and-white',
    label: 'Blanco y negro',
    operations: [
      { amount: 1, type: 'grayscale' },
      { amount: 4, type: 'contrast' },
      { amount: 1.08, type: 'brightness' },
    ] as const,
  },
] as const

export type ImageFilter = (typeof IMAGE_FILTERS)[number]['id']
export type ImageFilterDefinition = (typeof IMAGE_FILTERS)[number]

export const getImageFilterDefinition = (
  filter: ImageFilter,
): ImageFilterDefinition =>
  IMAGE_FILTERS.find((definition) => definition.id === filter) ?? IMAGE_FILTERS[0]

export const getImageFilterCss = (filter: ImageFilter) => {
  const operations = getImageFilterDefinition(filter).operations
  return operations.length > 0
    ? operations
        .map((operation) => `${operation.type}(${operation.amount})`)
        .join(' ')
    : 'none'
}

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, value))

export const applyImageFilterToPixels = (
  pixels: Uint8ClampedArray,
  filter: ImageFilter,
) => {
  const operations = getImageFilterDefinition(filter).operations
  if (operations.length === 0) return pixels

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    let red = pixels[index]
    let green = pixels[index + 1]
    let blue = pixels[index + 2]

    for (const operation of operations) {
      if (operation.type === 'brightness') {
        red *= operation.amount
        green *= operation.amount
        blue *= operation.amount
        continue
      }

      if (operation.type === 'contrast') {
        red = (red - 127.5) * operation.amount + 127.5
        green = (green - 127.5) * operation.amount + 127.5
        blue = (blue - 127.5) * operation.amount + 127.5
        continue
      }

      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
      if (operation.type === 'grayscale') {
        red += (luminance - red) * operation.amount
        green += (luminance - green) * operation.amount
        blue += (luminance - blue) * operation.amount
        continue
      }

      red = luminance + (red - luminance) * operation.amount
      green = luminance + (green - luminance) * operation.amount
      blue = luminance + (blue - luminance) * operation.amount
    }

    pixels[index] = clampChannel(red)
    pixels[index + 1] = clampChannel(green)
    pixels[index + 2] = clampChannel(blue)
  }

  return pixels
}
