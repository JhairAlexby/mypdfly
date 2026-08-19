const INVALID_FILE_NAME_CHARACTERS = /[\\/:*?"<>|]+/g

export const sanitizeFileNamePart = (value: string) =>
  value
    .replace(INVALID_FILE_NAME_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .trim()

export const getFileExtension = (fileName: string) => {
  const sanitizedName = (
    fileName.replace(/\\/g, '/').split('/').pop() ?? ''
  ).trim()
  const extensionStart = sanitizedName.lastIndexOf('.')

  if (extensionStart <= 0 || extensionStart === sanitizedName.length - 1) {
    return ''
  }

  return sanitizedName.slice(extensionStart + 1).toLowerCase()
}

export const removeFileExtension = (fileName: string) => {
  const trimmedFileName = fileName.trim()
  const extension = getFileExtension(trimmedFileName)

  return extension
    ? trimmedFileName.slice(0, -(extension.length + 1))
    : trimmedFileName
}

export const getSafeFileBaseName = (
  fileName: string,
  fallback = 'archivo',
) => sanitizeFileNamePart(removeFileExtension(fileName)) || fallback
