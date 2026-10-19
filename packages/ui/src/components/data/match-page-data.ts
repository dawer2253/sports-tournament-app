import type { MatchEventRow } from './match-event-data'
import type { MatchRowData } from './match-row-data'

/**
 * Strona meczu (`PublicMatchDetail` z kontraktu, #210): podzbiór przepisany
 * ręcznie, bo pakiet UI nie zna klienta API — zgodność pilnuje
 * `apps/public/src/lib/contract-guard.ts`.
 *
 * Mieszka osobno z tego samego powodu co `MatchRowData`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentów.
 */

/** Drużyna na tablicy meczu: z herbem, gdy klub go wgrał. */
export type MatchPageTeam = { id: number; name: string; logoUrl: string | null }

/** Mecz na tablicy strony meczu (`MatchBoard` z `src/public`): wiersz meczu z kolejką i herbami. */
export type MatchPageMatch = Omit<MatchRowData, 'homeTeam' | 'awayTeam' | 'collisions'> & {
  homeTeam: MatchPageTeam | null
  awayTeam: MatchPageTeam | null
  round: { name: string }
}

/** Wynik meczu w danej chwili (`ScoreSnapshot`). */
export type ScoreSnapshot = { home: number; away: number }

/** Zdarzenie relacji (`PublicMatchEvent`): zdarzenie osi z częścią meczu i wynikiem po nim. */
export type MatchRelationEvent = MatchEventRow & {
  /** Numer części meczu; `null` bez minuty i w turnieju bez podziału. */
  period: number | null
  /** Wynik po zdarzeniu; `null`, gdy zdarzenie wyniku nie zmienia albo zdarzenia nie zgadzają się z wynikiem. */
  scoreAfter: ScoreSnapshot | null
}

/** Część meczu ze zdarzeniami (`PublicMatchPeriod`), np. „1. połowa”. */
export type MatchRelationPeriod = {
  number: number
  label: string
  /** `null`, gdy zdarzenia nie zgadzają się z wynikiem meczu. */
  homeScore: number | null
  awayScore: number | null
}

/** Strona meczu w całości: tablica i relacja (`MatchScreen`). */
export type MatchPageData = MatchPageMatch & {
  events: MatchRelationEvent[]
  periods: MatchRelationPeriod[]
}
