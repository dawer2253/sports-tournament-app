/**
 * Klasyfikacja zawodników (`StatLeaderboard` z kontraktu) i jej wiersz,
 * przepisane ręcznie, bo pakiet UI nie zna klienta API — zgodność pilnuje
 * `apps/public/src/lib/contract-guard.ts`.
 *
 * Typy mieszkają osobno z tego samego powodu co `StandingsTableRow`: żeby
 * `lib/demo-data.ts` mogło ich użyć bez importowania komponentów.
 */
export type LeaderboardRow = {
  /** Dzielona przy remisie: 1, 2, 3, 3, 3, a kolejna wartość zaczyna od 6. */
  position: number
  player: { id: number; name: string }
  /** Drużyna zdarzeń zawodnika. */
  team: { id: number; name: string; logoUrl: string | null }
  value: number
}

export type Leaderboard = {
  stat: string
  /** Etykieta statystyki z odpowiedzi, np. „Bramki” albo „Punkty” (ADR-0006). */
  label: string
  /** Malejąco po wartości, ex aequo po `player.id` — kolejności widok nie poprawia. */
  rows: LeaderboardRow[]
}

/** Pusty stan klasyfikacji: przed pierwszym meczem zakończonym nie ma wierszy. */
export const LEADERBOARD_EMPTY = 'Klasyfikacja ruszy po pierwszym zakończonym meczu'

/**
 * Pusty stan, gdy mecze zakończone już są, ale bez zdarzeń, które liczą się
 * w tej klasyfikacji (#306): wynik wpisany bez strzelców albo statystyka,
 * której nikt jeszcze nie ma (kartki).
 */
export const LEADERBOARD_NO_EVENTS = 'Ta klasyfikacja jest jeszcze pusta'

/**
 * Pusta klasyfikacja: tytuł i zdanie wyjaśnienia zależnie od tego, czy jest
 * już mecz zakończony (`/results` niepuste). Jedno miejsce dla Statystyk
 * i lidera na Przeglądzie (#306).
 */
export function leaderboardEmptyState(hasFinishedMatches: boolean): { title: string; detail: string } {
  return hasFinishedMatches
    ? { title: LEADERBOARD_NO_EVENTS, detail: 'Mecze zakończone już są, ale nie wpisano do nich zdarzeń, które liczą się w tej klasyfikacji.' }
    : { title: LEADERBOARD_EMPTY, detail: 'Liczą się zdarzenia z meczów zakończonych, ze wszystkich faz turnieju.' }
}

/** Statystyka do wyboru (`PublicTournament.stats`). */
export type StatOption = { code: string; label: string }

/** Ile wierszy ma karta klasyfikacji na Przeglądzie, gdy liderów jest mniej. */
export const LEADERBOARD_LEADERS_ROWS = 5

/**
 * Wiersze karty na Przeglądzie: wszyscy z `position: 1` zawsze, a kolejne
 * pozycje dopełniają kartę do `LEADERBOARD_LEADERS_ROWS`. Przy więcej niż
 * pięciu liderach karta ma ich wszystkich i nic więcej.
 */
export function leaderboardLeaders(rows: LeaderboardRow[]): LeaderboardRow[] {
  const leaders = rows.filter((row) => row.position === 1).length
  return rows.slice(0, Math.max(LEADERBOARD_LEADERS_ROWS, leaders))
}
