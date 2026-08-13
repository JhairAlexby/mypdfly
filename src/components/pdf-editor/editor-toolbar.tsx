import {
  Blend,
  ChevronDown,
  Download,
  Files,
  LoaderCircle,
  MousePointer2,
  Move,
  Shapes,
  Signature as SignatureIcon,
  Trash2,
  Type,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

import { shapeOptions, toolLabels } from './constants'
import type { Annotation, EditorTool, ShapeTool } from './types'

export type EditorToolbarProps = {
  activeTool: EditorTool
  selectedAnnotation: Annotation | null
  hasPages: boolean
  isExporting: boolean
  onToggleText: () => void
  onSelectShape: (shape: ShapeTool) => void
  onToggleBlur: () => void
  onOpenSignature: () => void
  onOpenOrganizer: () => void
  onRemoveSelected: () => void
  onDownload: () => void
}

export function EditorToolbar({
  activeTool,
  selectedAnnotation,
  hasPages,
  isExporting,
  onToggleText,
  onSelectShape,
  onToggleBlur,
  onOpenSignature,
  onOpenOrganizer,
  onRemoveSelected,
  onDownload,
}: EditorToolbarProps) {
  const shapeToolActive =
    activeTool !== null &&
    activeTool !== 'text' &&
    activeTool !== 'blur' &&
    activeTool !== 'signature'

  return (
    <div className="editor-toolbar" aria-label="Herramientas de edición">
      <div className="flex min-w-max items-center gap-1.5">
        <Button
          variant={activeTool === 'text' ? 'secondary' : 'ghost'}
          size="sm"
          className={activeTool === 'text' ? 'editor-tool-active' : ''}
          onClick={onToggleText}
          aria-pressed={activeTool === 'text'}
        >
          <Type data-icon="inline-start" />
          Texto
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={shapeToolActive ? 'secondary' : 'ghost'}
              size="sm"
              className={shapeToolActive ? 'editor-tool-active' : ''}
              aria-pressed={shapeToolActive}
            >
              <Shapes data-icon="inline-start" />
              Formas
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 p-1.5">
            <DropdownMenuLabel>Selecciona una forma</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {shapeOptions.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                className="h-9 gap-2 px-2"
                onSelect={() => onSelectShape(value)}
              >
                <Icon />
                {label}
                {activeTool === value && (
                  <span className="ml-auto size-1.5 rounded-full bg-[#ff5a45]" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={activeTool === 'blur' ? 'secondary' : 'ghost'}
          size="sm"
          className={activeTool === 'blur' ? 'editor-tool-active' : ''}
          onClick={onToggleBlur}
          aria-pressed={activeTool === 'blur'}
        >
          <Blend data-icon="inline-start" />
          Difuminar
        </Button>

        <Button
          variant={activeTool === 'signature' ? 'secondary' : 'ghost'}
          size="sm"
          className={activeTool === 'signature' ? 'editor-tool-active' : ''}
          onClick={onOpenSignature}
          aria-pressed={activeTool === 'signature'}
        >
          <SignatureIcon data-icon="inline-start" />
          Firma
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenOrganizer}
          disabled={!hasPages}
        >
          <Files data-icon="inline-start" />
          Unir y ordenar
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemoveSelected}
          disabled={!selectedAnnotation}
          aria-label="Eliminar elemento seleccionado"
        >
          <Trash2 aria-hidden="true" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={!hasPages || isExporting}
          aria-busy={isExporting}
        >
          {isExporting ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {isExporting ? 'Preparando…' : 'Descargar'}
        </Button>
      </div>

      <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
        {activeTool ? (
          <>
            <MousePointer2
              className="size-3.5 text-[#ff5a45]"
              aria-hidden="true"
            />
            {activeTool === 'text'
              ? 'Haz clic en la página y escribe'
              : activeTool === 'blur'
                ? 'Arrastra sobre la sección que quieres ocultar'
                : activeTool === 'signature'
                  ? 'Haz clic o arrastra donde quieres colocar la firma'
                  : 'Haz clic y arrastra para dibujar'}
            <Badge
              variant="secondary"
              className="ml-1 rounded-full px-2 text-[11px]"
            >
              {toolLabels[activeTool]}
            </Badge>
          </>
        ) : selectedAnnotation ? (
          <>
            <Move className="size-3.5 text-blue-600" aria-hidden="true" />
            {selectedAnnotation.type === 'text'
              ? 'Arrastra para mover · Doble clic para editar'
              : selectedAnnotation.type === 'blur'
                ? 'Arrastra el área difuminada · Usa las esquinas para ajustar'
                : selectedAnnotation.type === 'signature'
                  ? 'Arrastra la firma · Usa las esquinas para ajustar'
                  : 'Arrastra para mover · Usa los puntos azules para redimensionar'}
          </>
        ) : (
          'Selecciona Texto, Formas, Difuminar o Firma para comenzar'
        )}
      </div>
    </div>
  )
}
