export const IMAGE_FILTERS = [
  {
    cssFilter: 'none',
    description: 'Sin ajustes: conserva los colores y el contraste originales.',
    id: 'original',
    label: 'Original',
  },
  {
    cssFilter: 'brightness(1.04) contrast(1.06) saturate(1.08)',
    description: 'Realza ligeramente el color sin perder un aspecto natural.',
    id: 'natural',
    label: 'Natural',
  },
  {
    cssFilter: 'grayscale(1) brightness(1.08) contrast(1.35)',
    description: 'Aumenta la claridad y el contraste para documentos escaneados.',
    id: 'clean-document',
    label: 'Documento limpio',
  },
  {
    cssFilter: 'grayscale(1)',
    description: 'Convierte la imagen a tonos de gris conservando sus detalles.',
    id: 'grayscale',
    label: 'Grises',
  },
  {
    cssFilter: 'grayscale(1) contrast(4) brightness(1.08)',
    description: 'Separa el fondo y el contenido con un contraste blanco y negro intenso.',
    id: 'black-and-white',
    label: 'Blanco y negro',
  },
] as const

export type ImageFilter = (typeof IMAGE_FILTERS)[number]['id']
export type ImageFilterDefinition = (typeof IMAGE_FILTERS)[number]

export const getImageFilterDefinition = (
  filter: ImageFilter,
): ImageFilterDefinition =>
  IMAGE_FILTERS.find((definition) => definition.id === filter) ?? IMAGE_FILTERS[0]

export const getImageFilterCss = (filter: ImageFilter) =>
  getImageFilterDefinition(filter).cssFilter
