import { ChevronDown, HelpCircle } from 'lucide-react'
import type { FaqItem } from './SeoHead'

export interface FaqSectionProps {
  title?: string
  subtitle?: string
  items: FaqItem[]
}

export function FaqSection({
  title = 'Preguntas frecuentes',
  subtitle = 'Resolvemos tus principales dudas sobre el funcionamiento y la seguridad de esta herramienta.',
  items,
}: FaqSectionProps) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase">
          <HelpCircle className="size-3.5 text-[#e84c38]" aria-hidden="true" />
          Dudas resueltas
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          {subtitle}
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {items.map((item, index) => (
          <details
            key={index}
            className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 open:border-slate-300 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-900 select-none hover:text-[#e84c38]">
              <span>{item.question}</span>
              <ChevronDown
                className="size-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-[#e84c38]"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
