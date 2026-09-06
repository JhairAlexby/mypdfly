import { lazy, Suspense } from 'react'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { SeoHead } from '@/components/SeoHead'
import { FaqSection } from '@/components/FaqSection'

const ImageToPdfComponent = lazy(() =>
  import('@/features/image-to-pdf/image-to-pdf-page').then((module) => ({
    default: module.ImageToPdfPage,
  })),
)

const imageFaqs = [
  {
    question: '¿Cómo corrijo la inclinación o sombras de las fotos tomadas con mi teléfono?',
    answer:
      'Al subir tus fotos, el sistema activa automáticamente un detector inteligente de esquinas que identifica los bordes del documento. Puedes ajustar manualmente los cuatro puntos de la perspectiva y aplicar filtros de blanco y negro o alto contraste para eliminar sombras y maximizar la legibilidad del texto.',
  },
  {
    question: '¿Cuántas imágenes puedo convertir simultáneamente a un único PDF?',
    answer:
      'Puedes agregar decenas de imágenes en una sola sesión. La herramienta te permite reordenarlas arrastrándolas con el ratón o el dedo, rotar páginas individuales en 90 grados y eliminar las tomas que no necesites antes de crear el PDF final.',
  },
  {
    question: '¿Mis fotografías se almacenan en algún servidor externo durante la conversión?',
    answer:
      'No. Todo el procesamiento de imágenes, rasterización, corrección de perspectiva y ensamblaje del archivo PDF ocurre de forma estrictamente local en tu navegador. Tus fotos y documentos confidenciales nunca se transmiten a internet.',
  },
  {
    question: '¿Puedo cambiar el tamaño de hoja, orientación o márgenes antes de exportar?',
    answer:
      'Sí, tienes control completo sobre la maquetación del documento. Puedes seleccionar tamaños universales como A4 o Carta estadounidense, orientar las páginas en vertical u horizontal, fijar márgenes precisos en milímetros o distribuir varias imágenes en una sola hoja.',
  },
]

export function ImageToPdfPage() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50/50 text-foreground">
      <SeoHead
        title="Convertir Imágenes a PDF Gratis Online | MyPDFly"
        description="Convierte JPG, PNG y otras imágenes a PDF en segundos, gratis y sin instalar nada. Rápido, seguro y desde el navegador."
        canonical="https://mypdfly.mictlanlabs.com.mx/imagenes-a-pdf"
        webApplication={{
          name: 'Convertir Imágenes a PDF Online - MyPDFly',
          description:
            'Convierte fotos y capturas a documentos PDF ordenados con detector de bordes, ajuste de perspectiva y filtros de realce de texto directamente en tu navegador.',
          url: 'https://mypdfly.mictlanlabs.com.mx/imagenes-a-pdf',
        }}
        faqs={imageFaqs}
      />

      <AppHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-3 text-center sm:px-6 sm:pt-10 sm:pb-5 lg:px-8">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Convertir Imágenes a PDF Gratis Online
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-6 text-slate-600 sm:text-base">
            Convierte tus fotos y capturas en documentos PDF ordenados. Con detector de bordes, ajuste de perspectiva y filtros de realce sin subir nada a internet.
          </p>
        </section>

        <Suspense
          fallback={
            <div className="mx-auto flex min-h-[24rem] max-w-5xl items-center justify-center p-8 text-sm text-slate-500">
              Cargando herramienta de imágenes a PDF…
            </div>
          }
        >
          <ImageToPdfComponent homeHref="/" />
        </Suspense>

        <FaqSection items={imageFaqs} />
      </main>

      <AppFooter />
    </div>
  )
}
