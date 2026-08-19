export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024))} MB`
}
