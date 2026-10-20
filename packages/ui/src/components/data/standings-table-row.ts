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
  /**
   * Punkty w setach zdobyte i stracone (`StandingRow.rallyPointsFor`, #301);
   * `null` w sporcie bez setów. Opcjonalne, wzorem zegara meczu w
   * `MatchRowData`: dane demo piłki ich nie niosą, a zmianę nazwy pola łapie
   * osobny strażnik w aplikacji.
   */
  rallyPointsFor?: number | null
  rallyPointsAgainst?: number | null
  /** Punkty za wyniki meczów, nigdy zdobycze. */
  points: number
  /**
   * Tylko w tabeli grupy: drużyna jest nad linią wyjścia. Kontrakt tego pola
   * nie zna — dokłada je `withQualifiers` z `Group.qualifiers`.
   */
  qualifies?: boolean
  /** Tylko w tabeli grupy: remis na linii wyjścia (`withQualifiers`). */
  tied?: boolean
}
