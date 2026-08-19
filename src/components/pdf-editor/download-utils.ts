import { downloadBlob } from '@/lib/files/download'
import { sanitizeFileNamePart } from '@/lib/files/file-names'

export { downloadBlob }

export const getSafeDocumentBaseName = (fileName: string) => {
  const baseName = sanitizeFileNamePart(fileName.replace(/\.pdf$/i, ''))

  return baseName || 'documento'
}

export const getEditedDocumentBaseName = (
  fileName: string,
  combined = false,
) =>
  `${getSafeDocumentBaseName(fileName)}${combined ? '-combinado' : ''}-editado`
