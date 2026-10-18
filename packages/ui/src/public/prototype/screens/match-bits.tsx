/**
 * PROTOTYP S7 (#288) — drobne klocki meczu wspólne dla Terminarza, Wyników,
 * Drabinki i strony meczu: nazwa drużyny albo źródło pustego slotu, karne
 * przy nazwie, podpis pozycji (puchar, grupa) i strzelcy.
 */
import type { MatchScorer } from '../../../components/data/match-row-data'
import { formatKickoff, formatMatchDay } from '../../../lib/kickoff'
import { cn } from '../../../lib/utils'
import { scorersFor } from '../parts'
import type { ScreenMatch } from './screen-demo'

export type Side = 'home' | 'away'

export function teamOf(match: ScreenMatch, side: Side) {
  return side === 'home' ? match.homeTeam : match.awayTeam
}

export function scoreOf(match: ScreenMatch, side: Side) {
  return side === 'home' ? match.homeScore : match.awayScore
}

/** Przegrany meczu zakończonego (z karnymi), do przygaszenia. */
export function lost(match: ScreenMatch, side: Side): boolean {
  if (match.status !== 'finished') return false
  const own = scoreOf(match, side) ?? 0
  const other = scoreOf(match, side === 'home' ? 'away' : 'home') ?? 0
  if (own !== other) return own < other
  const pens = side === 'home' ? [match.homePenalties, match.awayPenalties] : [match.awayPenalties, match.homePenalties]
  return pens[0] != null && pens[1] != null && pens[0] < pens[1]
}

/** Karne przy nazwie, poza polem wyniku (#218): „(4)”. */
export function Penalties({ match, side }: { match: ScreenMatch; side: Side }) {
  const value = side === 'home' ? match.homePenalties : match.awayPenalties
  if (value == null) return null
  return (
    <span className="shrink-0 text-sm font-normal text-muted-foreground">
      ({value})<span className="sr-only"> w karnych</span>
    </span>
  )
}

/** Nazwa drużyny albo, w pustym slocie drabinki, skąd przyjdzie. */
export function TeamName({ match, side, className }: { match: ScreenMatch; side: Side; className?: string }) {
  const team = teamOf(match, side)
  if (team) return <span className={cn('truncate', className)}>{team.name}</span>
  const source = side === 'home' ? match.bracket?.homeSource : match.bracket?.awaySource
  return <span className={cn('truncate font-normal italic text-muted-foreground', className)}>{source ?? 'Do ustalenia'}</span>
}

/** Podpis pozycji meczu: „Półfinał 1”, „Grupa A”; liga go nie ma. */
export function positionLabel(match: ScreenMatch): string | undefined {
  return match.bracket?.label ?? match.group
}

export function kickoffTime(match: ScreenMatch, timeZone: string) {
  return formatKickoff(match.kickoffAt, { showDate: false, timeZone })
}

export function kickoffDay(match: ScreenMatch, timeZone: string) {
  return match.kickoffAt ? formatMatchDay(match.kickoffAt, timeZone) : 'Termin do ustalenia'
}

/** Krótki dzień do kolumny wiersza: „sob. 3.10”. */
export function shortDay(match: ScreenMatch, timeZone: string) {
  if (!match.kickoffAt) return '—'
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone }).format(new Date(match.kickoffAt)).replace(',', '')
}

/** Strzelec: piłka z minutami („Kowalski 12', 40'”), kosz z sumą („Dąb 24”). */
export function scorerText(scorer: MatchScorer, sport: 'football' | 'basketball') {
  const surname = scorer.player.name.split(' ').at(-1)
  if (sport === 'basketball') return `${surname} ${scorer.value}`
  const minutes = scorer.minutes.length === scorer.value ? scorer.minutes.map((minute) => `${minute}'`).join(', ') : `×${scorer.value}`
  return `${surname} ${minutes}${scorer.ownGoal ? ' (sam.)' : ''}`
}

/** Strzelcy jednej strony jednym ciągiem; pusto, gdy ich nie ma. */
export function sideScorers(match: ScreenMatch, side: Side, sport: 'football' | 'basketball') {
  return scorersFor(match, side).map((scorer) => scorerText(scorer, sport)).join(', ')
}

/** Polska odmiana „mecz” z przymiotnikiem: „1 mecz zakończony”, „3 mecze zakończone”, „5 meczów zakończonych”. */
export function matchesWord(count: number, [one, few, many]: [string, string, string]) {
  const lastDigit = count % 10
  const lastTwo = count % 100
  if (count === 1) return one
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}
