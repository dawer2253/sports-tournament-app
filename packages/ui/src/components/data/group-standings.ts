import type { StandingsTableRow } from './standings-table-row'

/**
 * Tabela jednej grupy ze skrótu na Przeglądzie (#268): nazwa i liczba
 * wychodzących z grupy (`Group.qualifiers`) obok wierszy jej tabeli
 * (`StandingTable.rows`). Kontrakt niesie je osobno — grupę w fazach turnieju,
 * wiersze w `/standings` — więc łączy je aplikacja po `groupId`.
 *
 * Typ mieszka osobno z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type GroupStandings = {
  id: number
  name: string
  qualifiers: number
  /** Wiersze w kolejności z API, bez `qualifies` — linię liczy skrót. */
  rows: StandingsTableRow[]
}
