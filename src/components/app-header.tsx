import { LockKeyhole } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GitHubButton } from '@/components/github-button'
import logo from '@/assets/logo-mypdfly.webp'

export function AppHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Mictlán Labs"
            className="h-10 w-auto max-w-40 object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            onClick={() => window.open('https://mictlanlabs.com.mx', '_blank')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden h-8 gap-1.5 rounded-full border-emerald-200 bg-emerald-50/80 px-3 font-medium text-emerald-800 sm:inline-flex"
          >
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Procesamiento privado
          </Badge>
          <GitHubButton />
        </div>
      </div>
    </header>
  )
}
