/**
 * Przycinanie list grafiki (#323, #325). Ile wierszy naprawdę mieści kadr,
 * dopasowuje jeszcze szablon (`useFit`); tu stoją twarde granice z ustaleń,
 * niezależne od miejsca. Reszta idzie w dopisek „i N kolejnych”.
 */

/** Tabela: najwyżej 10 drużyn w obu formatach, bo 9:16 trzyma strefę bezpieczną Stories (#325). */
export const STANDINGS_LIMIT = 10

/** Klasyfikacja: czołówka do 5. miejsca, z ex aequo na granicy, ale najwyżej 8 wierszy (#323 pkt 2, #325). */
export const LEADERBOARD_TOP = 5
export const LEADERBOARD_LIMIT = 8

export interface Cut<T> {
  rows: T[]
  /** Ile wierszy idzie w dopisek. */
  hidden: number
}

export function standingsCut<T>(rows: readonly T[]): Cut<T> {
  const shown = rows.slice(0, STANDINGS_LIMIT)
  return { rows: shown, hidden: rows.length - shown.length }
}

/**
 * Pozycja w klasyfikacji jest dzielona (`StatLeaderboardRow.position`), więc
 * „do 5. miejsca” obejmuje od razu wszystkich ex aequo na granicy. Granica
 * 8 wierszy jest twarda i może rozciąć grupę ex aequo (#325).
 */
export function leaderboardCut<T extends { position: number }>(rows: readonly T[]): Cut<T> {
  const shown = rows.filter((row) => row.position <= LEADERBOARD_TOP).slice(0, LEADERBOARD_LIMIT)
  return { rows: shown, hidden: rows.length - shown.length }
}
