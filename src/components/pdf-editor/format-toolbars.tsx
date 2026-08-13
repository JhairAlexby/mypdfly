import {
  Bold,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Feather,
  Italic,
  Layers,
  LayersArrowDown,
  LayersArrowUp,
  Minus,
  Palette,
  PenLine,
  RotateCcw,
  Underline,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'

import {
  defaultBlurFormat,
  defaultShapeFormat,
  defaultTextFormat,
  fontFamilies,
  fontSizes,
  shapeStrokeWidths,
  textColors,
} from './constants'
import type {
  BlurFormat,
  LayerAction,
  ShapeFormat,
  SignatureAnnotation,
  SignatureFormat,
  TextFontFamily,
  TextFormat,
} from './types'

export type TextFormatToolbarProps = {
  visible: boolean
  format: TextFormat
  onFormatChange: (patch: Partial<TextFormat>) => void
}

export function TextFormatToolbar({
  visible,
  format,
  onFormatChange,
}: TextFormatToolbarProps) {
  if (!visible) return null

  return (
    <div
      className="text-format-toolbar"
      role="toolbar"
      aria-label="Formato de texto"
    >
      <span className="text-format-label">Formato</span>

      <Select
        value={format.fontFamily}
        onValueChange={(value) =>
          onFormatChange({ fontFamily: value as TextFontFamily })
        }
      >
        <SelectTrigger
          size="sm"
          className="text-font-select"
          aria-label="Familia tipográfica"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {fontFamilies.map((font) => (
            <SelectItem
              key={font.value}
              value={font.value}
              style={{ fontFamily: font.css }}
            >
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(format.fontSize)}
        onValueChange={(value) =>
          onFormatChange({ fontSize: Number(value) })
        }
      >
        <SelectTrigger
          size="sm"
          className="text-size-select"
          aria-label="Tamaño de letra"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-24">
          {fontSizes.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} pt
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-color-trigger"
            aria-label="Cambiar color del texto"
          >
            <Palette data-icon="inline-start" />
            <span
              className="text-color-current"
              style={{ backgroundColor: format.color }}
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 gap-3 p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Color del texto</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Selecciona un color o crea uno personalizado.
            </p>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {textColors.map((color) => (
              <Button
                key={color}
                variant="outline"
                size="icon-sm"
                className={`text-color-swatch ${format.color === color ? 'text-color-swatch--active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onFormatChange({ color })}
                aria-label={`Usar color ${color}`}
              />
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
            Personalizado
            <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-slate-500">
              {format.color.toUpperCase()}
              <Input
                type="color"
                className="h-8 w-10 cursor-pointer p-1"
                value={format.color}
                onChange={(event) =>
                  onFormatChange({ color: event.target.value })
                }
                aria-label="Elegir color personalizado"
              />
            </span>
          </label>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <div className="flex items-center gap-1" aria-label="Estilo de letra">
        <Button
          variant={format.bold ? 'secondary' : 'outline'}
          size="icon-sm"
          className={format.bold ? 'text-format-active' : ''}
          onClick={() => onFormatChange({ bold: !format.bold })}
          aria-label="Negrita"
          aria-pressed={format.bold}
        >
          <Bold aria-hidden="true" />
        </Button>
        <Button
          variant={format.italic ? 'secondary' : 'outline'}
          size="icon-sm"
          className={format.italic ? 'text-format-active' : ''}
          onClick={() => onFormatChange({ italic: !format.italic })}
          aria-label="Cursiva"
          aria-pressed={format.italic}
        >
          <Italic aria-hidden="true" />
        </Button>
        <Button
          variant={format.underline ? 'secondary' : 'outline'}
          size="icon-sm"
          className={format.underline ? 'text-format-active' : ''}
          onClick={() => onFormatChange({ underline: !format.underline })}
          aria-label="Subrayado"
          aria-pressed={format.underline}
        >
          <Underline aria-hidden="true" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onFormatChange(defaultTextFormat)}
        aria-label="Restablecer formato"
        title="Restablecer formato"
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </div>
  )
}

type LayerPositionMenuProps = {
  ariaLabel: string
  disabled?: boolean
  onLayerChange: (action: LayerAction) => void
}

function LayerPositionMenu({
  ariaLabel,
  disabled,
  onLayerChange,
}: LayerPositionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shape-position-trigger"
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <Layers data-icon="inline-start" />
          Posición
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1.5">
        <DropdownMenuLabel>Orden de la capa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-9 gap-2 px-2"
          onSelect={() => onLayerChange('front')}
        >
          <ChevronsUp />
          Traer al frente
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-9 gap-2 px-2"
          onSelect={() => onLayerChange('forward')}
        >
          <LayersArrowUp />
          Subir un nivel
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-9 gap-2 px-2"
          onSelect={() => onLayerChange('backward')}
        >
          <LayersArrowDown />
          Bajar un nivel
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-9 gap-2 px-2"
          onSelect={() => onLayerChange('back')}
        >
          <ChevronsDown />
          Enviar al fondo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type ShapeFormatToolbarProps = {
  visible: boolean
  format: ShapeFormat
  hasSelectedShape: boolean
  onFormatChange: (patch: Partial<ShapeFormat>) => void
  onLayerChange: (action: LayerAction) => void
}

export function ShapeFormatToolbar({
  visible,
  format,
  hasSelectedShape,
  onFormatChange,
  onLayerChange,
}: ShapeFormatToolbarProps) {
  if (!visible) return null

  return (
    <div
      className="shape-format-toolbar"
      role="toolbar"
      aria-label="Formato de formas"
    >
      <span className="shape-format-label">Forma</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="shape-color-trigger"
            aria-label="Cambiar color de la forma"
          >
            <Palette data-icon="inline-start" />
            Color
            <span
              className="shape-color-current"
              style={{ backgroundColor: format.color }}
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 gap-3 p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Color de la forma
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Se aplicará al borde y al relleno.
            </p>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {textColors.map((color) => (
              <Button
                key={color}
                variant="outline"
                size="icon-sm"
                className={`shape-color-swatch ${format.color === color ? 'shape-color-swatch--active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onFormatChange({ color })}
                aria-label={`Usar color ${color} en la forma`}
              />
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
            Personalizado
            <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-slate-500">
              {format.color.toUpperCase()}
              <Input
                type="color"
                className="h-8 w-10 cursor-pointer p-1"
                value={format.color}
                onChange={(event) =>
                  onFormatChange({ color: event.target.value })
                }
                aria-label="Elegir color personalizado para la forma"
              />
            </span>
          </label>
        </PopoverContent>
      </Popover>

      <div className="shape-opacity-control">
        <span className="shape-control-label">Opacidad</span>
        <Slider
          className="w-28"
          min={10}
          max={100}
          step={5}
          value={[Math.round(format.opacity * 100)]}
          onValueChange={(value) =>
            onFormatChange({ opacity: (value[0] ?? 100) / 100 })
          }
          aria-label="Opacidad de la forma"
        />
        <span className="shape-control-value">
          {Math.round(format.opacity * 100)}%
        </span>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Select
        value={String(format.strokeWidth)}
        onValueChange={(value) =>
          onFormatChange({ strokeWidth: Number(value) })
        }
      >
        <SelectTrigger
          size="sm"
          className="shape-width-select"
          aria-label="Ancho del borde"
        >
          <Minus className="size-3.5" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-36">
          {shapeStrokeWidths.map((width) => (
            <SelectItem key={width} value={String(width)}>
              {width} px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <LayerPositionMenu
        ariaLabel="Cambiar posición de la forma"
        disabled={!hasSelectedShape}
        onLayerChange={onLayerChange}
      />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onFormatChange(defaultShapeFormat)}
        aria-label="Restablecer formato de la forma"
        title="Restablecer formato"
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </div>
  )
}

export type BlurFormatToolbarProps = {
  visible: boolean
  format: BlurFormat
  hasSelectedBlur: boolean
  onFormatChange: (patch: Partial<BlurFormat>) => void
  onLayerChange: (action: LayerAction) => void
}

export function BlurFormatToolbar({
  visible,
  format,
  hasSelectedBlur,
  onFormatChange,
  onLayerChange,
}: BlurFormatToolbarProps) {
  if (!visible) return null

  return (
    <div
      className="blur-format-toolbar"
      role="toolbar"
      aria-label="Formato del difuminado"
    >
      <span className="blur-format-label">Difuminado</span>

      <div className="blur-intensity-control">
        <span className="blur-control-label">Intensidad</span>
        <Slider
          className="w-36"
          min={4}
          max={24}
          step={1}
          value={[format.intensity]}
          onValueChange={(value) =>
            onFormatChange({ intensity: value[0] ?? 12 })
          }
          aria-label="Intensidad del difuminado"
        />
        <span className="blur-control-value">{format.intensity} px</span>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <LayerPositionMenu
        ariaLabel="Cambiar posición del área difuminada"
        disabled={!hasSelectedBlur}
        onLayerChange={onLayerChange}
      />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onFormatChange(defaultBlurFormat)}
        aria-label="Restablecer intensidad del difuminado"
        title="Restablecer intensidad"
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </div>
  )
}

export type SignatureFormatToolbarProps = {
  signature: SignatureAnnotation | null
  onFormatChange: (patch: Partial<SignatureFormat>) => void
  onLayerChange: (action: LayerAction) => void
  onCreateAnother: () => void
}

export function SignatureFormatToolbar({
  signature,
  onFormatChange,
  onLayerChange,
  onCreateAnother,
}: SignatureFormatToolbarProps) {
  if (!signature) return null

  return (
    <div
      className="signature-format-toolbar"
      role="toolbar"
      aria-label="Formato de la firma"
    >
      <span className="signature-format-label">Firma</span>

      <div className="signature-color-control">
        <span className="signature-control-label">Tinta</span>
        {['#111827', '#1d4ed8'].map((color) => (
          <Button
            key={color}
            type="button"
            variant="outline"
            size="icon-sm"
            className={`signature-ink-swatch ${signature.format.color === color ? 'signature-ink-swatch--active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onFormatChange({ color })}
            aria-label={color === '#111827' ? 'Tinta negra' : 'Tinta azul'}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <div className="signature-width-control">
        <span className="signature-control-label">Grosor</span>
        <Slider
          className="signature-width-slider"
          min={2}
          max={14}
          step={1}
          value={[signature.format.strokeWidth]}
          onValueChange={(value) =>
            onFormatChange({
              strokeWidth: value[0] ?? signature.format.strokeWidth,
            })
          }
          aria-label="Grosor de la firma seleccionada"
        />
        <span className="signature-control-value">
          {signature.format.strokeWidth} px
        </span>
      </div>

      <Button
        type="button"
        variant={signature.format.effect !== 'clean' ? 'secondary' : 'outline'}
        size="sm"
        className={
          signature.format.effect !== 'clean' ? 'signature-natural-active' : ''
        }
        onClick={() =>
          onFormatChange({
            effect:
              signature.format.effect !== 'clean' ? 'clean' : 'natural',
          })
        }
        aria-pressed={signature.format.effect !== 'clean'}
        title="Añade variaciones sutiles de presión y tinta"
      >
        <Feather data-icon="inline-start" />
        Tinta natural
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <LayerPositionMenu
        ariaLabel="Cambiar posición de la firma"
        onLayerChange={onLayerChange}
      />

      <Button variant="outline" size="sm" onClick={onCreateAnother}>
        <PenLine data-icon="inline-start" />
        Crear otra
      </Button>
    </div>
  )
}
