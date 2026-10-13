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
  status: MatchStatus
  /** ISO 8601 z offsetem; `null` to „Termin do ustalenia”. */
  kickoffAt: string | null
  venue: { id: number; name: string } | null
  /**
   * Kolizje terminu tego meczu (`AdminMatch.collisions` z kontraktu), liczone
   * przy odczycie (#158). Brak pola i pusta lista znaczą to samo: brak kolizji.
   */
  collisions?: MatchCollision[]
  /**
   * Strzelcy meczu (`PublicMatch.scorers` z kontraktu, #208), w kolejności
   * z API. Ma je tylko strona publiczna; brak pola i pusta lista znaczą to
   * samo: pod wynikiem nic nie stoi.
   */
  scorers?: MatchScorer[]
}

/**
 * Jeden zawodnik w jednym meczu (`PublicMatchScorer` z kontraktu). `team` to
 * drużyna strzelca, także przy samobóju; stronę wiersza wyznacza `ownGoal`.
 */
export type MatchScorer = {
  team: { id: number; name: string }
  player: { id: number; name: string }
  /** Suma wartości zdarzeń zawodnika w meczu, także tych bez minuty. */
  value: number
  /** Minuty zdarzeń rosnąco; zdarzenia bez minuty tu nie ma. */
  minutes: number[]
  ownGoal: boolean
}

/** Stany meczu z kontraktu (`MatchStatus`). */
export type MatchStatus = 'scheduled' | 'live' | 'finished'

/**
 * Nazwy stanów meczu. Jedno źródło dla plakietki w wierszu terminarza
 * (`MatchRow`) i przełącznika w oknie meczu (`MatchStatusToggle`), żeby oba
 * mówiły o stanie tak samo (#159).
 */
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Zaplanowany',
  live: 'Trwa',
  finished: 'Zakończony',
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

