/**
 * Wynik jednego seta w sporcie z setami (`SetScore` z kontraktu, #301):
 * punkty gospodarza i gościa. Wyniki setów meczu niesie `Match.sets`.
 */
export type SetScore = { home: number; away: number }

/**
 * Format seta turnieju (`SetFormat` z kontraktu): do ilu wygranych setów gra
 * się mecz, progi seta i seta decydującego oraz przewaga.
 */
export type SetFormat = { setsToWin: number; setPoints: number; decidingSetPoints: number; minLead: number }

/**
 * Wyniki setów w jednej linii, od pierwszego: „25:20, 23:25, 25:18, 25:22”.
 * W meczu trwającym ostatni set może być niedokończony; pokazujemy go tak
 * samo, bo to bieżący stan seta.
 */
export function formatSets(sets: readonly SetScore[]): string {
  return sets.map((set) => `${set.home}:${set.away}`).join(', ')
}

/** Najwięcej setów w meczu: ostatni możliwy to set decydujący (`2 × setsToWin − 1`). */
export function maxSets(format: SetFormat): number {
  return 2 * format.setsToWin - 1
}

/** Czy set o indeksie `index` (od 0) jest decydujący, czyli ostatnim możliwym. */
export function isDecidingSet(index: number, format: SetFormat): boolean {
  return index === maxSets(format) - 1
}

/** Próg seta: set decydujący gra się do `decidingSetPoints`, pozostałe do `setPoints`. */
export function setThreshold(index: number, format: SetFormat): number {
  return isDecidingSet(index, format) ? format.decidingSetPoints : format.setPoints
}

/**
 * Czy set jest zakończony według reguł z kontraktu (`MatchUpdate`): zwycięzca
 * ma próg, a przegrany co najwyżej próg minus przewaga, albo (przy przewadze
 * 2) zwycięzca przekroczył próg dokładnie o dwa punkty — gra na przewagi.
 * Te same reguły liczy serwer (`App\Matches\SetScores`).
 */
export function isSetComplete(set: SetScore, threshold: number, minLead: number): boolean {
  const winner = Math.max(set.home, set.away)
  const loser = Math.min(set.home, set.away)
  if (winner === loser) return false
  if (minLead === 1) return winner === threshold
  return (winner === threshold && loser <= threshold - 2) || (winner > threshold && winner - loser === 2)
}

/**
 * Sety wygrane `[gospodarz, gość]`, liczone z setów zakończonych: wynik meczu
 * w sporcie z setami. Niedokończony set meczu trwającego go nie zmienia.
 */
export function setsWon(sets: readonly SetScore[], format: SetFormat): [number, number] {
  let home = 0
  let away = 0
  sets.forEach((set, index) => {
    if (!isSetComplete(set, setThreshold(index, format), format.minLead)) return
    if (set.home > set.away) home++
    else away++
  })
  return [home, away]
}

/** Set w polach formularza: wartości jako napisy, pusty napis to zero przy zapisie. */
export type SetDraft = { home: string; away: string }

/** Sety z pól jako `SetScore` dla API i dla wyniku w setach: puste pole to 0. */
export function setDraftsToScores(drafts: readonly SetDraft[]): SetScore[] {
  return drafts.map((draft) => ({ home: Number(draft.home || 0), away: Number(draft.away || 0) }))
}

/** Zapisane sety jako pola formularza. */
export function setScoresToDrafts(sets: readonly SetScore[] | null | undefined): SetDraft[] {
  return (sets ?? []).map((set) => ({ home: String(set.home), away: String(set.away) }))
}

/**
 * Sety meczu do pokazania przy wyniku: tylko mecz rozpoczęty z co najmniej
 * jednym setem. Wspólne dla wierszy meczu panelu i strony oraz tablicy meczu.
 */
export function playedSets(match: { status: string; sets?: readonly SetScore[] | null }): readonly SetScore[] | null {
  return match.status !== 'scheduled' && match.sets && match.sets.length > 0 ? match.sets : null
}

/** Punkty w setach wiersza tabeli jako „zdobyte:stracone” (`StandingRow.rallyPoints*`). */
export function formatRallyPoints(row: { rallyPointsFor?: number | null; rallyPointsAgainst?: number | null }): string {
  return `${row.rallyPointsFor ?? 0}:${row.rallyPointsAgainst ?? 0}`
}

