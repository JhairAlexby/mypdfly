import { AlertCircle, Eye, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useFileCompression } from './hooks/use-file-compression'
import { CompressionDashboard } from './components/compression-dashboard'
import { FileUploadPanel } from './components/file-upload-panel'

type FileCompressionPageProps = {
  homeHref?: string
}

export function FileCompressionPage({
  homeHref: _homeHref = '/',
}: FileCompressionPageProps) {
  const compression = useFileCompression()

  if (compression.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card className="gap-0 rounded-[1.75rem] border-0 bg-white py-0 shadow-[0_30px_90px_rgba(43,50,87,0.14)] ring-1 ring-slate-200/80">
          <CardHeader className="px-5 pt-6 pb-4 text-center sm:px-8 sm:pt-8">
            <CardTitle className="text-xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-2xl">
              Comprime tus archivos
            </CardTitle>
            <CardDescription className="mt-1 text-sm sm:text-base">
              Selecciónalos o arrástralos a esta ventana
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
            <FileUploadPanel
              isInspecting={compression.isInspecting}
              onSelectFiles={(files) => void compression.selectFiles(files)}
            />

            {compression.issues.length > 0 && (
              <div className="mt-4 space-y-2" aria-live="polite">
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
                      className="absolute top-2 right-2 text-red-700 hover:bg-red-100 hover:text-red-900"
                      onClick={() => compression.dismissIssue(issue.id)}
                      aria-label="Cerrar aviso"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-center gap-2 rounded-b-[1.75rem] border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-center text-xs text-slate-500">
            <Eye className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            Tus archivos se procesan localmente y nunca se suben a un servidor.
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-start px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="w-full">
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
                  className="absolute top-2 right-2 text-red-700 hover:bg-red-100 hover:text-red-900"
                  onClick={() => compression.dismissIssue(issue.id)}
                  aria-label="Cerrar aviso"
                >
                  <X aria-hidden="true" />
                </Button>
              </Alert>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
