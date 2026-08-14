export function getFullscreenPortalContainer(): Element | undefined {
  if (typeof document === 'undefined') return undefined

  return document.fullscreenElement ?? undefined
}
