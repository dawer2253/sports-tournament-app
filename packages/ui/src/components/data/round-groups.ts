import { formatRoundDates } from '../../lib/kickoff'
import type { MatchRowData } from './match-row-data'
import type { RoundSummary } from './round-summary'

// Grupowanie meczów strony publicznej po kolejce i porcje listy kolejek.
// Osobno od `public/round-sections.tsx`, bo to funkcje, a nie komponent:
// korzystają z nich makiety i `apps/public`. Etap Przeglądu wybiera
// `public/overview-stage.ts`.

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

/** Ile kolejek pokazuje pierwsza porcja i ile dokłada każde „Pokaż więcej”. */
export const ROUNDS_PER_PAGE = 3

/** Porcja listy kolejek: ile pokazać, `id` ostatniej pokazanej i ostatniej po „Pokaż więcej”. */
export type RoundsPage = {
  shown: number
  lastShown: number | null
  /** `id` ostatniej kolejki po „Pokaż więcej”; `null`, gdy komplet już widać. */
  more: number | null
}

/**
 * Porcja Terminarza i Wyników (#226). Lista pamięta `id` ostatniej pokazanej
 * kolejki (`lastShown`), nie liczbę porcji, także przed pierwszym kliknięciem:
 * nowa kolejka na górze Wyników wchodzi przy odpytywaniu ponad to, co widać,
 * a koniec meczu trwającego nie skraca porcji, więc nic nie spada pod „Pokaż
 * więcej”. Na start widać `ROUNDS_PER_PAGE` kolejek, a gdy mecz trwa
 * w dalszej, porcja sięga do ostatniej kolejki z meczem trwającym włącznie.
 * Gdy zapamiętanej kolejki nie ma w danych (Terminarz: jej ostatni mecz się
 * zakończył), lista wraca do domyślnej porcji.
 */
export function roundsPage(rounds: readonly RoundWithMatches[], lastShown: number | null): RoundsPage {
  const liveIndex = rounds.findLastIndex((round) => round.matches.some((match) => match.status === 'live'))
  const initial = Math.max(ROUNDS_PER_PAGE, liveIndex + 1)
  const lastShownIndex = rounds.findIndex((round) => round.summary.id === lastShown)
  const shown = Math.min(Math.max(initial, lastShownIndex + 1), rounds.length)
  return {
    shown,
    lastShown: rounds[shown - 1]?.summary.id ?? null,
    more: shown < rounds.length ? rounds[Math.min(shown + ROUNDS_PER_PAGE, rounds.length) - 1]!.summary.id : null,
  }
}
