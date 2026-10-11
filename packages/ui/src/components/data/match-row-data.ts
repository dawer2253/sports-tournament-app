/**
 * Mecz w wierszu terminarza. Podzbiór `Match` z kontraktu, przepisany ręcznie,
 * bo pakiet UI nie zna klienta API — zgodność pilnuje
 * `apps/admin/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type MatchRowData = {
  id: number
  /** `null`, gdy miejsce w drabince nie jest jeszcze rozstrzygnięte. */
  homeTeam: { id: number; name: string } | null
  awayTeam: { id: number; name: string } | null
  homeScore: number | null
  awayScore: number | null
  status: 'scheduled' | 'live' | 'finished'
  /** ISO 8601 z offsetem; `null` to „Termin do ustalenia”. */
  kickoffAt: string | null
  venue: { id: number; name: string } | null
}
