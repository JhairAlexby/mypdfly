import { ImageCompressionEditor } from './image-compression-editor'
import { ImageCompressionResult } from './image-compression-result'
import { ImageUploadPanel } from './image-upload-panel'
import { useImageCompression } from '@/features/file-compression/hooks/use-image-compression'

export function ImageCompressionWorkspace() {
  const {
    cancel,
    clearSelection,
    compress,
    jobState,
    jpegQuality,
    pngLevel,
    resetResult,
    selection,
    selectFile,
    setJpegQuality,
    setPngLevel,
  } = useImageCompression()
  const isJobActive =
    jobState.status === 'validating' ||
    jobState.status === 'ready' ||
    jobState.status === 'processing'

  return (
    <div className="mt-8 sm:mt-10">
      {selection.status !== 'ready' ? (
        <ImageUploadPanel
          selection={selection}
          onSelectFile={(file) => void selectFile(file)}
        />
      ) : jobState.status === 'success' ? (
        <ImageCompressionResult
          jpegQuality={jpegQuality}
          pngLevel={pngLevel}
          result={jobState.result}
          selection={selection}
          onClear={clearSelection}
          onReset={resetResult}
        />
      ) : (
        <ImageCompressionEditor
          isJobActive={isJobActive}
          jpegQuality={jpegQuality}
          jobState={jobState}
          pngLevel={pngLevel}
          selection={selection}
          onCancel={cancel}
          onClear={clearSelection}
          onCompress={() => void compress()}
          onJpegQualityChange={setJpegQuality}
          onPngLevelChange={setPngLevel}
        />
      )}
    </div>
  )
}
