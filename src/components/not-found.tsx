import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type NotFoundProps = {
  homeHref?: string
  onGoBack?: () => void
}

export function NotFound({
  homeHref = '/',
  onGoBack,
}: NotFoundProps) {
  return (
    <main
      className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16 sm:px-6 sm:py-20"
      aria-labelledby="not-found-title"
    >
      <div className="w-full max-w-xl text-center">
        <Badge
          variant="outline"
          className="rounded-full border-[#ffc5bc] bg-[#fff4f1] px-4 py-1.5 font-mono text-[0.68rem] tracking-[0.16em] text-[#c83625] uppercase"
        >
          RUTA NO ENCONTRADA
        </Badge>

        <h1
          id="not-found-title"
          className="mt-6 text-balance text-4xl leading-tight font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl"
        >
          Falta una página.
          <span className="mt-1 block text-[#e84c38]">No tu documento.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-pretty text-base leading-7 text-slate-600 sm:text-lg">
          La dirección que abriste no forma parte de mypdfly. Puedes volver al editor con total tranquilidad: tus archivos siguen en tu dispositivo.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
          >
            <a href={homeHref}>Volver al editor</a>
          </Button>
          {onGoBack && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 rounded-xl border-slate-300 bg-white px-5"
              onClick={onGoBack}
            >
              Regresar
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
