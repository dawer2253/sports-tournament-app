/**
 * Klocki ekranu Statystyki (#294): zakładki statystyk, lider, cała
 * klasyfikacja i liderzy pozostałych statystyk. Dane w propsach, typy
 * z `components/data/leaderboard-data` (zgodność z kontraktem pilnuje
 * `apps/public/src/lib/contract-guard.ts`).
 */
import { Tabs } from 'radix-ui'
import * as React from 'react'
import type { Leaderboard, StatOption } from '../components/data/leaderboard-data'
import { cn } from '../lib/utils'
import { ErrorBoard } from './board'
import { Crest } from './crest'
import { SectionHead } from './heads'
import { Loading, SkeletonBlock } from './skeleton'

export interface StatTabsProps {
  /** `PublicTournament.stats`, w kolejności `availableStats` sportu. */
  stats: StatOption[]
  /** Kod wybranej statystyki. */
  value: string
  /** Wybór innej statystyki: zgłasza kod, wywołujący trzyma go w adresie (`?stat=`). */
  onValueChange: (code: string) => void
  /** Treść panelu wybranej statystyki. */
  children: React.ReactNode
  className?: string
}

/**
 * Zakładki statystyk w wyglądzie zakładek shella (podkreślenie w
 * `--brand-line`), na `Tabs` z `radix-ui`: zakładka i panel połączone jak
 * w ARIA tabs, strzałki i Home/End, w kolejności Tab tylko wybrana.
 * Wyboru nie trzyma u siebie, żeby dało się go odtworzyć z adresu.
 */
export function StatTabs({ stats, value, onValueChange, children, className }: StatTabsProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className={cn('flex flex-col gap-8', className)}>
      {/* Dłuższa lista przewija się w bok, zamiast łamać zakładki. */}
      <Tabs.List aria-label="Statystyka" className="flex gap-7 overflow-x-auto border-b border-hairline [scrollbar-width:none]">
        {stats.map((stat) => (
          <Tabs.Trigger
            key={stat.code}
            value={stat.code}
            className={cn(
              '-mb-px shrink-0 border-b-[3px] pt-1 pb-2.5 pub-tab text-pub-20 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-line',
              'border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-brand-line data-[state=active]:text-foreground',
            )}
          >
            {stat.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={value} className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-line">
        {children}
      </Tabs.Content>
    </Tabs.Root>
  )
}

/**
 * Lider klasyfikacji: wszyscy z `position: 1`. Jeden — duża karta z „Lider”,
 * kilku — karty obok siebie od `sm` z „Liderzy ex aequo”. Nazwisko i wartość
 * jak na tablicy, wartość w `--brand-line`, pod nią `label` odpowiedzi
 * małymi literami.
 *
 * `compact` to boczna kolumna Przeglądu (#296): karty zawsze jedna pod drugą
 * i mniejsze cyfry, bo kolumna ma 20 rem także na szerokim ekranie.
 */
export function StatLeaders({ leaderboard, compact = false }: { leaderboard: Leaderboard; compact?: boolean }) {
  const leaders = leaderboard.rows.filter((row) => row.position === 1)
  const shared = leaders.length > 1
  const small = shared || compact
  return (
    <div className={cn('grid gap-3', shared && !compact && 'sm:grid-cols-2')}>
      {leaders.map((row) => (
        <div
          key={row.player.id}
          data-slot="stat-leader"
          className="flex items-end justify-between gap-4 rounded-md bg-card px-5 py-5 ring-1 ring-border ring-inset sm:gap-6 sm:px-7"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-pub-14 text-muted-foreground">{shared ? 'Liderzy ex aequo' : 'Lider'}</span>
            <span className={cn('pub-h2 wrap-break-word', small ? 'text-pub-28' : 'text-pub-40')}>{row.player.name}</span>
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Crest name={row.team.name} logoUrl={row.team.logoUrl} className="size-5" />
              <span className="min-w-0 wrap-break-word">{row.team.name}</span>
            </span>
          </div>
          <span className="flex shrink-0 flex-col items-end">
            <span className={cn('pub-score text-pub-64 text-brand-line', !small && 'sm:text-pub-120')}>{row.value}</span>
            <span className="text-pub-13 text-muted-foreground">{leaderboard.label.toLocaleLowerCase('pl')}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

const RANKING_COLUMNS = 'grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] gap-x-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,12rem)_3.5rem]'

/**
 * Cała klasyfikacja: miejsce, zawodnik z drużyną, pasek wartości i wartość.
 * Wiersze w kolejności i z pozycjami z API (widok niczego nie sortuje).
 * Dzielone miejsce widać raz, przy pierwszym z grupy, a czytnik dostaje
 * pozycję w każdym wierszu. Pasek jest proporcjonalny do największej
 * wartości, u lidera w `--brand-line`; na telefonie go nie ma. Nagłówek
 * kolumny wartości to `label` odpowiedzi (ADR-0006).
 */
export function StatRanking({ leaderboard }: { leaderboard: Leaderboard }) {
  const { label, rows } = leaderboard
  const max = Math.max(...rows.map((row) => row.value))
  return (
    <div role="table" aria-label={`Klasyfikacja: ${label}`}>
      <div role="row" className={cn(RANKING_COLUMNS, 'pb-2 text-pub-13 text-muted-foreground')}>
        <span role="columnheader" className="text-center">
          #
        </span>
        <span role="columnheader">Zawodnik</span>
        <span aria-hidden className="hidden sm:block" />
        <span role="columnheader" className="text-right">
          {label}
        </span>
      </div>
      {rows.map((row, index) => {
        const sharedPlace = index > 0 && rows[index - 1]!.position === row.position
        const leader = row.position === 1
        return (
          <div role="row" key={row.player.id} className={cn(RANKING_COLUMNS, 'min-h-14 items-center border-t border-hairline')}>
            <span role="cell" className={cn('pub-num text-center text-pub-20', leader ? 'text-foreground' : 'text-muted-foreground')}>
              {sharedPlace ? <span className="sr-only">{row.position}</span> : row.position}
            </span>
            {/* Zawodnik i drużyna to hierarchia: niesie ją układ i kontrast, nie znak między nimi. */}
            <span role="cell" className="flex min-w-0 flex-col py-2 leading-tight sm:flex-row sm:items-center sm:gap-4">
              <span className="min-w-0 wrap-break-word font-semibold">{row.player.name}</span>
              <span className="flex min-w-0 items-center gap-2 text-pub-14 text-muted-foreground">
                <Crest name={row.team.name} logoUrl={row.team.logoUrl} className="size-4" />
                <span className="min-w-0 wrap-break-word">{row.team.name}</span>
              </span>
            </span>
            <span aria-hidden className="hidden h-1.5 rounded-full bg-muted sm:block">
              <span
                data-slot="stat-bar"
                className={cn('block h-full rounded-full', leader ? 'bg-brand-line' : 'bg-muted-foreground/45')}
                style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
              />
            </span>
            <span role="cell" className="pub-num text-right text-pub-28">
              {row.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Stan klasyfikacji jednej statystyki w bocznej kolumnie: każda ma osobne zapytanie. */
export type StatBoard =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'ready'; leaderboard: Leaderboard }

/** Ile wierszy ma sekcja statystyki w bocznej kolumnie. */
export const OTHER_STAT_ROWS = 3

export interface OtherStatLeadersProps {
  /** Wszystkie statystyki turnieju; bieżąca (`value`) nie dostaje sekcji. */
  stats: StatOption[]
  value: string
  /** Klasyfikacja każdej statystyki po kodzie; brak wpisu to wczytywanie. */
  boards: Record<string, StatBoard>
  /** Adres statystyki, ten sam co zakładki (pierwsza bez `?stat=`). */
  statHref?: (code: string) => string
  /** „Cała klasyfikacja”: zgłasza kod swojej statystyki. */
  onValueChange: (code: string) => void
}

/**
 * Boczna kolumna: trzy pierwsze wiersze każdej z pozostałych statystyk
 * turnieju i „Cała klasyfikacja”. Sekcja ma własny szkielet i własny błąd,
 * więc nie zasłania głównej klasyfikacji. Wiersze to lista, nie tabela:
 * klasyfikacja ma zostać jedyną tabelą ekranu.
 */
export function OtherStatLeaders({ stats, value, boards, statHref, onValueChange }: OtherStatLeadersProps) {
  const id = React.useId()
  return (
    <aside aria-label="Pozostałe statystyki" className="flex flex-col gap-10">
      {stats
        .filter((stat) => stat.code !== value)
        .map((stat) => {
          const board = boards[stat.code] ?? { status: 'loading' }
          const headingId = `${id}-${stat.code}`
          return (
            <section key={stat.code} aria-labelledby={headingId} className="flex flex-col">
              <SectionHead
                id={headingId}
                title={stat.label}
                link={{ label: 'Cała klasyfikacja', href: statHref?.(stat.code), onNavigate: () => onValueChange(stat.code) }}
              />
              {board.status === 'loading' && (
                <Loading label={`Wczytywanie: ${stat.label}`} className="gap-2 pt-2">
                  {Array.from({ length: OTHER_STAT_ROWS }, (_, index) => (
                    <SkeletonBlock key={index} className="h-9 w-full" />
                  ))}
                </Loading>
              )}
              {board.status === 'error' && (
                <ErrorBoard
                  title="Nie udało się wczytać"
                  message={board.message}
                  onRetry={board.onRetry}
                  className="mt-3 px-5 py-6 sm:px-5 sm:py-6"
                />
              )}
              {board.status === 'ready' && board.leaderboard.rows.length === 0 && (
                <p className="py-3 text-pub-14 text-muted-foreground">Jeszcze nikt.</p>
              )}
              {board.status === 'ready' && board.leaderboard.rows.length > 0 && (
                <ol>
                  {board.leaderboard.rows.slice(0, OTHER_STAT_ROWS).map((row) => (
                    <li key={row.player.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 pub-num text-center text-muted-foreground">{row.position}</span>
                        <span className="min-w-0 wrap-break-word font-medium">{row.player.name}</span>
                      </span>
                      <span className="pub-num text-pub-20">{row.value}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )
        })}
    </aside>
  )
}
