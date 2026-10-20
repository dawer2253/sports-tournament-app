import type { MatchPageMatch, MatchPageTeam } from '../components/data/match-page-data'
import { Penalties } from '../components/data/penalties'
import { scorerSides, type ScorerLine } from '../components/data/scorer-lines'
import { bracketLoserSide, bracketWinnerSide } from '../lib/bracket'
import { formatKickoff } from '../lib/kickoff'
import type { SetScore } from '../lib/sets'
import { cn } from '../lib/utils'
import { Crest } from './crest'
import { LiveClock, LiveTag } from './live'
import { UNKNOWN_SLOT, type Side } from './match-sides'

export interface MatchBoardProps {
  match: MatchPageMatch
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  className?: string
}

function teamName(team: MatchPageTeam | null) {
  return team?.name ?? UNKNOWN_SLOT
}

/** Przygaszenie strony przegranej: `data-dim` dla funkcji `play`, kolor przez `cn`. */
function dimProps(dim: boolean, side: Side) {
  return { 'data-side': side, ...(dim && { 'data-dim': '' }) }
}

/** Fakty nad tablicą bez kropek: pozycja w pucharze albo kolejka, termin, obiekt. */
function Facts({ match, timeZone }: { match: MatchPageMatch; timeZone?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-center text-pub-14 text-muted-foreground">
      {/* W pucharze etykieta pozycji: mecz o 3. miejsce gra w rundzie „Finał” (#234). */}
      <span className="font-medium text-foreground">{match.bracket?.label ?? match.round.name}</span>
      <span>{formatKickoff(match.kickoffAt, { timeZone })}</span>
      {match.venue && <span>{match.venue.name}</span>}
    </div>
  )
}

function Team({ team, side, dim }: { team: MatchPageTeam | null; side: Side; dim: boolean }) {
  return (
    <div
      data-slot="match-board-team"
      {...dimProps(dim, side)}
      className={cn('flex min-w-0 flex-col items-center gap-3 text-center', dim && 'text-muted-foreground')}
    >
      <Crest name={teamName(team)} logoUrl={team?.logoUrl ?? null} className="size-12 sm:size-24" />
      <span className="w-full pub-title text-pub-14 leading-tight text-balance wrap-break-word sm:text-pub-40">{teamName(team)}</span>
    </div>
  )
}

/** Okienko wyniku tablicy: duża cyfra na `--pub-sunken`. */
function ScoreWindow({ value, side, dim }: { value: number | null; side: Side; dim: boolean }) {
  return (
    <span
      data-slot="score-window"
      {...dimProps(dim, side)}
      className={cn(
        'grid min-w-14 place-items-center rounded-md bg-sunken px-2 py-2 pub-score text-pub-40 leading-none sm:min-w-[7.5rem] sm:px-3 sm:py-3 sm:text-pub-120',
        dim && 'text-muted-foreground',
      )}
    >
      {value ?? '–'}
    </span>
  )
}

/**
 * Środek tablicy: dwa okienka wyniku z karnymi w nawiasie obok wyniku każdej
 * drużyny, „(3) 1 1 (4)”: gospodarza z lewej, gościa z prawej, pogrubione
 * u zwycięzcy (#234), albo, przed meczem, godzina. Nazwa dla czytnika:
 * „Wynik 1 : 1, karne 4 : 3”.
 */
function Score({ match, loser, timeZone }: { match: MatchPageMatch; loser: Side | null; timeZone?: string }) {
  if (match.status === 'scheduled') {
    return (
      <p data-slot="match-board-kickoff" className="pub-score text-pub-40 leading-none sm:text-pub-64">
        {match.kickoffAt ? formatKickoff(match.kickoffAt, { showDate: false, timeZone }) : '–'}
      </p>
    )
  }
  const score = `${match.homeScore ?? '–'} : ${match.awayScore ?? '–'}`
  const penalties = match.homePenalties != null && match.awayPenalties != null
  const winner = bracketWinnerSide(match)
  const label = penalties ? `Wynik ${score}, karne ${match.homePenalties} : ${match.awayPenalties}` : `Wynik ${score}`
  const pens = 'pub-num text-pub-16 sm:text-pub-20'
  return (
    <div role="img" aria-label={label} className="flex items-center gap-1 sm:gap-2">
      {penalties && <Penalties value={match.homePenalties} won={winner === 'home'} className={pens} />}
      <ScoreWindow value={match.homeScore} side="home" dim={loser === 'home'} />
      <ScoreWindow value={match.awayScore} side="away" dim={loser === 'away'} />
      {penalties && <Penalties value={match.awayPenalties} won={winner === 'away'} className={pens} />}
    </div>
  )
}

/**
 * Wyniki setów pod tablicą (#301): „1. set 25:23” po kolei, z wynikiem
 * zwycięzcy seta pogrubionym. W meczu trwającym ostatni set to bieżący stan.
 */
function Sets({ sets }: { sets: readonly SetScore[] }) {
  return (
    <ol aria-label="Sety" data-slot="match-board-sets" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-pub-16">
      {sets.map((set, index) => (
        <li key={index} className="whitespace-nowrap">
          <span className="text-pub-14 text-muted-foreground">{index + 1}. set</span>{' '}
          <span className="pub-num">
            <span className={cn(set.home > set.away && 'font-semibold')}>{set.home}</span>:
            <span className={cn(set.away > set.home && 'font-semibold')}>{set.away}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Scorers({ lines, team }: { lines: ScorerLine[]; team: string }) {
  if (lines.length === 0) return <span />
  return (
    <ul aria-label={`Strzelcy: ${team}`} className="flex min-w-0 flex-col items-center gap-1 text-center text-pub-14 text-muted-foreground">
      {lines.map((line) => (
        <li key={line.key} className="wrap-break-word">
          {line.name}{' '}
          <span className="whitespace-nowrap text-foreground tabular-nums">
            {line.detail}
            {line.ownGoal && ' (sam.)'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Tablica strony meczu (#295, projekt A „Tablica” z #288): na `--card`, nad
 * nią fakty meczu, dalej herby i nazwy drużyn, wynik w dwóch okienkach i stan
 * („Na żywo”, „Koniec”), a pod linią strzelcy. Mecz zaplanowany ma godzinę
 * w miejscu wyniku i nie ma strzelców.
 *
 * - Boczne kolumny siatki są równe (`minmax(0, 1fr)`), więc wynik stoi na
 *   środku tablicy niezależnie od długości nazw (#162).
 * - Przegrany przygaszony, także po remisie rozstrzygniętym karnymi.
 * - Strzelcy wszyscy (`limit: Infinity`, #192), z samobójem u przeciwnika
 *   strzelca i dopiskiem „(sam.)” (`scorerSides`, #208).
 * - Region nazwany parą: „Mecz: Gospodarz – Gość”.
 * - W sporcie z setami (#301) okienka niosą sety wygrane, a pod tablicą stoją
 *   wyniki setów (`Sets`).
 */
export function MatchBoard({ match, timeZone, className }: MatchBoardProps) {
  const home = teamName(match.homeTeam)
  const away = teamName(match.awayTeam)
  const scheduled = match.status === 'scheduled'
  const loser = bracketLoserSide(match)
  const scorers = scorerSides(match, { limit: Infinity })
  const hasScorers = !scheduled && scorers.home.length + scorers.away.length > 0
  const sets = !scheduled && match.sets && match.sets.length > 0 ? match.sets : null

  return (
    <section
      aria-label={`Mecz: ${home} – ${away}`}
      data-slot="match-board"
      className={cn('flex flex-col gap-6 rounded-md bg-card px-4 py-8 ring-1 ring-border ring-inset sm:px-10 sm:py-10', className)}
    >
      <Facts match={match} timeZone={timeZone} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
        <Team team={match.homeTeam} side="home" dim={loser === 'home'} />
        <div data-slot="match-board-score" className="flex flex-col items-center gap-3">
          <Score match={match} loser={loser} timeZone={timeZone} />
          {match.status === 'live' && (
            // Na telefonie zegar pod „Na żywo”: obok poszerzałby środek tablicy kosztem nazw drużyn.
            <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
              <LiveTag className="text-pub-20" />
              <LiveClock clock={match} className="pub-tab text-pub-20" />
            </span>
          )}
          {match.status === 'finished' && <span className="pub-tab text-pub-20 text-muted-foreground">Koniec</span>}
        </div>
        <Team team={match.awayTeam} side="away" dim={loser === 'away'} />
      </div>
      {sets && <Sets sets={sets} />}
      {hasScorers && (
        <div className="grid grid-cols-2 gap-x-6 border-t border-hairline pt-5 sm:gap-x-8">
          <Scorers lines={scorers.home} team={home} />
          <Scorers lines={scorers.away} team={away} />
        </div>
      )}
    </section>
  )
}
