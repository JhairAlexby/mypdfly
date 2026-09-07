import { Link } from 'react-router-dom'
import logoBlack from '@/assets/LogoBlack.svg'

const groups = [
  { title: 'Herramientas web', links: [
    { to: '/', label: 'Inicio' },
    { to: '/comprimir-pdf', label: 'Comprimir archivos' },
    { to: '/imagenes-a-pdf', label: 'Imágenes a PDF' },
    { to: '/editor-pdf', label: 'Editor PDF' },
  ] },
  { title: 'Legal · Sitio web', links: [
    { to: '/web/privacy', label: 'Política de Privacidad' },
    { to: '/web/terms', label: 'Términos y Condiciones' },
  ] },
  { title: 'Legal · App móvil', links: [
    { to: '/privacy', label: 'Política de Privacidad' },
    { to: '/terms', label: 'Términos y Condiciones' },
  ] },
]

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <div className="min-w-0">
            <Link to="/" className="inline-flex min-h-11 items-center text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4">MyPDFly</Link>
            <p className="mt-2 text-sm font-medium">PDF simple. Trabajo bien hecho.</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Diseñado para mantener tus documentos en tus manos.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {groups.map((group) => (
              <nav key={group.title} aria-label={group.title} className="min-w-0">
                <h2 className="mb-3 text-sm font-semibold">{group.title}</h2>
                <ul className="space-y-1">
                  {group.links.map((link) => (
                    <li key={link.to} className="min-w-0"><Link to={link.to} className="flex min-h-11 min-w-0 items-center py-2 text-sm leading-6 break-words text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4">{link.label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs leading-5 text-muted-foreground">MyPDFly · Una herramienta de MictlanLabs</p>
          <a href="https://mictlanlabs.com.mx" target="_blank" rel="noopener noreferrer" aria-label="Visitar MictlanLabs (abre en otra pestaña)" className="inline-flex min-h-11 items-center gap-3 rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-offset-4">
            <span className="text-xs text-muted-foreground">Hecho por</span>
            <img src={logoBlack} alt="MictlanLabs" className="h-8 w-auto max-w-32" />
          </a>
        </div>
      </div>
    </footer>
  )
}
