import { lazy, Suspense } from 'react'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { SeoHead } from '@/components/SeoHead'
import { FaqSection } from '@/components/FaqSection'

const FileCompressionPage = lazy(() =>
  import('@/features/file-compression/file-compression-page').then((module) => ({
    default: module.FileCompressionPage,
  })),
)

const compressFaqs = [
  {
    question: '¿Es seguro comprimir mis archivos PDF e imágenes en MyPDFly?',
    answer:
      'Totalmente seguro. Todo el proceso de compresión se ejecuta dentro del motor de tu navegador mediante WebAssembly y tecnologías web nativas. Tus archivos nunca salen de tu ordenador ni se transmiten por la red, protegiendo tus datos confidenciales.',
  },
  {
    question: '¿Existe algún límite en la cantidad o tamaño de archivos a optimizar?',
    answer:
      'Puedes añadir múltiples documentos e imágenes para procesarlos en cola secuencial sin restricciones artificiales ni suscripciones de pago. El único límite es la memoria RAM disponible en tu dispositivo.',
  },
  {
    question: '¿Qué formatos de archivo son compatibles con el compresor?',
    answer:
      'El compresor admite documentos PDF estándar y los formatos de imagen más extendidos: JPEG/JPG, PNG, WebP y AVIF. Además, te permite descargar cada archivo comprimido individualmente o todos juntos en un paquete ZIP ordenado.',
  },
  {
    question: '¿Se pierde calidad visual en los documentos o fotografías al comprimir?',
    answer:
      'Nuestra herramienta aplica compresión optimizada que remueve metadatos innecesarios, reorganiza tablas internas y ajusta la resolución de forma equilibrada. En imágenes PNG dispones de optimización sin pérdida mediante OxiPNG, y en JPEG o PDF puedes calibrar el nivel de calidad deseado.',
  },
]

export function CompressPage() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50/50 text-foreground">
      <SeoHead
        title="Comprimir PDF y Archivos Gratis Online | MyPDFly"
        description="Comprime documentos PDF e imágenes JPG, PNG, WebP y AVIF gratis sin perder calidad. Optimización rápida, segura y 100% local en tu navegador."
        canonical="https://mypdfly.mictlanlabs.com.mx/comprimir-pdf"
        webApplication={{
          name: 'Comprimir PDF y Archivos Online - MyPDFly',
          description:
            'Herramienta web gratuita para optimizar y reducir el peso de documentos PDF e imágenes JPG, PNG, WebP y AVIF localmente en el navegador.',
          url: 'https://mypdfly.mictlanlabs.com.mx/comprimir-pdf',
        }}
        faqs={compressFaqs}
      />

      <AppHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-3 text-center sm:px-6 sm:pt-10 sm:pb-5 lg:px-8">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Comprimir PDF y Archivos Gratis Online
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-6 text-slate-600 sm:text-base">
            Reduce el tamaño de tus archivos PDF e imágenes (JPG, PNG, WebP y AVIF) sin perder calidad. Rápido, por lotes y 100% privado en tu dispositivo.
          </p>
        </section>

        <Suspense
          fallback={
            <div className="mx-auto flex min-h-[24rem] max-w-5xl items-center justify-center p-8 text-sm text-slate-500">
              Cargando compresor de archivos…
            </div>
          }
        >
          <FileCompressionPage homeHref="/" />
        </Suspense>

        <FaqSection items={compressFaqs} />
      </main>

      <AppFooter />
    </div>
  )
}
