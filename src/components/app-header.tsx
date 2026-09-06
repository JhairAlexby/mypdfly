import { Link, NavLink } from 'react-router-dom'
import { FileArchive, FileImage, FileText, LockKeyhole } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GitHubButton } from '@/components/github-button'
import logo from '@/assets/logo-mypdfly.webp'

export function AppHeader() {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg"
            aria-label="Ir a la página de inicio de MyPDFly"
          >
            <img
              src={logo}
              alt="MyPDFly"
              className="h-9 w-auto max-w-36 object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </Link>

          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Navegación principal de herramientas"
          >
            <NavLink to="/comprimir-pdf" className={navLinkClass}>
              <FileArchive className="size-4 text-[#e84c38]" aria-hidden="true" />
              Comprimir archivos
            </NavLink>
            <NavLink to="/imagenes-a-pdf" className={navLinkClass}>
              <FileImage className="size-4 text-[#3b82f6]" aria-hidden="true" />
              Imágenes a PDF
            </NavLink>
            <NavLink to="/editor-pdf" className={navLinkClass}>
              <FileText className="size-4 text-[#10b981]" aria-hidden="true" />
              Editor PDF
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden h-8 gap-1.5 rounded-full border-emerald-200 bg-emerald-50/80 px-3 font-medium text-emerald-800 lg:inline-flex"
          >
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Procesamiento privado
          </Badge>
          <GitHubButton />
        </div>
      </div>

      <nav
        className="flex md:hidden items-center justify-around border-t border-slate-200/70 bg-white/95 px-2 py-1.5"
        aria-label="Navegación móvil de herramientas"
      >
        <NavLink to="/comprimir-pdf" className={navLinkClass}>
          <FileArchive className="size-3.5 text-[#e84c38]" aria-hidden="true" />
          Comprimir
        </NavLink>
        <NavLink to="/imagenes-a-pdf" className={navLinkClass}>
          <FileImage className="size-3.5 text-[#3b82f6]" aria-hidden="true" />
          Imágenes a PDF
        </NavLink>
        <NavLink to="/editor-pdf" className={navLinkClass}>
          <FileText className="size-3.5 text-[#10b981]" aria-hidden="true" />
          Editor PDF
        </NavLink>
      </nav>
    </header>
  )
}
