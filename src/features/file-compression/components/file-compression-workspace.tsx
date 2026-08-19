import { AlertCircle, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useFileCompression } from '@/features/file-compression/hooks/use-file-compression'
import { CompressionDashboard } from './compression-dashboard'
import { FileUploadPanel } from './file-upload-panel'

export function FileCompressionWorkspace() {
  const compression = useFileCompression()

  return (
    <div className="mt-8 sm:mt-10">
      {compression.items.length ? (
        <CompressionDashboard
          archiveState={compression.archiveState}
          batchProgress={compression.batchProgress}
          batchStatus={compression.batchStatus}
          generalError={compression.generalError}
          isInspecting={compression.isInspecting}
          itemStates={compression.itemStates}
          items={compression.items}
          pngLevel={compression.pngLevel}
          quality={compression.quality}
          successfulCount={compression.successfulCount}
          onAddFiles={(files) => void compression.selectFiles(files, true)}
          onCancelArchive={compression.cancelArchive}
          onCancelBatch={compression.cancelBatch}
          onClear={compression.clearSelection}
          onCompress={() => void compression.compress()}
          onDownloadAll={() => void compression.downloadAll()}
          onDownloadResult={compression.downloadResult}
          onPngLevelChange={compression.setPngLevel}
          onQualityChange={compression.setQuality}
          onRemoveItem={compression.removeItem}
        />
      ) : (
        <FileUploadPanel
          isInspecting={compression.isInspecting}
          onSelectFiles={(files) => void compression.selectFiles(files)}
        />
      )}

      {compression.issues.length > 0 && (
        <div className="mx-auto mt-4 max-w-3xl space-y-2" aria-live="polite">
          {compression.issues.map((issue) => (
            <Alert
              key={issue.id}
              variant="destructive"
              className="border-red-200 bg-red-50 px-3 py-2.5 pr-12"
            >
              <AlertCircle aria-hidden="true" />
              <AlertTitle className="truncate" title={issue.fileName}>
                {issue.fileName}
              </AlertTitle>
              <AlertDescription>{issue.message}</AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 text-red-500 hover:bg-red-100 hover:text-red-700"
                aria-label={`Ocultar error de ${issue.fileName}`}
                onClick={() => compression.dismissIssue(issue.id)}
              >
                <X aria-hidden="true" />
              </Button>
            </Alert>
          ))}
        </div>
      )}
    </div>
  )
}
