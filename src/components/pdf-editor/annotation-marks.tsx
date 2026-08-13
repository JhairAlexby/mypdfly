import { useId } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import type {
  BlurMarkProps,
  ResizeHandle,
  ShapeMarkProps,
  SignatureDrawingProps,
  SignatureMarkProps,
} from './types'
import { getNaturalInkVariation, getSignaturePath } from './utils'

export function ShapeMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: ShapeMarkProps) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const startX = annotation.start.x * 1000
  const startY = annotation.start.y * 1000
  const endX = annotation.end.x * 1000
  const endY = annotation.end.y * 1000
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  const handleMoveStart = (event: ReactPointerEvent<SVGElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (savedAnnotation) onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<SVGElement>,
    handle: ResizeHandle,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (savedAnnotation) onResizeStart?.(event, savedAnnotation, handle)
  }

  const shapeProps = {
    fill: annotation.type === 'line' ? 'none' : annotation.format.color,
    fillOpacity: annotation.type === 'line' ? undefined : 1,
    stroke: annotation.format.color,
    strokeWidth: annotation.format.strokeWidth,
    opacity: annotation.format.opacity,
    strokeDasharray: isDraft ? '12 10' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
    onPointerDown: savedAnnotation ? handleMoveStart : undefined,
    onClick: (event: ReactMouseEvent<SVGElement>) => event.stopPropagation(),
    className: savedAnnotation ? 'annotation-shape' : undefined,
  }

  const resizeHandle = (
    handle: ResizeHandle,
    handleX: number,
    handleY: number,
  ) => (
    <circle
      key={handle}
      className="annotation-resize-handle"
      cx={handleX}
      cy={handleY}
      r="10"
      fill="white"
      stroke="#2563eb"
      strokeWidth="4"
      vectorEffect="non-scaling-stroke"
      onPointerDown={(event) => handleResizeStart(event, handle)}
      onClick={(event) => event.stopPropagation()}
    />
  )

  return (
    <g>
      {annotation.type === 'line' && (
        <>
          {savedAnnotation && (
            <line
              className="annotation-shape-hitbox"
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="transparent"
              strokeWidth="24"
              vectorEffect="non-scaling-stroke"
              onPointerDown={handleMoveStart}
              onClick={(event) => event.stopPropagation()}
            />
          )}
          <line x1={startX} y1={startY} x2={endX} y2={endY} {...shapeProps} />
        </>
      )}

      {annotation.type === 'circle' && (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...shapeProps}
        />
      )}

      {annotation.type === 'triangle' && (
        <polygon
          points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`}
          {...shapeProps}
        />
      )}

      {annotation.type === 'rectangle' && (
        <rect x={x} y={y} width={width} height={height} rx="8" {...shapeProps} />
      )}

      {isSelected && annotation.type !== 'line' && (
        <rect
          className="annotation-selection-box"
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeDasharray="8 8"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {isSelected && annotation.type === 'line' && (
        <>
          {resizeHandle('start', startX, startY)}
          {resizeHandle('end', endX, endY)}
        </>
      )}

      {isSelected && annotation.type !== 'line' && (
        <>
          {resizeHandle('nw', x, y)}
          {resizeHandle('ne', x + width, y)}
          {resizeHandle('sw', x, y + height)}
          {resizeHandle('se', x + width, y + height)}
        </>
      )}
    </g>
  )
}

export function BlurMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: BlurMarkProps) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const x = Math.min(annotation.start.x, annotation.end.x)
  const y = Math.min(annotation.start.y, annotation.end.y)
  const width = Math.abs(annotation.end.x - annotation.start.x)
  const height = Math.abs(annotation.end.y - annotation.start.y)

  const handleMoveStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<HTMLSpanElement>,
    handle: ResizeHandle,
  ) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeStart?.(event, savedAnnotation, handle)
  }

  return (
    <div
      className={[
        'blur-annotation',
        isSelected && 'blur-annotation--selected',
        isDraft && 'blur-annotation--draft',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        zIndex: savedAnnotation?.layer ?? 10000,
        backdropFilter: `blur(${annotation.format.intensity}px)`,
        WebkitBackdropFilter: `blur(${annotation.format.intensity}px)`,
      }}
      onPointerDown={savedAnnotation ? handleMoveStart : undefined}
      onClick={(event) => event.stopPropagation()}
      title={savedAnnotation ? 'Arrastra para mover el área difuminada' : undefined}
    >
      {isDraft && <span className="blur-draft-label">Difuminar</span>}
      {isSelected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
          <span
            key={handle}
            className={`blur-resize-handle blur-resize-handle--${handle}`}
            onPointerDown={(event) => handleResizeStart(event, handle)}
            onClick={(event) => event.stopPropagation()}
            aria-hidden="true"
          />
        ))}
    </div>
  )
}

export function SignatureDrawing({
  strokes,
  format,
}: SignatureDrawingProps) {
  const inkFilterId = `signature-ink-${useId().replace(/:/g, '')}`
  const hasNaturalEffect = format.effect !== 'clean'

  return (
    <>
      {hasNaturalEffect && (
        <defs>
          <filter
            id={inkFilterId}
            x="-5%"
            y="-15%"
            width="110%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.045"
              numOctaves={2}
              seed={17}
              result="inkNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="inkNoise"
              scale={Math.max(0.6, format.strokeWidth * 0.16)}
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      )}
      <g filter={hasNaturalEffect ? `url(#${inkFilterId})` : undefined}>
        {strokes.map((stroke, strokeIndex) => {
          const averagePressure =
            stroke.reduce((total, point) => total + point.pressure, 0) /
            Math.max(stroke.length, 1)
          const strokeWidth = format.strokeWidth * (0.85 + averagePressure * 0.3)

          if (stroke.length === 1) {
            const pointWidth = hasNaturalEffect
              ? format.strokeWidth *
                (0.72 + stroke[0].pressure * 0.56) *
                (0.94 + getNaturalInkVariation(strokeIndex, 0) * 0.12)
              : strokeWidth

            return (
              <circle
                key={strokeIndex}
                cx={stroke[0].x * 1000}
                cy={stroke[0].y * 300}
                r={pointWidth / 2}
                fill={format.color}
              />
            )
          }

          if (hasNaturalEffect) {
            const segmentCount = stroke.length - 1

            return (
              <g key={strokeIndex}>
                {stroke.slice(1).map((point, segmentIndex) => {
                  const previousPoint = stroke[segmentIndex]
                  const pressure = (previousPoint.pressure + point.pressure) / 2
                  const edgeDistance = Math.min(
                    segmentIndex + 1,
                    segmentCount - segmentIndex,
                  )
                  const taper = Math.min(1, 0.68 + edgeDistance * 0.14)
                  const variation = getNaturalInkVariation(
                    strokeIndex,
                    segmentIndex,
                  )
                  const opacityVariation = getNaturalInkVariation(
                    strokeIndex + 31,
                    segmentIndex,
                  )
                  const naturalStrokeWidth =
                    format.strokeWidth *
                    (0.72 + pressure * 0.56) *
                    (0.94 + variation * 0.12) *
                    taper

                  return (
                    <path
                      key={segmentIndex}
                      d={`M ${(previousPoint.x * 1000).toFixed(2)} ${(previousPoint.y * 300).toFixed(2)} L ${(point.x * 1000).toFixed(2)} ${(point.y * 300).toFixed(2)}`}
                      fill="none"
                      stroke={format.color}
                      strokeWidth={naturalStrokeWidth}
                      strokeOpacity={0.9 + opacityVariation * 0.1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )
                })}
              </g>
            )
          }

          return (
            <path
              key={strokeIndex}
              d={getSignaturePath(stroke)}
              fill="none"
              stroke={format.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
      </g>
    </>
  )
}

export function SignatureMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: SignatureMarkProps) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const x = Math.min(annotation.start.x, annotation.end.x)
  const y = Math.min(annotation.start.y, annotation.end.y)
  const width = Math.abs(annotation.end.x - annotation.start.x)
  const height = Math.abs(annotation.end.y - annotation.start.y)

  const handleMoveStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<HTMLSpanElement>,
    handle: ResizeHandle,
  ) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeStart?.(event, savedAnnotation, handle)
  }

  return (
    <div
      className={[
        'signature-annotation',
        isSelected && 'signature-annotation--selected',
        isDraft && 'signature-annotation--draft',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        zIndex: savedAnnotation?.layer ?? 10000,
      }}
      onPointerDown={savedAnnotation ? handleMoveStart : undefined}
      onClick={(event) => event.stopPropagation()}
      title={savedAnnotation ? 'Arrastra para mover la firma' : undefined}
    >
      <svg
        className="signature-annotation-drawing"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <SignatureDrawing
          strokes={annotation.strokes}
          format={annotation.format}
        />
      </svg>
      {isSelected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
          <span
            key={handle}
            className={`signature-resize-handle signature-resize-handle--${handle}`}
            onPointerDown={(event) => handleResizeStart(event, handle)}
            onClick={(event) => event.stopPropagation()}
            aria-hidden="true"
          />
        ))}
    </div>
  )
}
