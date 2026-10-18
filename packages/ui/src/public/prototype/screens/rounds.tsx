/**
 * PROTOTYP S7 (#288) — Terminarz i Wyniki w trzech wariantach.
 *
 * Zostaje zachowanie z #226: jedna lista kolejek z nagłówkami, trzy kolejki
 * na start (albo do kolejki z meczem trwającym) i „Pokaż więcej”. Warianty
 * różnią się tym, jak wygląda kolejka i mecz:
 * - A „Lista”: belka kolejki i gęsty wiersz na stałych kolumnach;
 * - B „Tablice”: każda kolejka jak pas z Przeglądu, tablica na mecz;
 * - C „Szyna”: numer kolejki wielką liczbą w lewej kolumnie, która jedzie
 *   z przewijaniem, mecze po dniach obok.
 */
import * as React from 'react'
import type { RoundWithMatches } from '../../../components/data/round-groups'
import { matchDays } from '../../../lib/kickoff'
import { cn } from '../../../lib/utils'
import { Crest, DeadLink, LiveTag, ScoreCell } from '../parts'
import { EmptyBoard, Fact, PageHead, PubButton, Shell, TextLink } from './kit'
import {
  kickoffDay,
  kickoffTime,
  lost,
  matchesWord,
  Penalties,
  positionLabel,
  scoreOf,
  shortDay,
  sideScorers,
  TeamName,
  teamOf,
  type Side,
} from './match-bits'
import { allRounds, fixtureRounds, resultRounds, type Season, type ScreenMatch } from './screen-demo'

export const ROUND_VARIANTS = { A: 'Lista', B: 'Tablice', C: 'Szyna' } as const
export type RoundVariant = keyof typeof ROUND_VARIANTS
export type RoundsMode = 'fixtures' | 'results'

type Round = RoundWithMatches<ScreenMatch>

const PER_PAGE = 3

/** Porcje kolejek jak w `RoundSections`: na start do kolejki z meczem trwającym włącznie. */
function usePaging(rounds: Round[]) {
  const live = rounds.findLastIndex((round) => round.matches.some((match) => match.status === 'live'))
  const [extra, setExtra] = React.useState(0)
  const shown = Math.min(Math.max(PER_PAGE, live + 1) + extra, rounds.length)
  return { visible: rounds.slice(0, shown), more: shown < rounds.length ? () => setExtra(extra + PER_PAGE) : undefined }
}

function MoreButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null
  return (
    <div className="flex justify-center">
      <PubButton onClick={onClick}>Pokaż więcej</PubButton>
    </div>
  )
}

/** Kolejka rozłożona na kilka dni pokazuje dzień w wierszu (#226). */
function multiDay(round: Round, timeZone: string) {
  return matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length > 1
}

function byDay(round: Round, timeZone: string): [string, ScreenMatch[]][] {
  const days = new Map<string, ScreenMatch[]>()
  for (const match of round.matches) {
    const day = kickoffDay(match, timeZone)
    days.set(day, [...(days.get(day) ?? []), match])
  }
  return [...days.entries()]
}

function progress(round: Round, mode: RoundsMode) {
  if (mode === 'results') return null
  return (
    <Fact value={round.summary.finished}>z {round.summary.total} rozegrane</Fact>
  )
}

/** Herb drużyny; pusty slot drabinki zostawia samo miejsce, żeby kolumny się nie przesunęły. */
function SlotCrest({ match, side, className }: { match: ScreenMatch; side: Side; className: string }) {
  const team = teamOf(match, side)
  return team ? <Crest name={team.name} className={className} /> : <span aria-hidden className={cn('shrink-0', className)} />
}

// --- A „Lista” ------------------------------------------------------------------

/**
 * Wiersz meczu na stałych kolumnach: termin | gospodarz | wynik | gość |
 * pozycja i obiekt. Wynik stoi zawsze w tym samym miejscu (#162). Na
 * telefonie: termin z lewej, dwie linie drużyna–wynik.
 */
export function MatchLine({ match, data, showDay, mode }: { match: ScreenMatch; data: Season; showDay: boolean; mode: RoundsMode }) {
  const live = match.status === 'live'
  const played = match.status !== 'scheduled'
  const label = positionLabel(match)
  const scorers = mode === 'results' || live ? [sideScorers(match, 'home', data.sport), sideScorers(match, 'away', data.sport)] : ['', '']
  const name = (side: Side) => cn('flex min-w-0 items-center gap-2.5', lost(match, side) ? 'text-muted-foreground' : 'font-semibold')
  const when = (
    <span className="flex flex-col whitespace-nowrap leading-tight">
      {live ? (
        <LiveTag className="text-sm" />
      ) : mode === 'results' ? (
        <span className="pub-num text-base text-muted-foreground">{shortDay(match, data.timeZone)}</span>
      ) : (
        <>
          <span className="pub-num text-xl">{kickoffTime(match, data.timeZone)}</span>
          {showDay && <span className="text-xs text-muted-foreground">{shortDay(match, data.timeZone)}</span>}
        </>
      )}
    </span>
  )
  return (
    <DeadLink className={cn('block border-b border-hairline hover:bg-card/60', live && 'bg-destructive/5')}>
      {/* Szeroki układ */}
      <span className="hidden min-h-16 grid-cols-[5.5rem_minmax(0,1fr)_6rem_minmax(0,1fr)_8.5rem] items-center gap-x-4 py-2.5 sm:grid">
        {when}
        <span className={cn(name('home'), 'justify-end text-right')}>
          <Penalties match={match} side="home" />
          <TeamName match={match} side="home" />
          <SlotCrest match={match} side="home" className="size-6" />
        </span>
        <span className="flex justify-center gap-1">
          {played ? (
            <>
              <ScoreCell value={match.homeScore} dim={lost(match, 'home')} className="min-w-11" />
              <ScoreCell value={match.awayScore} dim={lost(match, 'away')} className="min-w-11" />
            </>
          ) : (
            <span aria-hidden className="text-muted-foreground">–</span>
          )}
        </span>
        <span className={name('away')}>
          <SlotCrest match={match} side="away" className="size-6" />
          <TeamName match={match} side="away" />
          <Penalties match={match} side="away" />
        </span>
        <span className="flex flex-col items-end text-right text-sm leading-tight text-muted-foreground">
          {label && <span className="font-medium text-foreground">{label}</span>}
          <span>{match.venue?.name}</span>
        </span>
        {(scorers[0] || scorers[1]) && (
          <>
            <span />
            <span className="-mt-1.5 text-right text-xs text-muted-foreground">{scorers[0]}</span>
            <span />
            <span className="-mt-1.5 text-xs text-muted-foreground">{scorers[1]}</span>
          </>
        )}
      </span>
      {/* Telefon */}
      <span className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 sm:hidden">
        <span className="row-span-2 self-start pt-0.5">{when}</span>
        {(['home', 'away'] as const).map((side) => (
          <React.Fragment key={side}>
            <span className={cn(name(side), 'col-start-2')}>
              <SlotCrest match={match} side={side} className="size-5" />
              <TeamName match={match} side={side} />
              <Penalties match={match} side={side} />
            </span>
            <span className={cn('pub-num text-xl', !played && 'text-transparent', lost(match, side) && 'text-muted-foreground')}>
              {played ? scoreOf(match, side) : 0}
            </span>
          </React.Fragment>
        ))}
        {label && <span className="col-start-2 text-xs text-muted-foreground">{label}</span>}
      </span>
    </DeadLink>
  )
}

function ListRound({ round, data, mode }: { round: Round; data: Season; mode: RoundsMode }) {
  const showDay = multiDay(round, data.timeZone)
  return (
    <section aria-labelledby={`r-${round.summary.id}`} className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-rule pb-2">
        <span className="flex flex-wrap items-baseline gap-x-4">
          <h2 id={`r-${round.summary.id}`} className="pub-h2 text-[2rem]">{round.summary.name}</h2>
          <span className="text-muted-foreground">{round.summary.dates}</span>
        </span>
        <span className="text-sm text-muted-foreground">{progress(round, mode)}</span>
      </div>
      {round.matches.map((match) => <MatchLine key={match.id} match={match} data={data} showDay={showDay} mode={mode} />)}
    </section>
  )
}

// --- B „Tablice” ----------------------------------------------------------------

export function Board({ match, data, mode }: { match: ScreenMatch; data: Season; mode: RoundsMode }) {
  const live = match.status === 'live'
  const played = match.status !== 'scheduled'
  const label = positionLabel(match)
  const scorers = (['home', 'away'] as const).map((side) => sideScorers(match, side, data.sport)).filter(Boolean)
  return (
    <DeadLink
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md bg-card p-4 ring-1 ring-inset hover:bg-muted',
        live ? 'ring-destructive/70' : 'ring-border',
      )}
    >
      <span className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground">
        {live ? (
          <LiveTag className="text-sm" />
        ) : mode === 'results' || match.status === 'finished' ? (
          <span>{shortDay(match, data.timeZone)}</span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="pub-num text-base text-foreground">{kickoffTime(match, data.timeZone)}</span>
            <span>{shortDay(match, data.timeZone)}</span>
          </span>
        )}
        <span className="truncate">{label ?? match.venue?.name}</span>
      </span>
      {(['home', 'away'] as const).map((side) => (
        <span key={side} className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3', lost(match, side) ? 'text-muted-foreground' : 'font-semibold')}>
          <SlotCrest match={match} side={side} className="size-6" />
          <span className="flex min-w-0 items-center gap-1.5">
            <TeamName match={match} side={side} />
            <Penalties match={match} side={side} />
          </span>
          <span className={cn('pub-score text-[2.25rem] leading-none', !played && 'text-transparent')}>{played ? scoreOf(match, side) : 0}</span>
        </span>
      ))}
      {(mode === 'results' || live) && scorers.length > 0 && (
        <span className="line-clamp-2 text-xs text-muted-foreground">{scorers.join(', ')}</span>
      )}
      {label && <span className="-mt-1 text-xs text-muted-foreground">{match.venue?.name}</span>}
    </DeadLink>
  )
}

function BoardRound({ round, data, mode }: { round: Round; data: Season; mode: RoundsMode }) {
  return (
    <section aria-labelledby={`r-${round.summary.id}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
        <h2 id={`r-${round.summary.id}`} className="pub-title text-[2.25rem] sm:text-[2.75rem]">{round.summary.name}</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 text-muted-foreground">
          <span>{round.summary.dates}</span>
          {progress(round, mode)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {round.matches.map((match) => <Board key={match.id} match={match} data={data} mode={mode} />)}
      </div>
    </section>
  )
}

// --- C „Szyna” ------------------------------------------------------------------

/** Pasek postępu kolejki: kreska na mecz, rozegrany w kolorze turnieju, trwający czerwony. */
function RoundProgress({ round }: { round: Round }) {
  const { finished, total } = round.summary
  const live = round.matches.filter((match) => match.status === 'live').length
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            index < finished ? 'bg-brand-line' : index < finished + live ? 'bg-destructive' : 'bg-muted',
          )}
        />
      ))}
    </span>
  )
}

function RailRound({ round, data, mode }: { round: Round; data: Season; mode: RoundsMode }) {
  const numbered = /^Kolejka \d+$/.test(round.summary.name)
  return (
    <section aria-labelledby={`r-${round.summary.id}`} className="grid gap-x-10 gap-y-3 border-t-2 border-rule pt-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="flex items-end gap-4 lg:sticky lg:top-6 lg:flex-col lg:items-stretch lg:gap-3 lg:self-start">
        <h2 id={`r-${round.summary.id}`} className="flex items-baseline gap-3 lg:flex-col lg:gap-0">
          {numbered ? (
            <>
              <span className="pub-tab text-base text-muted-foreground">Kolejka</span>
              <span className="pub-score text-[3.5rem] lg:text-[7rem]">{round.summary.name.replace('Kolejka ', '')}</span>
            </>
          ) : (
            <span className="pub-title text-[2rem] lg:text-[2.25rem]">{round.summary.name}</span>
          )}
        </h2>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span>{round.summary.dates}</span>
          {mode === 'fixtures' && (
            <span className="hidden flex-col gap-2 lg:flex">
              <RoundProgress round={round} />
              {progress(round, mode)}
            </span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {byDay(round, data.timeZone).map(([day, matches]) => (
          <div key={day} className="flex flex-col">
            {multiDay(round, data.timeZone) && <span className="pb-1 text-sm font-medium text-muted-foreground first-letter:uppercase">{day}</span>}
            {matches.map((match) => <MatchLine key={match.id} match={match} data={data} showDay={false} mode={mode} />)}
          </div>
        ))}
      </div>
    </section>
  )
}

// --- Ekran ----------------------------------------------------------------------

const RENDER: Record<RoundVariant, (props: { round: Round; data: Season; mode: RoundsMode }) => React.ReactNode> = {
  A: ListRound,
  B: BoardRound,
  C: RailRound,
}

function Empty({ data, mode }: { data: Season; mode: RoundsMode }) {
  if (data.state === 'bez-terminarza') {
    return (
      <EmptyBoard title="Terminarz jeszcze nie jest ułożony" action={<TextLink>Zobacz drużyny na Przeglądzie</TextLink>}>
        Mecze pojawią się tutaj, gdy organizator ułoży terminarz.
      </EmptyBoard>
    )
  }
  if (mode === 'fixtures') {
    return (
      <EmptyBoard title="Wszystkie mecze rozegrane" action={<TextLink>Zobacz wyniki</TextLink>}>
        Terminarz jest pusty, bo turniej się zakończył.
      </EmptyBoard>
    )
  }
  return (
    <EmptyBoard title="Jeszcze nie ma wyników" action={<TextLink>Zobacz terminarz</TextLink>}>
      Pierwsze wyniki pojawią się tutaj po pierwszym zakończonym meczu.
    </EmptyBoard>
  )
}

export function RoundsScreen({ data, accent, mode, variant }: { data: Season; accent: string; mode: RoundsMode; variant: RoundVariant }) {
  // Postęp kolejki liczony z całej kolejki, nie z meczów, które zostały w Terminarzu.
  const totals = new Map(allRounds(data).map((round) => [round.summary.id, round.summary]))
  const rounds = (mode === 'fixtures' ? fixtureRounds(data) : resultRounds(data)).map((round) => {
    const total = totals.get(round.summary.id)!
    return { ...round, summary: { ...round.summary, finished: total.finished, total: total.total } }
  })
  const { visible, more } = usePaging(rounds)
  const count = rounds.reduce((sum, round) => sum + round.matches.length, 0)
  const Round = RENDER[variant]
  const word =
    mode === 'fixtures'
      ? matchesWord(count, ['mecz przed nami', 'mecze przed nami', 'meczów przed nami'])
      : matchesWord(count, ['mecz zakończony', 'mecze zakończone', 'meczów zakończonych'])

  return (
    <Shell tournament={data.tournament} tabs={data.tabs} active={mode} accent={accent}>
      <PageHead title={mode === 'fixtures' ? 'Terminarz' : 'Wyniki'} meta={count > 0 && <Fact value={count}>{word}</Fact>} />
      {rounds.length === 0 ? (
        <Empty data={data} mode={mode} />
      ) : (
        <div className={cn('flex flex-col', variant === 'B' ? 'gap-12' : 'gap-10')}>
          {visible.map((round) => <Round key={round.summary.id} round={round} data={data} mode={mode} />)}
          <MoreButton onClick={more} />
        </div>
      )}
    </Shell>
  )
}
