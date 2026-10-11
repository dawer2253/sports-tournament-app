/**
 * Wiersz tabeli ligi w panelu. Ten sam kształt co `StandingRow` z kontraktu,
 * przepisany ręcznie, bo pakiet UI nie zna klienta API — zgodność pilnuje
 * `apps/admin/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type StandingsTableRow = {
  /** Unikalne `1..n`: ostatnim kryterium jest nazwa drużyny. */
  position: number
  team: { id: number; name: string; logoUrl: string | null }
  played: number
  won: number
  drawn: number
  lost: number
  scoreFor: number
  scoreAgainst: number
  scoreDifference: number
  /** Punkty za wyniki meczów, nigdy zdobycze. */
  points: number
}
