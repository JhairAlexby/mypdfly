import logoBlack from '@/assets/LogoBlack.svg'

export function AppFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-slate-200/80 bg-white">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-40 w-80 -translate-x-1/2 rounded-full bg-[#ff5a45]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-[#ff5a45]/70 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-4 py-7 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-center sm:text-left">
          
          <div>
            <p className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
              PDF simple. Trabajo bien hecho.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Diseñado para mantener tus documentos en tus manos.
            </p>
          </div>
        </div>

        <div className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md">
          <span className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Hecho por
          </span>
          <span className="h-7 w-px bg-slate-200" aria-hidden="true" />
          <img
            src={logoBlack}
            alt="Mictlán Labs"
            className="h-8 w-auto max-w-32 object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            onClick={() => window.open('https://mictlanlabs.com.mx', '_blank')}
          />
        </div>
      </div>
    </footer>
  )
}
