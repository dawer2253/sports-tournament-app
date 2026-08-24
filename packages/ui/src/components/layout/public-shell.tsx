import * as React from 'react'
import { Trophy } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Heading } from '../ui/typography'
import { MetaList } from './meta-list'
import { tournament } from '../../lib/demo-data'
import heroDay from '../../assets/public/hero-day.webp'
import heroNight from '../../assets/public/hero-night.webp'

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
}

export function PublicShell({ active, children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="relative isolate overflow-hidden bg-brand text-brand-foreground">
        {/* Zdjęcie tła — motywozależne: jasne boisko (dzień) / nocny mecz pod jupiterami */}
        <img
          src={heroDay}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 size-full object-cover object-[center_30%] dark:hidden"
        />
        <img
          src={heroNight}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 hidden size-full object-cover object-[center_82%] dark:block"
        />
        {/* Nakładka marki: tożsamość „pitch" + kontrast dla białego tekstu.
            Jasny motyw — zieleń dominuje (jasne, energetyczne boisko).
            Ciemny motyw — nakładka słabnie, a ciemny scrim od dołu wydobywa
            nocny mecz pod jupiterami (efekt „floodlights"). */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-brand/75 dark:bg-brand/30" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-brand via-brand/50 to-brand/10 dark:from-background dark:via-background/55 dark:to-transparent"
        />

        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 pb-5 pt-9">
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/15 text-3xl shadow-sm ring-1 ring-white/25 backdrop-blur">
            ⚽
          </div>
          <div className="min-w-0">
            <Heading className="truncate font-extrabold text-current drop-shadow-sm">
              {tournament.name}
            </Heading>
            <MetaList className="text-sm text-brand-foreground/85 drop-shadow-sm">
              <>{tournament.season}</>
              <>{tournament.teamsCount} drużyn</>
              <>{tournament.sport}</>
            </MetaList>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-6 text-sm">
          {TABS.map((t) => (
            <span
              key={t.key}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-t-lg px-4 py-2.5 transition-colors',
                t.key === active
                  ? 'bg-muted font-medium text-foreground shadow-sm'
                  : 'text-brand-foreground/80 hover:bg-white/10 hover:text-brand-foreground',
              )}
            >
              {t.label}
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>

      <footer className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8 text-xs text-muted-foreground">
        <MetaList>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5" /> Powered by TournamentApp
          </span>
          <>/t/{tournament.slug}</>
        </MetaList>
      </footer>
    </div>
  )
}
