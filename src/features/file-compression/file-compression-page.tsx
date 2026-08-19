import { ArrowLeft, FileArchive } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ImageCompressionWorkspace } from './components/image-compression-workspace'

type FileCompressionPageProps = {
  homeHref: string
}

export function FileCompressionPage({
  homeHref,
}: FileCompressionPageProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 items-start px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
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

        <div className="mx-auto mt-8 max-w-2xl text-center sm:mt-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] sm:size-16">
            <FileArchive className="size-7 sm:size-8" aria-hidden="true" />
          </span>
          <h1
            id="compression-title"
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl"
          >
            Comprimir archivos
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Comprime JPEG o PNG, compara el resultado y descarga la nueva versión sin que la imagen salga de tu navegador.
          </p>
        </div>

        <ImageCompressionWorkspace />
      </section>
    </main>
  )
}
