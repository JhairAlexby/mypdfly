import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Grip, LayoutGrid } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ImageAsset } from '../core/document'
import { getImageFilterCss } from '../core/image-filters'
import {
  getCompositionPageSizeMm,
  movePlacementRect,
  resizePlacementFromCorner,
  type CompositionPoint,
  type PlacementResizeHandle,
} from './geometry'
import type {
  CompositionPageOrientation,
  ImageCompositionPage,
  ImagePlacement,
  NormalizedPlacementRect,
} from './model'

type ComposerWorkspaceProps = {
  readonly assets: readonly ImageAsset[]
  readonly disabled?: boolean
  readonly onAutoLayout: () => void
  readonly onChangeOrientation: (orientation: CompositionPageOrientation) => void
  readonly onChangePlacement: (
    placementId: string,
    rect: NormalizedPlacementRect,
  ) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onSelectPlacement: (placementId: string | null) => void
  readonly page: ImageCompositionPage
  readonly pageCount: number
  readonly pageIndex: number
  readonly selectedPlacementId: string | null
}

type Interaction = {
  readonly handle?: PlacementResizeHandle
  readonly mode: 'move' | 'resize'
  readonly placementId: string
  readonly pointerId: number
  readonly startPoint: CompositionPoint
  readonly startRect: NormalizedPlacementRect
  lastRect: NormalizedPlacementRect
}

type DraftPlacement = {
  readonly id: string
  readonly rect: NormalizedPlacementRect
}

const RESIZE_HANDLES: readonly PlacementResizeHandle[] = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
]

const getHandlePositionClass = (handle: PlacementResizeHandle) => {
  if (handle === 'top-left') return 'left-0 top-0 -translate-x-1/2 -translate-y-1/2'
  if (handle === 'top-right') return 'right-0 top-0 translate-x-1/2 -translate-y-1/2'
  if (handle === 'bottom-right') return 'bottom-0 right-0 translate-x-1/2 translate-y-1/2'
  return 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
}

const getHandleCursor = (handle: PlacementResizeHandle) => {
  if (handle === 'top-left' || handle === 'bottom-right') return 'nwse-resize'
  return 'nesw-resize'
}

const getHandleLabel = (handle: PlacementResizeHandle) => {
  const labels: Record<PlacementResizeHandle, string> = {
    'bottom-left': 'esquina inferior izquierda',
    'bottom-right': 'esquina inferior derecha',
    'top-left': 'esquina superior izquierda',
    'top-right': 'esquina superior derecha',
  }
  return labels[handle]
}

const getNormalizedPointer = (
  event: { readonly clientX: number; readonly clientY: number },
  bounds: DOMRect,
): CompositionPoint => ({
  x: (event.clientX - bounds.left) / bounds.width,
  y: (event.clientY - bounds.top) / bounds.height,
})

export function ComposerWorkspace({
  assets,
  disabled = false,
  onAutoLayout,
  onChangeOrientation,
  onChangePlacement,
  onNextPage,
  onPreviousPage,
  onSelectPlacement,
  page,
  pageCount,
  pageIndex,
  selectedPlacementId,
}: ComposerWorkspaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [draft, setDraft] = useState<DraftPlacement | null>(null)
  const assetsById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  )
  const pageSize = getCompositionPageSizeMm(page)

  const getPlacementRect = (placement: ImagePlacement) =>
    draft?.id === placement.id ? draft.rect : placement

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    placement: ImagePlacement,
    mode: Interaction['mode'],
    handle?: PlacementResizeHandle,
  ) => {
    if (disabled) return
    const surface = surfaceRef.current
    if (!surface) return
    const bounds = surface.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    event.preventDefault()
    event.stopPropagation()
    const point = getNormalizedPointer(event, bounds)
    interactionRef.current = {
      handle,
      lastRect: placement,
      mode,
      placementId: placement.id,
      pointerId: event.pointerId,
      startPoint: point,
      startRect: placement,
    }
    surface.setPointerCapture(event.pointerId)
    onSelectPlacement(placement.id)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    const surface = surfaceRef.current
    if (
      disabled ||
      !interaction ||
      interaction.pointerId !== event.pointerId ||
      !surface
    ) {
      return
    }
    const bounds = surface.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const point = getNormalizedPointer(event, bounds)
    const nextRect =
      interaction.mode === 'move'
        ? movePlacementRect(interaction.startRect, {
            x: point.x - interaction.startPoint.x,
            y: point.y - interaction.startPoint.y,
          })
        : resizePlacementFromCorner(
            interaction.startRect,
            interaction.handle!,
            point,
            { lockAspectRatio: true },
          )
    interaction.lastRect = nextRect
    setDraft({ id: interaction.placementId, rect: nextRect })
  }

  const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    const surface = surfaceRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (surface?.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId)
    }
    onChangePlacement(interaction.placementId, interaction.lastRect)
    setDraft(null)
    interactionRef.current = null
  }

  const handlePlacementKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    placement: ImagePlacement,
  ) => {
    if (disabled) return
    const step = event.shiftKey ? 0.05 : 0.01
    const delta =
      event.key === 'ArrowLeft'
        ? { x: -step, y: 0 }
        : event.key === 'ArrowRight'
          ? { x: step, y: 0 }
          : event.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : event.key === 'ArrowDown'
              ? { x: 0, y: step }
              : null
    if (!delta) return
    event.preventDefault()
    onSelectPlacement(placement.id)
    onChangePlacement(placement.id, movePlacementRect(getPlacementRect(placement), delta))
  }

  const handleSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onSelectPlacement(null)
  }

  const marginX = (page.marginMm / pageSize.width) * 100
  const marginY = (page.marginMm / pageSize.height) * 100

  return (
    <section
      aria-labelledby="composition-workspace-title"
      data-testid="composition-workspace"
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-white text-[#e84c38] shadow-sm ring-1 ring-slate-200">
            <LayoutGrid className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="composition-workspace-title" className="text-sm font-semibold text-slate-950">
              Composición de hojas
            </h2>
            <p className="text-xs text-slate-500">
              Arrastra una imagen para moverla y usa sus esquinas para cambiar su tamaño.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg bg-white"
            onClick={onAutoLayout}
            disabled={disabled}
          >
            <LayoutGrid data-icon="inline-start" aria-hidden="true" />
            Reorganizar
          </Button>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Orientación
            <select
              aria-label="Orientación de hoja"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
              value={page.orientation}
              onChange={(event) =>
                onChangeOrientation(event.target.value as CompositionPageOrientation)
              }
              disabled={disabled}
            >
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-lg text-slate-600"
          onClick={onPreviousPage}
          disabled={disabled || pageIndex === 0}
          aria-label="Hoja anterior"
        >
          <ChevronLeft data-icon="inline-start" aria-hidden="true" />
          Anterior
        </Button>
        <span className="text-xs font-medium text-slate-500">
          Hoja {pageIndex + 1} de {pageCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-lg text-slate-600"
          onClick={onNextPage}
          disabled={disabled || pageIndex === pageCount - 1}
          aria-label="Hoja siguiente"
        >
          Siguiente
          <ChevronRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>

      <div
        ref={surfaceRef}
        className="relative mx-auto w-full max-w-3xl touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
        style={{ aspectRatio: String(pageSize.width) + ' / ' + String(pageSize.height) }}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
      >
        <div
          className="absolute overflow-visible bg-white"
          style={{
            height: String(100 - marginY * 2) + '%',
            left: String(marginX) + '%',
            top: String(marginY) + '%',
            width: String(100 - marginX * 2) + '%',
          }}
        >
          {page.placements.map((placement) => {
            const asset = assetsById.get(placement.assetId)
            if (!asset) return null
            const rect = getPlacementRect(placement)
            const selected = selectedPlacementId === placement.id
            return (
              <div
                key={placement.id}
                role="button"
                tabIndex={0}
                aria-label={'Imagen ' + asset.file.name}
                className={'absolute overflow-visible rounded-lg outline-none transition-shadow ' + (
                  selected
                    ? 'z-20 shadow-[0_0_0_2px_#ff5a45,0_8px_20px_rgba(15,23,42,0.16)]'
                    : 'z-10 shadow-[0_3px_10px_rgba(15,23,42,0.12)] hover:shadow-[0_0_0_2px_#cbd5e1,0_8px_20px_rgba(15,23,42,0.14)]'
                )}
                style={{
                  height: String(rect.height * 100) + '%',
                  left: String(rect.x * 100) + '%',
                  top: String(rect.y * 100) + '%',
                  width: String(rect.width * 100) + '%',
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectPlacement(placement.id)
                }}
                onKeyDown={(event) => handlePlacementKeyDown(event, placement)}
                onPointerDown={(event) => beginInteraction(event, placement, 'move')}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-1">
                  <img
                    src={asset.previewUrl}
                    alt={asset.file.name}
                    className="h-full w-full object-contain"
                    draggable={false}
                    style={{
                      filter: getImageFilterCss(asset.filter),
                      transform: 'rotate(' + String(asset.rotation + placement.rotation) + 'deg)',
                    }}
                  />
                </div>
                {selected && (
                  <>
                    <span className="pointer-events-none absolute -top-7 left-0 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
                      {asset.file.name}
                    </span>
                    {RESIZE_HANDLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        className={'absolute z-30 grid size-4 place-items-center rounded-full border-2 border-white bg-[#ff5a45] shadow-md outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ' + getHandlePositionClass(handle)}
                        style={{ cursor: getHandleCursor(handle) }}
                        aria-label={'Redimensionar ' + asset.file.name + ' desde la ' + getHandleLabel(handle)}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) =>
                          beginInteraction(event, placement, 'resize', handle)
                        }
                      >
                        <Grip className="pointer-events-none size-2.5 text-white" aria-hidden="true" />
                      </button>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Seleccionada: {selectedPlacementId ? 'sí' : 'ninguna'} · Usa las flechas para ajustes finos y Shift para mover más rápido.
      </p>
    </section>
  )
}
