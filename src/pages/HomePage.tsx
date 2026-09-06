import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FileArchive,
  FileImage,
  FileText,
  Lock,
  Sparkles,
  Zap,
} from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { SeoHead } from '@/components/SeoHead'
import { FaqSection } from '@/components/FaqSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const homeFaqs = [
  {
    question: '¿Qué es MyPDFly y cómo protege la privacidad de mis documentos?',
    answer:
      'MyPDFly es una plataforma web de herramientas para PDF e imágenes que procesa cada archivo de manera 100% local en tu navegador. A diferencia de otros conversores online, tus documentos nunca se suben a la nube ni se transfieren a servidores externos, garantizando confidencialidad absoluta.',
  },
  {
    question: '¿Tiene algún costo o límite de archivos el servicio?',
    answer:
      'Todas las herramientas de MyPDFly son gratuitas y de acceso libre. No necesitas pagar suscripciones, no insertamos marcas de agua en tus resultados ni te obligamos a crear una cuenta para utilizarlas.',
  },
  {
    question: '¿Qué herramientas están disponibles en la plataforma?',
    answer:
      'Actualmente cuentas con tres herramientas principales: Compresor inteligente para reducir el peso de PDF e imágenes (JPG, PNG, WebP, AVIF), Conversor de imágenes a PDF con detección de esquinas y filtros, y Editor de PDF completo para firmar, añadir texto, formas y censurar información.',
  },
  {
    question: '¿Necesito instalar software adicional o extensiones?',
    answer:
      'No requieres instalar aplicaciones pesadas ni plugins en tu navegador. MyPDFly funciona directamente desde cualquier navegador moderno en computadoras con Windows, macOS o Linux y en dispositivos móviles.',
  },
]

export function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50/50 text-foreground">
      <SeoHead
        title="MyPDFly | Herramientas PDF Online Gratis, Rápidas y 100% Privadas"
        description="Herramientas de PDF online gratuitas que se ejecutan directamente en tu navegador. Comprime archivos, convierte imágenes a PDF y edita documentos sin servidores ni registros."
        canonical="https://mypdfly.mictlanlabs.com.mx/"
        webApplication={{
          name: 'MyPDFly Suite de Herramientas PDF',
          description:
            'Herramientas PDF online gratuitas que se ejecutan localmente en el navegador para editar, comprimir y convertir documentos con total privacidad.',
          url: 'https://mypdfly.mictlanlabs.com.mx/',
        }}
        faqs={homeFaqs}
      />

      <AppHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden pt-8 pb-10 sm:pt-14 sm:pb-14">
          <div
            className="pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[#ff5a45]/15 via-[#ff9081]/10 to-transparent blur-3xl"
            aria-hidden="true"
          />

          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffc5bc] bg-[#fff4f1] px-3.5 py-1 text-xs font-semibold tracking-wide text-[#c83625]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Procesamiento 100% local en tu navegador
            </div>

            <h1 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl leading-[1.1]">
              Herramientas de PDF Online Gratis y Privadas
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
              Comprime, convierte y edita tus archivos PDF e imágenes directamente en el navegador. Rápido, sin registro y 100% privado: tus documentos nunca salen de tu dispositivo.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-700">
              <span className="flex items-center gap-2 font-medium">
                <Lock className="size-4 text-emerald-600" aria-hidden="true" />
                Cero subidas a servidores
              </span>
              <span className="flex items-center gap-2 font-medium">
                <Zap className="size-4 text-amber-600" aria-hidden="true" />
                Respuesta inmediata
              </span>
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-blue-600" aria-hidden="true" />
                Completamente gratis
              </span>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
          aria-labelledby="tools-heading"
        >
          <div className="mb-10 text-center">
            <h2
              id="tools-heading"
              className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            >
              Selecciona la herramienta que necesitas
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Accede a cada solución con un solo clic, sin descargas previas.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-slate-200/90 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5">
              <CardHeader className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div
                    className="grid size-14 place-items-center rounded-2xl bg-[#fff0ed] text-[#ed4c38] transition-transform duration-300 group-hover:scale-105"
                    role="img"
                    aria-label="Icono representativo de compresión de archivos PDF e imágenes"
                  >
                    <FileArchive className="size-7" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    PDF · JPG · PNG
                  </span>
                </div>

                <CardTitle className="mt-6 text-xl font-bold text-slate-950 sm:text-2xl">
                  Comprimir archivos
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                  Reduce el peso de documentos PDF e imágenes en formatos JPG, PNG, WebP y AVIF conservando nitidez visual.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
                <ul className="space-y-2 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Procesamiento por lotes en cola
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Descarga individual o archivo ZIP
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Ajuste fino de calidad de compresión
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8">
                <Button
                  asChild
                  className="h-11 w-full rounded-xl bg-slate-950 text-white shadow-sm transition-all group-hover:bg-[#ed4c38]"
                >
                  <Link to="/comprimir-pdf">
                    Comprimir archivos gratis
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-slate-200/90 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5">
              <CardHeader className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div
                    className="grid size-14 place-items-center rounded-2xl bg-[#eff4ff] text-[#3b82f6] transition-transform duration-300 group-hover:scale-105"
                    role="img"
                    aria-label="Icono representativo de conversión de imágenes a PDF"
                  >
                    <FileImage className="size-7" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Escáner inteligente
                  </span>
                </div>

                <CardTitle className="mt-6 text-xl font-bold text-slate-950 sm:text-2xl">
                  Imágenes a PDF
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                  Convierte fotos, capturas y recibos en un documento PDF organizado con detección de esquinas y filtros.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
                <ul className="space-y-2 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Detección automática de bordes
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Filtros de contraste para texto claro
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Formato A4, Carta y composición libre
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8">
                <Button
                  asChild
                  className="h-11 w-full rounded-xl bg-slate-950 text-white shadow-sm transition-all group-hover:bg-[#3b82f6]"
                >
                  <Link to="/imagenes-a-pdf">
                    Convertir imágenes a PDF
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-slate-200/90 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5">
              <CardHeader className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div
                    className="grid size-14 place-items-center rounded-2xl bg-[#ecfdf5] text-[#10b981] transition-transform duration-300 group-hover:scale-105"
                    role="img"
                    aria-label="Icono representativo de editor y firma de PDF"
                  >
                    <FileText className="size-7" aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Edición y firmas
                  </span>
                </div>

                <CardTitle className="mt-6 text-xl font-bold text-slate-950 sm:text-2xl">
                  Editor de PDF
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                  Abre tus archivos para agregar textos, estampar tu firma manuscrita, dibujar figuras y ocultar datos sensibles.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
                <ul className="space-y-2 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Firma táctil, mouse o touchpad
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Difuminado protector de confidencialidad
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                    Reorganización y combinación de páginas
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8">
                <Button
                  asChild
                  className="h-11 w-full rounded-xl bg-slate-950 text-white shadow-sm transition-all group-hover:bg-[#10b981]"
                >
                  <Link to="/editor-pdf">
                    Abrir editor de PDF
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <FaqSection items={homeFaqs} />
      </main>

      <AppFooter />
    </div>
  )
}
