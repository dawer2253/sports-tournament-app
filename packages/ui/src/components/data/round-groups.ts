import { formatRoundDates } from '../../lib/kickoff'
import type { MatchRowData } from './match-row-data'
import type { RoundSummary } from './round-summary'

// Grupowanie meczów strony publicznej po kolejce i wybór kolejek Przeglądu.
// Osobno od `round-matches.tsx`, bo to funkcje, a nie komponent: korzystają
// z nich makiety i `apps/public`.

/** Kolejka z jej meczami w kolejności wyświetlania. */
export type RoundWithMatches = {
  summary: RoundSummary
  matches: MatchRowData[]
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
export function groupByRound(
  matches: readonly MatchInRound[],
  {
    direction = 'asc',
    stageOrder = (stageId) => stageId,
    timeZone,
  }: { direction?: 'asc' | 'desc'; stageOrder?: (stageId: number) => number; timeZone?: string } = {},
): RoundWithMatches[] {
  const byRound = new Map<number, MatchInRound[]>()
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
 * „Najbliższe mecze” Przeglądu: kolejka pierwszego meczu `scheduled`
 * w kolejności z API (`/fixtures` idzie rosnąco po terminie), a z niej
 * mecze `scheduled`, najwyżej `limit`. Mecz trwający ma własną sekcję.
 */
export function nextRoundMatches<M extends MatchInRound>(fixtures: readonly M[], limit = OVERVIEW_MATCHES_LIMIT): M[] {
  return firstRoundWith(fixtures, 'scheduled', limit)
}

/**
 * „Ostatnie wyniki” Przeglądu: kolejka pierwszego meczu z `/results`
 * (malejąco po terminie, więc najnowsza), a z niej mecze `finished`,
 * najwyżej `limit`.
 */
export function latestRoundMatches<M extends MatchInRound>(results: readonly M[], limit = OVERVIEW_MATCHES_LIMIT): M[] {
  return firstRoundWith(results, 'finished', limit)
}

/** Mecze o stanie `status` z kolejki pierwszego takiego meczu na liście, najwyżej `limit`. */
function firstRoundWith<M extends MatchInRound>(matches: readonly M[], status: M['status'], limit: number): M[] {
  const inStatus = matches.filter((match) => match.status === status)
  const roundId = inStatus[0]?.round.id
  return inStatus.filter((match) => match.round.id === roundId).slice(0, limit)
}
