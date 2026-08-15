import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export type PageDeleteTarget = {
  id: string
  displayNumber: number
  sourceName: string
  sourcePageNumber: number
}

type PageDeleteDialogProps = {
  target: PageDeleteTarget | null
  onOpenChange: (open: boolean) => void
  onConfirm: (pageId: string) => void
}

export function PageDeleteDialog({
  target,
  onOpenChange,
  onConfirm,
}: PageDeleteDialogProps) {
  return (
    <AlertDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar página {target?.displayNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se quitará la página original {target?.sourcePageNumber} de{' '}
            {target?.sourceName}, junto con sus anotaciones, del documento que
            exportes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={() => {
              if (!target) return
              onConfirm(target.id)
              onOpenChange(false)
            }}
          >
            <Button type="button" variant="destructive">
              Eliminar página
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
