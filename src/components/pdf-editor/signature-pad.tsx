import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  Check,
  Eraser,
  Feather,
  Minus,
  PenLine,
  Signature as SignatureIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

import { SignatureDrawing } from './annotation-marks'
import type {
  SignaturePadProps,
  SignaturePoint,
  SignatureStroke,
} from './types'
import { clamp } from './utils'

export function SignaturePad({
  initialFormat,
  onCancel,
  onUse,
}: SignaturePadProps) {
  const padRef = useRef<SVGSVGElement>(null)
  const strokesRef = useRef<SignatureStroke[]>([])
  const activePointerRef = useRef<number | null>(null)
  const activeStrokeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [strokes, setStrokes] = useState<SignatureStroke[]>([])
  const [format, setFormat] = useState(initialFormat)

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const scheduleRender = () => {
    if (animationFrameRef.current !== null) return
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      setStrokes(strokesRef.current.map((stroke) => [...stroke]))
    })
  }

  const toSignaturePoint = (event: PointerEvent): SignaturePoint | null => {
    if (!padRef.current) return null
    const bounds = padRef.current.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null

    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    }
  }

  const appendSignaturePoint = (point: SignaturePoint) => {
    const strokeIndex = activeStrokeRef.current
    if (strokeIndex === null) return false
    const stroke = strokesRef.current[strokeIndex]
    if (!stroke) return false

    const previousPoint = stroke[stroke.length - 1]
    if (
      previousPoint &&
      Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 0.0015
    ) {
      return false
    }

    stroke.push(point)
    return true
  }

  const appendPoints = (events: PointerEvent[]) => {
    let didAppend = false
    events.forEach((event) => {
      const point = toSignaturePoint(event)
      if (!point) return
      didAppend = appendSignaturePoint(point) || didAppend
    })
    if (didAppend) scheduleRender()
  }

  const beginStroke = (point: SignaturePoint) => {
    activeStrokeRef.current = strokesRef.current.length
    strokesRef.current = [...strokesRef.current, [point]]
    scheduleRender()
  }

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !padRef.current) return
    event.preventDefault()
    const point = toSignaturePoint(event.nativeEvent)
    if (!point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    beginStroke(point)
  }

  const continueDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    event.preventDefault()
    const coalescedEvents = event.nativeEvent.getCoalescedEvents?.()
    appendPoints(coalescedEvents?.length ? coalescedEvents : [event.nativeEvent])
  }

  const finishDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    event.preventDefault()
    appendPoints([event.nativeEvent])
    activePointerRef.current = null
    activeStrokeRef.current = null
  }

  const clearSignature = () => {
    activePointerRef.current = null
    activeStrokeRef.current = null
    strokesRef.current = []
    setStrokes([])
  }

  const hasSignature = strokes.some((stroke) => stroke.length > 1)

  return (
    <>
      <div
        className="signature-pad-tools"
        role="toolbar"
        aria-label="Formato de la firma"
      >
        <div className="signature-pad-control">
          <span className="signature-pad-tool-label">
            <PenLine aria-hidden="true" />
            Tinta
          </span>
          {['#111827', '#1d4ed8'].map((color) => (
            <Button
              key={color}
              type="button"
              variant="outline"
              size="icon-sm"
              className={`signature-ink-swatch ${format.color === color ? 'signature-ink-swatch--active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setFormat((current) => ({ ...current, color }))}
              aria-label={color === '#111827' ? 'Tinta negra' : 'Tinta azul'}
            />
          ))}
        </div>

        <div className="signature-pad-control signature-width-control">
          <span className="signature-pad-tool-label">
            <Minus aria-hidden="true" />
            Grosor
          </span>
          <Slider
            className="signature-width-slider"
            min={2}
            max={14}
            step={1}
            value={[format.strokeWidth]}
            onValueChange={(value) =>
              setFormat((current) => ({
                ...current,
                strokeWidth: value[0] ?? current.strokeWidth,
              }))
            }
            aria-label="Grosor de la firma"
          />
          <span className="signature-control-value">
            {format.strokeWidth} px
          </span>
        </div>

        <Button
          type="button"
          variant={format.effect === 'natural' ? 'secondary' : 'outline'}
          size="sm"
          className={
            format.effect === 'natural' ? 'signature-natural-active' : ''
          }
          onClick={() =>
            setFormat((current) => ({
              ...current,
              effect: current.effect === 'natural' ? 'clean' : 'natural',
            }))
          }
          aria-pressed={format.effect === 'natural'}
          title="Añade variaciones sutiles de presión y tinta"
        >
          <Feather data-icon="inline-start" />
          Tinta natural
        </Button>
      </div>

      <div className="signature-pad-wrap">
        <svg
          ref={padRef}
          className="signature-pad"
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          aria-label="Lienzo para dibujar la firma"
          role="img"
        >
          <SignatureDrawing strokes={strokes} format={format} />
        </svg>
        {!hasSignature && (
          <div className="signature-pad-placeholder" aria-hidden="true">
            <SignatureIcon />
            <span>Firma aquí</span>
          </div>
        )}
        <span className="signature-pad-baseline" aria-hidden="true" />
      </div>

      <p className="signature-pad-hint">
        Mantén presionado mientras firmas. Suelta y vuelve a presionar para
        agregar otra parte.
      </p>

      <DialogFooter className="items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={clearSignature}
          disabled={!strokes.length}
        >
          <Eraser data-icon="inline-start" />
          Limpiar
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onUse(
                strokesRef.current.map((stroke) => [...stroke]),
                format,
              )
            }
            disabled={!hasSignature}
          >
            <Check data-icon="inline-start" />
            Usar firma
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
