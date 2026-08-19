import { createImageEncoder } from '@/lib/files/image-encoders'
import { ExportCancelledError } from './export-cancellation'

export {
  DEFAULT_JPEG_QUALITY,
  type ImageEncoderOptions,
  type ImageFormat,
} from '@/lib/files/image-encoders'

const exportImageEncoder = createImageEncoder(
  () => new ExportCancelledError(),
)

export const encodeCanvasAsImage = exportImageEncoder.encodeCanvasAsImage
export const encodeCanvasToJpeg = exportImageEncoder.encodeCanvasToJpeg
export const encodeCanvasToPng = exportImageEncoder.encodeCanvasToPng
