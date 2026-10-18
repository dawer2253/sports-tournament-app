/**
 * PROTOTYP S7 (#287) — klocki wspólne dla wariantów: język elementów
 * (wiersze, tabela, lider), nie układ strony. Układ każdy wariant ma własny.
 * Bez importów z `components/ui` (reguła strony publicznej z #286).
 */
import type * as React from 'react'
import { teamAbbr } from '../../components/layout/team-crest'
import { LEADERBOARD_EMPTY, leaderboardLeaders, type Leaderboard } from '../../components/data/leaderboard-data'
import type { MatchScorer } from '../../components/data/match-row-data'
import { formatKickoff, formatMatchDay } from '../../lib/kickoff'
import { cn } from '../../lib/utils'
import { teamRows, type ScheduleDemoMatch } from '../../lib/demo-data'
import type { PublicShellTournament } from '../../components/layout/public-shell-tournament'
import type { PublicNavKey } from '../../components/layout/public-nav'
import { brandVars } from './accent'
import type { FormResult, TableRow } from './demo'

export const TAB_LABELS: Record<PublicNavKey, string> = {
  home: 'Przegląd',
  standings: 'Tabela',
  bracket: 'Drabinka',
  fixtures: 'Terminarz',
  results: 'Wyniki',
  stats: 'Statystyki',
}

/** Korzeń strony publicznej: zawsze `.dark`, plus kolor turnieju. */
export function PublicRoot({ accent, className, children }: { accent: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('dark public-site min-h-screen bg-background text-foreground antialiased', className)} style={brandVars(accent)}>
      {children}
    </div>
  )
}

/** Odnośnik-dekoracja: w prototypie nigdzie nie prowadzi. */
export function DeadLink({ className, children, ...props }: React.ComponentProps<'a'>) {
  return (
    <a href="#" onClick={(event) => event.preventDefault()} className={className} {...props}>
      {children}
    </a>
  )
}

/** Herb wgrany przez organizera: w demo tylko FC Górka, reszta to zastępczy. */
const UPLOADED_LOGOS: Record<string, string> = Object.fromEntries(
  teamRows.filter((team) => team.logoUrl).map((team) => [team.name, team.logoUrl!]),
)

/**
 * Herb drużyny: wgrany plik albo herb zastępczy w kolorze turnieju —
 * tarcza z obrysem `--brand-line`, delikatnym wypełnieniem i skrótem
 * w `--brand-text`. Zastępczy herb należy do turnieju, nie do drużyny, więc
 * niesie akcent turnieju zamiast neutralnego brązu z panelu.
 */
export function Crest({ name, className }: { name: string; className?: string }) {
  const logo = UPLOADED_LOGOS[name]
  if (logo) {
    return <img src={logo} alt="" aria-hidden className={cn('size-6 shrink-0 object-contain', className)} />
  }
  const abbr = teamAbbr(name)
  return (
    <svg viewBox="0 0 20 24" aria-hidden className={cn('size-6 shrink-0', className)}>
      <path
        d="M10 1.2 17.8 3.5v8.8c0 4.6-3.2 7.9-7.8 10.5-4.6-2.6-7.8-5.9-7.8-10.5V3.5L10 1.2Z"
        className="fill-brand-line/15 stroke-brand-line"
        strokeWidth="1.4"
      />
      <text
        x="10"
        y="11.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={abbr.length > 2 ? 6 : 8}
        fontWeight="700"
        className="fill-brand-text font-display"
      >
        {abbr}
      </text>
    </svg>
  )
}

export function LiveTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 pub-tab text-base text-destructive', className)}>
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60 motion-reduce:animate-none" />
        <span className="relative size-2.5 rounded-full bg-destructive" />
      </span>
      Na żywo
    </span>
  )
}

/** Nagłówek sekcji: tytuł na „belce” (gruba linia pod spodem) i odnośnik do pełnego widoku. */
export function SectionHead({ id, title, link, sub }: { id: string; title: string; link?: string; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-rule pb-2">
        <h2 id={id} className="pub-h2">{title}</h2>
        {link && (
          <DeadLink className="shrink-0 text-sm font-medium text-brand-text underline-offset-4 hover:underline">{link}</DeadLink>
        )}
      </div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function time(match: ScheduleDemoMatch, timeZone: string) {
  return formatKickoff(match.kickoffAt, { showDate: false, timeZone })
}

export function day(match: ScheduleDemoMatch, timeZone: string) {
  return match.kickoffAt ? formatMatchDay(match.kickoffAt, timeZone) : 'Termin do ustalenia'
}

/** Strzelcy jednej strony: „Kowalski 12', 40'”, samobój po stronie przeciwnika. */
export function scorersFor(match: ScheduleDemoMatch, side: 'home' | 'away'): MatchScorer[] {
  const teamId = side === 'home' ? match.homeTeam?.id : match.awayTeam?.id
  return (match.scorers ?? []).filter((scorer) => (scorer.ownGoal ? scorer.team.id !== teamId : scorer.team.id === teamId))
}

export function scorerLabel(scorer: MatchScorer) {
  const surname = scorer.player.name.split(' ').at(-1)
  const minutes = scorer.minutes.length === scorer.value ? scorer.minutes.map((minute) => `${minute}'`).join(', ') : `×${scorer.value}`
  return `${surname} ${minutes}${scorer.ownGoal ? ' (sam.)' : ''}`
}

/**
 * Mecz zaplanowany w liście: godzina na lewej krawędzi (stała kolumna),
 * gospodarz i gość wokół „–”, obiekt na prawej. Na telefonie godzina
 * i obiekt idą nad pary.
 */
export function FixtureLine({ match, timeZone, showDay = false }: { match: ScheduleDemoMatch; timeZone: string; showDay?: boolean }) {
  return (
    <DeadLink className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-hairline py-3 hover:bg-card/60 sm:grid-cols-[4.5rem_minmax(0,1fr)_1.5rem_minmax(0,1fr)_6rem] sm:min-h-14 sm:py-0">
      <span className="flex flex-col leading-tight">
        <span className="pub-num text-xl">{time(match, timeZone)}</span>
        {showDay && <span className="text-xs text-muted-foreground">{day(match, timeZone)}</span>}
      </span>
      <span className="truncate font-semibold sm:text-right">{match.homeTeam?.name}</span>
      <span aria-hidden className="hidden text-center text-muted-foreground sm:block">–</span>
      <span className="col-start-2 truncate font-semibold sm:col-start-auto">{match.awayTeam?.name}</span>
      <span className="col-start-3 row-span-2 row-start-1 text-right text-sm text-muted-foreground sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        {match.venue?.name}
      </span>
    </DeadLink>
  )
}

/** Cyfra wyniku w okienku wyświetlacza. */
export function ScoreCell({ value, className, dim }: { value: number | null; className?: string; dim?: boolean }) {
  return (
    <span className={cn('grid min-w-9 place-items-center rounded-sm bg-sunken px-1.5 pub-num text-2xl leading-9', dim && 'text-muted-foreground', className)}>
      {value ?? '–'}
    </span>
  )
}

/** Wynik w liście: zwycięzca pełną bielą i grubiej, przegrany przygaszony. */
export function ResultLine({ match }: { match: ScheduleDemoMatch }) {
  const home = match.homeScore ?? 0
  const away = match.awayScore ?? 0
  const lose = (side: 'home' | 'away') => (side === 'home' ? home < away : away < home)
  return (
    <DeadLink className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-hairline py-2 hover:bg-card/60 sm:gap-5">
      <span className={cn('flex min-w-0 items-center justify-end gap-2.5 text-right', lose('home') ? 'text-muted-foreground' : 'font-semibold')}>
        <span className="truncate">{match.homeTeam?.name}</span>
        <Crest name={match.homeTeam?.name ?? ''} className="hidden size-6 sm:grid" />
      </span>
      <span className="flex gap-1">
        <ScoreCell value={match.homeScore} dim={lose('home')} />
        <ScoreCell value={match.awayScore} dim={lose('away')} />
      </span>
      <span className={cn('flex min-w-0 items-center gap-2.5', lose('away') ? 'text-muted-foreground' : 'font-semibold')}>
        <Crest name={match.awayTeam?.name ?? ''} className="hidden size-6 sm:grid" />
        <span className="truncate">{match.awayTeam?.name}</span>
      </span>
    </DeadLink>
  )
}

const FORM_STYLE: Record<FormResult, string> = {
  W: 'bg-brand-line text-brand-line-foreground',
  R: 'bg-muted text-foreground',
  P: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
}

export function Form({ form }: { form: FormResult[] }) {
  return (
    <span className="flex gap-1" aria-label={`Forma: ${form.join(' ')}`}>
      {form.map((result, index) => (
        <span key={index} aria-hidden className={cn('grid size-5 place-items-center rounded-[3px] pub-num text-xs', FORM_STYLE[result])}>
          {result}
        </span>
      ))}
    </span>
  )
}

/**
 * Skrót tabeli: pozycja, herb i nazwa, mecze, różnica, punkty. Lider ma
 * pasek w kolorze turnieju na lewej krawędzi — jedyne miejsce akcentu w tabeli.
 */
export function MiniTable({
  rows,
  limit = rows.length,
  columns = 'short',
  finished,
}: {
  rows: TableRow[]
  limit?: number
  columns?: 'short' | 'full'
  finished?: boolean
}) {
  const full = columns === 'full'
  const grid = full
    ? 'grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_3rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_2.25rem_3rem_7.5rem_3rem]'
    : 'grid-cols-[2rem_minmax(0,1fr)_2rem_2.5rem_3rem]'
  return (
    <div role="table" aria-label="Tabela" className="text-[0.9375rem]">
      <div role="row" className={cn('grid items-end gap-2 pb-1.5 text-xs text-muted-foreground', grid)}>
        <span role="columnheader" className="text-center">#</span>
        <span role="columnheader">Drużyna</span>
        <span role="columnheader" className="text-right">M</span>
        {full && (
          <>
            <span role="columnheader" className="hidden text-right sm:block">W</span>
            <span role="columnheader" className="hidden text-right sm:block">R</span>
            <span role="columnheader" className="hidden text-right sm:block">P</span>
          </>
        )}
        <span role="columnheader" className="text-right">+/−</span>
        {full && <span role="columnheader" className="hidden pl-3 sm:block">Forma</span>}
        <span role="columnheader" className="text-right">Pkt</span>
      </div>
      {rows.slice(0, limit).map((row) => {
        const leader = row.position === 1 && row.played > 0
        return (
          <div
            role="row"
            key={row.team.id}
            className={cn('relative grid min-h-11 items-center gap-2 border-t border-hairline', grid)}
          >
            {leader && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-1 rounded-full bg-brand-line" />}
            <span role="cell" className={cn('text-center pub-num text-lg', !leader && 'text-muted-foreground')}>{row.position}</span>
            <span role="cell" className="flex min-w-0 items-center gap-2.5">
              <Crest name={row.team.name} className="size-5" />
              <span className={cn('truncate', leader ? 'font-semibold' : 'font-medium')}>{row.team.name}</span>
              {leader && finished && <span className="shrink-0 text-xs text-brand-text">Mistrz</span>}
            </span>
            <span role="cell" className="text-right tabular-nums text-muted-foreground">{row.played}</span>
            {full && (
              <>
                <span role="cell" className="hidden text-right tabular-nums text-muted-foreground sm:block">{row.won}</span>
                <span role="cell" className="hidden text-right tabular-nums text-muted-foreground sm:block">{row.drawn}</span>
                <span role="cell" className="hidden text-right tabular-nums text-muted-foreground sm:block">{row.lost}</span>
              </>
            )}
            <span role="cell" className="text-right tabular-nums text-muted-foreground">
              {row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference < 0 ? `−${-row.scoreDifference}` : '0'}
            </span>
            {full && (
              <span role="cell" className="hidden pl-3 sm:block">
                <Form form={row.form} />
              </span>
            )}
            <span role="cell" className="text-right pub-num text-xl">{row.points}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Lider klasyfikacji: nazwisko i liczba jak na tablicy, pod spodem kolejni. */
export function LeaderBlock({ leaderboard, compact }: { leaderboard: Leaderboard; compact?: boolean }) {
  const rows = leaderboardLeaders(leaderboard.rows)
  const [first, ...rest] = rows
  if (!first) {
    return <p className="py-4 text-sm text-muted-foreground">{LEADERBOARD_EMPTY}.</p>
  }
  const unit = leaderboard.label.toLocaleLowerCase('pl')
  return (
    <div className="flex flex-col">
      <div className="flex items-end justify-between gap-4 pb-4 pt-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn('pub-h2 uppercase', compact ? 'text-2xl' : 'text-3xl')}>{first.player.name}</span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crest name={first.team.name} className="size-4" />
            {first.team.name}
          </span>
        </div>
        <span className="flex flex-col items-end">
          <span className={cn('pub-score text-brand-line', compact ? 'text-6xl' : 'text-7xl')}>{first.value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      {rest.slice(0, compact ? 3 : 4).map((row) => (
        <div key={row.player.id} className="flex min-h-10 items-center justify-between gap-3 border-t border-hairline text-[0.9375rem]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="w-4 text-center pub-num text-muted-foreground">{row.position}</span>
            <span className="truncate font-medium">{row.player.name}</span>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">{row.team.name}</span>
          </span>
          <span className="pub-num text-lg">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Zakładki: podkreślenie w kolorze turnieju pod aktywną. Pasek przewija się w bok sam, nie strona. */
export function Tabs({ tabs, active = 'home', className, itemClassName }: { tabs: readonly PublicNavKey[]; active?: PublicNavKey; className?: string; itemClassName?: string }) {
  return (
    <nav aria-label="Sekcje turnieju" className={cn('flex gap-7 overflow-x-auto [scrollbar-width:none]', className)}>
      {tabs.map((key) => (
        <DeadLink
          key={key}
          aria-current={key === active ? 'page' : undefined}
          className={cn(
            'shrink-0 border-b-[3px] pb-2.5 pt-3 pub-tab transition-colors',
            key === active ? 'border-brand-line text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            itemClassName,
          )}
        >
          {TAB_LABELS[key]}
        </DeadLink>
      ))}
    </nav>
  )
}

export function Footer({ tournament }: { tournament: PublicShellTournament }) {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-[0.8125rem] text-muted-foreground sm:px-6">
        <span>Prowadzone w TournamentApp</span>
        <span>/t/{tournament.slug}</span>
      </div>
    </footer>
  )
}

/** Logo turnieju: wgrane albo domyślne (puchar na kolorze turnieju). */
export function TournamentMark({ tournament, className }: { tournament: PublicShellTournament; className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-md bg-brand text-brand-foreground', className)}>
      <svg viewBox="0 0 24 24" className="size-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
      <span className="sr-only">{tournament.name}</span>
    </span>
  )
}
