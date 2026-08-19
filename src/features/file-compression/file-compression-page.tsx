import { ArrowLeft, FileArchive } from 'lucide-react'

import { Button } from '@/components/ui/button'

type FileCompressionPageProps = {
  homeHref: string
}

export function FileCompressionPage({
  homeHref,
}: FileCompressionPageProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      aria-labelledby="compression-title"
    >
      <section className="w-full rounded-[1.75rem] border border-slate-200/90 bg-white p-5 shadow-[0_24px_70px_rgba(39,45,76,0.1)] sm:p-8 lg:p-10">
        <Button
          asChild
          variant="ghost"
          className="-ml-2 rounded-lg text-slate-600"
        >
          <a href={homeHref}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Volver al editor
          </a>
        </Button>

        <div className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] sm:size-20">
            <FileArchive className="size-7 sm:size-9" aria-hidden="true" />
          </span>
          <h1
            id="compression-title"
            className="mt-6 text-balance text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl"
          >
            Comprimir archivos
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Aquí podrás reducir el tamaño de archivos PDF, PNG y JPG sin que salgan de tu navegador.
          </p>

          <div className="mt-8 grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 sm:min-h-52">
            <p className="max-w-sm text-sm text-slate-500">
              La selección de archivos se agregará en el siguiente paso.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
