/**
 * Wynik jednego seta w sporcie z setami (`SetScore` z kontraktu, #301):
 * punkty gospodarza i gościa. Wyniki setów meczu niesie `Match.sets`.
 */
export type SetScore = { home: number; away: number }

/**
 * Wyniki setów w jednej linii, od pierwszego: „25:20, 23:25, 25:18, 25:22”.
 * W meczu trwającym ostatni set może być niedokończony; pokazujemy go tak
 * samo, bo to bieżący stan seta.
 */
export function formatSets(sets: readonly SetScore[]): string {
  return sets.map((set) => `${set.home}:${set.away}`).join(', ')
}
