/**
 * Pas bieżącego etapu na Przeglądzie (#296, wariant C „Kolejka” z #287):
 * podpis, nazwa kolejki albo rundy tablicą, fakty i tablica każdego meczu
 * etapu w jednym rzędzie, jak telebim.
 */
import type { MatchRowData } from '../components/data/match-row-data'
import { scorerSides } from '../components/data/scorer-lines'
import type { RoundWithMatches } from '../components/data/round-groups'
import { bracketWinnerSide } from '../lib/bracket'
import { formatKickoff, formatShortDay, matchDays } from '../lib/kickoff'
import { cn } from '../lib/utils'
import { Anchor } from './anchor'
import { Crest } from './crest'
import { Fact, PageHead } from './heads'
import { LiveTag } from './live'
import { matchPairLabel, sideName, teamOf, type Side } from './match-sides'
import type { StagePosition } from './overview-stage'

/** Stan nad parą: „Na żywo”, „Koniec” albo godzina (z dniem, gdy etap trwa kilka dni). */
function BoardState({ match, showDay, timeZone }: { match: MatchRowData; showDay: boolean; timeZone?: string }) {
  if (match.status === 'live') return <LiveTag clock={match} className="text-sm" />
  if (match.status === 'finished') return <span>Koniec</span>
  if (match.kickoffAt === null) return <span>{formatKickoff(null)}</span>
  return (
    <span data-slot="stage-board-kickoff" className="flex items-baseline gap-2">
      <span className="pub-num text-base text-foreground">{formatKickoff(match.kickoffAt, { showDate: false, timeZone })}</span>
      {showDay && <span>{formatShortDay(match.kickoffAt, timeZone)}</span>}
    </span>
  )
}

/** Linia drużyny: herb, nazwa (pusty slot kursywą), karne w nawiasie i wynik dużą liczbą. */
function BoardLine({ match, side, dim }: { match: MatchRowData; side: Side; dim: boolean }) {
  const team = teamOf(match, side)
  const played = match.status !== 'scheduled'
  const score = side === 'home' ? match.homeScore : match.awayScore
  const penalties = (side === 'home' ? match.homePenalties : match.awayPenalties) ?? null
  return (
    <span
      data-slot="stage-board-team"
      data-side={side}
      {...(dim && { 'data-dim': '' })}
      className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3', dim && 'text-muted-foreground')}
    >
      {team ? <Crest name={team.name} logoUrl={team.logoUrl} className="size-6" /> : <span aria-hidden className="size-6" />}
      <span className="flex min-w-0 items-baseline gap-2">
        <span className={cn('min-w-0 leading-snug wrap-break-word', !team ? 'font-normal italic' : dim ? 'font-medium' : 'font-semibold', !team && 'text-muted-foreground')}>
          {sideName(match, side)}
        </span>
        {penalties !== null && (
          <span data-slot="penalties" className="shrink-0 text-sm font-normal text-muted-foreground">
            ({penalties})<span className="sr-only"> w karnych</span>
          </span>
        )}
      </span>
      {/* Bez wyniku okienko zostaje puste, żeby wysokość tablic się nie zmieniała. */}
      <span data-slot="stage-board-score" className={cn('pub-score min-w-[1ch] text-right text-[2.25rem] leading-none', !played && 'invisible')}>
        {played ? score : 0}
      </span>
    </span>
  )
}

export interface StageMatchBoardProps {
  match: MatchRowData
  /** Etap rozłożony na kilka dni: przy godzinie stoi dzień. */
  showDay?: boolean
  timeZone?: string
  href?: string
  onNavigate?: () => void
}

/**
 * Tablica meczu w pasie etapu: stan nad parą („Koniec”, godzina albo „Na
 * żywo”) i obiekt, pod nimi dwie linie herb, nazwa i wynik dużą liczbą.
 * Przegrany (także po karnych) jest przygaszony, a mecz trwający ma
 * strzelców pod wynikiem. Cała tablica to odnośnik na stronę meczu.
 */
export function StageMatchBoard({ match, showDay = false, timeZone, href, onNavigate }: StageMatchBoardProps) {
  const live = match.status === 'live'
  const winner = bracketWinnerSide(match)
  const scorers = live ? scorerSides(match) : null
  const scorerLine = scorers && [...scorers.home, ...scorers.away].map((line) => `${line.name} ${line.detail}${line.ownGoal ? ' (sam.)' : ''}`)
  return (
    <Anchor
      href={href}
      onNavigate={onNavigate}
      data-slot="stage-board"
      data-status={match.status}
      aria-label={matchPairLabel(match)}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md bg-card p-4 ring-1 ring-inset transition-colors hover:bg-muted',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line',
        live ? 'ring-destructive/70' : 'ring-border',
      )}
    >
      <span className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <BoardState match={match} showDay={showDay} timeZone={timeZone} />
        {(match.bracket?.label ?? match.group ?? match.venue) && (
          <span className="flex min-w-0 flex-wrap justify-end gap-x-3 text-right">
            {(match.bracket?.label ?? match.group) && <span className="font-medium text-foreground">{match.bracket?.label ?? match.group}</span>}
            {match.venue && <span>{match.venue.name}</span>}
          </span>
        )}
      </span>
      <BoardLine match={match} side="home" dim={winner === 'away'} />
      <BoardLine match={match} side="away" dim={winner === 'home'} />
      {scorerLine && scorerLine.length > 0 && (
        <span data-slot="stage-board-scorers" className="text-xs leading-snug text-muted-foreground">
          {scorerLine.join(', ')}
        </span>
      )}
    </Anchor>
  )
}

/** Podpis pasa: miejsce etapu w terminarzu, kolejka albo runda. */
function eyebrow(position: StagePosition, unit: 'round' | 'knockout'): string {
  const where = { first: 'Pierwsza', current: 'Bieżąca', last: 'Ostatnia' }[position]
  return `${where} ${unit === 'round' ? 'kolejka' : 'runda'}`
}

export interface StageBandProps<M extends MatchRowData> {
  round: RoundWithMatches<M>
  position: StagePosition
  /** Kolejka ligi i grup (`round`) albo runda pucharu i playoffu (`knockout`). */
  unit: 'round' | 'knockout'
  /** Liga: wszystkie kolejki terminarza („z 14 kolejek”). */
  roundsTotal?: number
  timeZone?: string
  matchHref?: (match: M) => string
  onMatchNavigate?: (match: M) => void
}

/**
 * Pas etapu: podpis („Bieżąca kolejka”, „Pierwsza runda”…), nazwa etapu
 * tablicą (`h2`), daty, „2 z 4 rozegrane” i w lidze „z 14 kolejek”, bez
 * kropek między faktami. Pod spodem tablica każdego meczu etapu: na telefonie
 * jedna pod drugą, od `sm` po dwie, od `lg` po cztery w rzędzie.
 */
export function StageBand<M extends MatchRowData>({ round, position, unit, roundsTotal, timeZone, matchHref, onMatchNavigate }: StageBandProps<M>) {
  const { summary, matches } = round
  const id = `etap-${summary.id}`
  const showDay = matchDays(matches.map((match) => match.kickoffAt), timeZone).length > 1
  return (
    <section aria-labelledby={id} data-slot="stage-band" className="flex flex-col gap-5">
      <PageHead
        id={id}
        eyebrow={eyebrow(position, unit)}
        title={summary.name}
        meta={
          <>
            <Fact>{summary.dates}</Fact>
            <Fact value={summary.finished}>z {summary.total} rozegrane</Fact>
            {roundsTotal !== undefined && <Fact>z {roundsTotal} {roundsTotal === 1 ? 'kolejki' : 'kolejek'}</Fact>}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {matches.map((match) => (
          <StageMatchBoard
            key={match.id}
            match={match}
            showDay={showDay}
            timeZone={timeZone}
            href={matchHref?.(match)}
            onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
          />
        ))}
      </div>
    </section>
  )
}
