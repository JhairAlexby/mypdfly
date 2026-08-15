import type {
  Annotation,
  PdfPageReference,
  TextDraft,
} from './types'

export type RemovePageInput = {
  pages: PdfPageReference[]
  annotations: Annotation[]
  pageId: string
  selectedPageId: string | null
  selectedAnnotationId: string | null
  textDraft: TextDraft | null
}

export type RemovePageResult =
  | { status: 'not-found' }
  | { status: 'last-page' }
  | {
      status: 'removed'
      removedPage: PdfPageReference
      pages: PdfPageReference[]
      annotations: Annotation[]
      selectedPageId: string | null
      selectedAnnotationId: string | null
      textDraft: TextDraft | null
    }

export const removePage = ({
  pages,
  annotations,
  pageId,
  selectedPageId,
  selectedAnnotationId,
  textDraft,
}: RemovePageInput): RemovePageResult => {
  if (pages.length <= 1) return { status: 'last-page' }

  const removedIndex = pages.findIndex((page) => page.id === pageId)
  if (removedIndex < 0) return { status: 'not-found' }

  const removedPage = pages[removedIndex]
  const nextPages = pages.filter((page) => page.id !== pageId)
  const selectedPageStillExists =
    selectedPageId && nextPages.some((page) => page.id === selectedPageId)
  const nextSelectedPageId = selectedPageStillExists
    ? selectedPageId
    : (nextPages[removedIndex]?.id ?? nextPages[removedIndex - 1]?.id ?? null)
  const nextAnnotations = annotations.filter(
    (annotation) => annotation.pageId !== pageId,
  )
  const nextSelectedAnnotationId =
    selectedAnnotationId &&
    nextAnnotations.some((annotation) => annotation.id === selectedAnnotationId)
      ? selectedAnnotationId
      : null

  return {
    status: 'removed',
    removedPage,
    pages: nextPages,
    annotations: nextAnnotations,
    selectedPageId: nextSelectedPageId,
    selectedAnnotationId: nextSelectedAnnotationId,
    textDraft: textDraft?.pageId === pageId ? null : textDraft,
  }
}
