import { Files, LockKeyhole } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { GitHubButton } from '@/components/github-button'

export function AppHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-[#ff5a45] text-white shadow-[0_8px_24px_rgba(255,90,69,0.28)]">
            <Files className="size-[18px]" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
            my<span className="text-[#ff5a45]">pdf</span>ly
          </span>
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
