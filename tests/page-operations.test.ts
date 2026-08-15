import { test } from 'node:test'
import assert from 'node:assert/strict'

import { removePage } from '../src/components/pdf-editor/page-operations.ts'
import type {
  Annotation,
  PdfPageReference,
  TextDraft,
} from '../src/components/pdf-editor/types.ts'

const pages: PdfPageReference[] = [
  { id: 'page-1', sourceId: 'source-a', sourcePageNumber: 1 },
  { id: 'page-2', sourceId: 'source-a', sourcePageNumber: 2 },
  { id: 'page-3', sourceId: 'source-b', sourcePageNumber: 1 },
]

const annotations: Annotation[] = [
  {
    id: 'text-page-1',
    pageId: 'page-1',
    type: 'text',
    x: 0.1,
    y: 0.1,
    text: 'Conservar',
    format: {
      bold: false,
      color: '#111827',
      fontFamily: 'helvetica',
      fontSize: 14,
      italic: false,
      underline: false,
    },
    layer: 1,
  },
  {
    id: 'rectangle-page-2',
    pageId: 'page-2',
    type: 'rectangle',
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.4, y: 0.4 },
    format: { color: '#ff5a45', opacity: 1, strokeWidth: 2 },
    layer: 1,
  },
  {
    id: 'line-page-3',
    pageId: 'page-3',
    type: 'line',
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.4, y: 0.4 },
    format: { color: '#2563eb', opacity: 1, strokeWidth: 2 },
    layer: 1,
  },
]

const textDraft: TextDraft = {
  annotationId: null,
  format: annotations[0].type === 'text' ? annotations[0].format : {
    bold: false,
    color: '#111827',
    fontFamily: 'helvetica',
    fontSize: 14,
    italic: false,
    underline: false,
  },
  pageId: 'page-2',
  value: 'Borrador',
  x: 0.2,
  y: 0.2,
}

test('elimina una página intermedia, sus anotaciones y el borrador activo', () => {
  const result = removePage({
    annotations,
    pageId: 'page-2',
    pages,
    selectedAnnotationId: 'rectangle-page-2',
    selectedPageId: 'page-2',
    textDraft,
  })

  assert.equal(result.status, 'removed')
  if (result.status !== 'removed') return

  assert.deepEqual(result.pages.map((page) => page.id), ['page-1', 'page-3'])
  assert.deepEqual(
    result.annotations.map((annotation) => annotation.id),
    ['text-page-1', 'line-page-3'],
  )
  assert.equal(result.selectedPageId, 'page-3')
  assert.equal(result.selectedAnnotationId, null)
  assert.equal(result.textDraft, null)
})

test('conserva la selección actual si se elimina otra página', () => {
  const result = removePage({
    annotations,
    pageId: 'page-1',
    pages,
    selectedAnnotationId: 'line-page-3',
    selectedPageId: 'page-3',
    textDraft: null,
  })

  assert.equal(result.status, 'removed')
  if (result.status !== 'removed') return

  assert.deepEqual(result.pages.map((page) => page.id), ['page-2', 'page-3'])
  assert.equal(result.selectedPageId, 'page-3')
  assert.equal(result.selectedAnnotationId, 'line-page-3')
})

test('al eliminar la última página selecciona la anterior', () => {
  const result = removePage({
    annotations,
    pageId: 'page-3',
    pages,
    selectedAnnotationId: 'line-page-3',
    selectedPageId: 'page-3',
    textDraft: null,
  })

  assert.equal(result.status, 'removed')
  if (result.status !== 'removed') return

  assert.deepEqual(result.pages.map((page) => page.id), ['page-1', 'page-2'])
  assert.equal(result.selectedPageId, 'page-2')
  assert.equal(result.selectedAnnotationId, null)
})

test('impide dejar el documento sin páginas', () => {
  const result = removePage({
    annotations,
    pageId: 'page-1',
    pages: [pages[0]],
    selectedAnnotationId: 'text-page-1',
    selectedPageId: 'page-1',
    textDraft: null,
  })

  assert.deepEqual(result, { status: 'last-page' })
})

test('devuelve not-found para una página que ya no pertenece al manifiesto', () => {
  const result = removePage({
    annotations,
    pageId: 'missing-page',
    pages,
    selectedAnnotationId: null,
    selectedPageId: 'page-1',
    textDraft: null,
  })

  assert.deepEqual(result, { status: 'not-found' })
})
