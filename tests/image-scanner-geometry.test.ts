import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createFullImageDetection,
  getDocumentConfidence,
  getPerspectiveOutputSize,
  orderScannerCorners,
} from '../experiments/image-scanner/geometry.ts'

test('ordena un cuadrilátero como superior izquierda, superior derecha, inferior derecha e inferior izquierda', () => {
  const ordered = orderScannerCorners([
    { x: 90, y: 80 },
    { x: 10, y: 70 },
    { x: 100, y: 12 },
    { x: 20, y: 8 },
  ])

  assert.deepEqual(ordered, [
    { x: 20, y: 8 },
    { x: 100, y: 12 },
    { x: 90, y: 80 },
    { x: 10, y: 70 },
  ])
})

test('calcula dimensiones de perspectiva usando el mayor lado opuesto', () => {
  const size = getPerspectiveOutputSize([
    { x: 0, y: 0 },
    { x: 120, y: 10 },
    { x: 110, y: 210 },
    { x: 5, y: 200 },
  ])

  assert.equal(size.width, 120)
  assert.equal(size.height, 200)
})

test('crea un fallback explícito con las cuatro esquinas completas', () => {
  assert.deepEqual(createFullImageDetection(320, 240), {
    confidence: 0,
    corners: [
      { x: 0, y: 0 },
      { x: 319, y: 0 },
      { x: 319, y: 239 },
      { x: 0, y: 239 },
    ],
    detected: false,
  })
})

test('normaliza la confianza por área dentro del intervalo cero a uno', () => {
  assert.equal(getDocumentConfidence(0, 100), 0)
  assert.equal(getDocumentConfidence(8, 100), 0)
  assert.equal(getDocumentConfidence(44, 100), 0.5)
  assert.equal(getDocumentConfidence(100, 100), 1)
})

test('rechaza una geometría que no tenga cuatro puntos', () => {
  assert.throws(
    () => orderScannerCorners([{ x: 0, y: 0 }]),
    /exactamente cuatro esquinas/,
  )
})
