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
  /**
   * Kolizje terminu tego meczu (`AdminMatch.collisions` z kontraktu), liczone
   * przy odczycie (#158). Brak pola i pusta lista znaczą to samo: brak kolizji.
   */
  collisions?: MatchCollision[]
}

/** Rodzaj kolizji terminu: wspólna drużyna (`team`) albo ten sam obiekt (`venue`). */
export type MatchCollisionType = 'team' | 'venue'

/**
 * Kolizja z innym meczem tego samego turnieju (`MatchCollision` z kontraktu).
 * `title` jest dodatkiem panelu: kontrakt zna tylko `matchId`, a wiersz nie ma
 * jak sam dotrzeć do drugiego meczu, więc opis drugiej strony dokłada ekran.
 */
export type MatchCollision = {
  type: MatchCollisionType
  /** Mecz po drugiej stronie kolizji; kolizja jest symetryczna. */
  matchId: number
  /** Opis drugiej strony kolizji do `title`, np. „Kolizja boiska: Lwy – Żubry”. */
  title?: string
}

