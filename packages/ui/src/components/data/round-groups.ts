import { formatRoundDates } from '../../lib/kickoff'
import type { MatchRowData, MatchStatus } from './match-row-data'
import type { RoundSummary } from './round-summary'

// Grupowanie meczów strony publicznej po kolejce i wybór kolejek Przeglądu.
// Osobno od `round-matches.tsx`, bo to funkcje, a nie komponent: korzystają
// z nich makiety i `apps/public`.

/** Kolejka z jej meczami w kolejności wyświetlania. */
export type RoundWithMatches<M extends MatchRowData = MatchRowData> = {
  summary: RoundSummary
  matches: M[]
}

/** Mecz z kolejką, jak `Match` z kontraktu (`round`, `stageId`). */
export type MatchInRound = MatchRowData & {
  stageId?: number
  round: { id: number; name: string; order: number }
}

/**
 * Mecze pogrupowane po kolejce, w kolejności faz (`stageOrder`, domyślnie po
 * `stageId`) i kolejek — rosnąco (`asc`, Terminarz) albo od najnowszej
 * (`desc`, Wyniki). W kolejce mecze zostają w kolejności z wejścia, czyli
 * z API. Kolejka bez meczów nie powstaje.
 */
export function groupByRound<M extends MatchInRound>(
  matches: readonly M[],
  {
    direction = 'asc',
    stageOrder = (stageId) => stageId,
    timeZone,
  }: { direction?: 'asc' | 'desc'; stageOrder?: (stageId: number) => number; timeZone?: string } = {},
): RoundWithMatches<M>[] {
  const byRound = new Map<number, M[]>()
  for (const match of matches) byRound.set(match.round.id, [...(byRound.get(match.round.id) ?? []), match])

  const sign = direction === 'asc' ? 1 : -1
  return [...byRound.values()]
    .toSorted((a, b) => {
      const [first, second] = [a[0]!, b[0]!]
      const stages = stageOrder(first.stageId ?? 0) - stageOrder(second.stageId ?? 0)
      return sign * (stages || first.round.order - second.round.order)
    })
    .map((roundMatches) => {
      const { id, name } = roundMatches[0]!.round
      return {
        summary: {
          id,
          name,
          dates: formatRoundDates(roundMatches.map((match) => match.kickoffAt), timeZone),
          finished: roundMatches.filter((match) => match.status === 'finished').length,
          total: roundMatches.length,
        },
        matches: roundMatches,
      }
    })
}

/** Ile meczów pokazują „Najbliższe mecze” i „Ostatnie wyniki” na Przeglądzie. */
export const OVERVIEW_MATCHES_LIMIT = 5

/**
 * „Najbliższe mecze” Przeglądu: pierwsza kolejka Terminarza (`groupByRound`
 * rosnąco) z meczem `scheduled`, a z niej mecze `scheduled`, najwyżej
 * `limit`. Mecz trwający ma własną sekcję. Kolejka jest ta sama, którą
 * Terminarz pokazuje pierwszą, więc „Cały terminarz” prowadzi dalej, a nie
 * gdzie indziej.
 */
export function nextRoundMatches<M extends MatchRowData>(rounds: readonly RoundWithMatches<M>[], limit = OVERVIEW_MATCHES_LIMIT): M[] {
  return firstRoundWith(rounds, 'scheduled', limit)
}

/**
 * „Ostatnie wyniki” Przeglądu: pierwsza kolejka Wyników (`groupByRound`
 * od najnowszej), a z niej mecze `finished`, najwyżej `limit` — ta sama
 * kolejka, na której otwierają się Wyniki.
 */
export function latestRoundMatches<M extends MatchRowData>(rounds: readonly RoundWithMatches<M>[], limit = OVERVIEW_MATCHES_LIMIT): M[] {
  return firstRoundWith(rounds, 'finished', limit)
}

/** Mecze o stanie `status` z pierwszej kolejki, która takie ma, najwyżej `limit`. */
function firstRoundWith<M extends MatchRowData>(rounds: readonly RoundWithMatches<M>[], status: MatchStatus, limit: number): M[] {
  for (const round of rounds) {
    const inStatus = round.matches.filter((match) => match.status === status)
    if (inStatus.length > 0) return inStatus.slice(0, limit)
  }
  return []
}
