export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const getSafeDocumentBaseName = (fileName: string) => {
  const baseName = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return baseName || 'documento'
}

export const getEditedDocumentBaseName = (
  fileName: string,
  combined = false,
) =>
  `${getSafeDocumentBaseName(fileName)}${combined ? '-combinado' : ''}-editado`
