import * as React from 'react'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { tournament } from '@/lib/demo-data'

export type PublicNavKey = 'home' | 'standings' | 'fixtures' | 'results' | 'bracket' | 'scorers'

const TABS: { key: PublicNavKey; label: string }[] = [
  { key: 'home', label: 'Przegląd' },
  { key: 'standings', label: 'Tabela' },
  { key: 'fixtures', label: 'Terminarz' },
  { key: 'results', label: 'Wyniki' },
  { key: 'bracket', label: 'Drabinka' },
  { key: 'scorers', label: 'Strzelcy' },
]

export interface PublicShellProps {
  active: PublicNavKey
  children: React.ReactNode
  live?: boolean
}

export function PublicShell({ active, children, live = true }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 pb-5 pt-8">
          <div className="grid size-14 place-items-center rounded-xl bg-white/15 text-3xl backdrop-blur">⚽</div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold uppercase tracking-tight">{tournament.name}</h1>
            <p className="text-sm text-brand-foreground/80">
              {tournament.season} · {tournament.teamsCount} drużyn · {tournament.sport}
            </p>
          </div>
          {live && (
            <Badge className="ml-auto shrink-0 border-transparent bg-white/15 text-brand-foreground">
              <span className="mr-1 size-2 animate-pulse rounded-full bg-white" /> Na żywo
            </Badge>
          )}
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-6 text-sm">
          {TABS.map((t) => (
            <span
              key={t.key}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-t-lg px-4 py-2.5 transition-colors',
                t.key === active
                  ? 'bg-muted/40 font-medium text-foreground'
                  : 'text-brand-foreground/75 hover:text-brand-foreground',
              )}
            >
              {t.label}
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>

      <footer className="mx-auto flex max-w-5xl items-center justify-center gap-1.5 px-6 py-8 text-center text-xs text-muted-foreground">
        <Trophy className="size-3.5" /> Powered by TournamentApp · /t/{tournament.slug}
      </footer>
    </div>
  )
}
