import type { StandingsTableRow } from '../components/data/standings-table-row'

/**
 * Linia wyjścia z grupy (**Qualifiers** w `CONTEXT.md`, #250, #259) dla
 * `StandingsTable`: wychodzi `qualifiers` czołowych miejsc tabeli, czyli
 * `qualifies` mają wiersze o `position` ≤ `qualifiers`.
 *
 * **Remis na linii** to równa liczba punktów ostatniego wychodzącego
 * (miejsce `qualifiers`) i pierwszego niewychodzącego (miejsce o jeden
 * niżej) — tylko te dwa wiersze dostają `tied`, jak w #259 i w prototypie
 * #251.
 */
export function withQualifiers<Row extends StandingsTableRow>(rows: readonly Row[], qualifiers: number): Row[] {
  const last = rows.find((row) => row.position === qualifiers)
  const next = rows.find((row) => row.position === qualifiers + 1)
  const tied = last !== undefined && next !== undefined && last.points === next.points

  return rows.map((row) => ({
    ...row,
    qualifies: row.position <= qualifiers,
    tied: tied && (row === last || row === next),
  }))
}


/**
 * Drużyny stojące w drabince: z wszystkich meczów fazy pucharowej. To zbiór
 * rozstawionych — generator obsadza 1. rundę i sloty po wolnych losach od
 * razu, a późniejsze rundy dostają już tylko drużyny z wcześniejszych.
 */
export function bracketTeamIds(
  matches: readonly { homeTeam: { id: number } | null; awayTeam: { id: number } | null }[],
): Set<number> {
  return new Set(matches.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]).filter((id) => id !== undefined))
}

/**
 * Rozjazd drabinki z dzisiejszą tabelą jednej grupy (#250, #260, #268): kto
 * z grupy gra w drabince poza czołówką `qualifiers` (`plays`) i kogo
 * z czołówki w drabince nie ma (`missing`), oba w kolejności tabeli. Drabinka
 * nie pamięta, z którego miejsca przyszła drużyna, a wynik grupy wpisany po
 * jej wygenerowaniu jej nie rusza („Qualifiers” w `CONTEXT.md`), więc rozjazd
 * liczy się przy odczycie. Daje go wynik wpisany później, świadoma podmiana
 * przy remisie na linii i zmiana liczby wychodzących. Bez rozjazdu obie listy
 * są puste.
 */
export function qualifiersDivergence<Row extends { position: number; team: { id: number } }>(
  rows: readonly Row[],
  qualifiers: number,
  bracketTeams: ReadonlySet<number>,
): { plays: Row[]; missing: Row[] } {
  return {
    plays: rows.filter((row) => row.position > qualifiers && bracketTeams.has(row.team.id)),
    missing: rows.filter((row) => row.position <= qualifiers && !bracketTeams.has(row.team.id)),
  }
}
