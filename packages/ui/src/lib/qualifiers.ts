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

/** Drużyna w regule rozjazdu: tyle, ile potrzeba do porównania i do zdania. */
export type DivergenceTeam = { id: number; name: string }

/**
 * Tabela grupy z jej liczbą wychodzących (`Group.qualifiers`, po
 * `StandingTable.groupId`). Wiersze w kolejności miejsc z API.
 */
export type GroupLine = {
  groupId: number
  qualifiers: number
  rows: readonly { position: number; team: DivergenceTeam }[]
}

/**
 * Rozjazd drabinki z dzisiejszą tabelą jednej grupy (#250, #268): kto gra
 * w drabince, choć stoi dziś pod linią, i kto stoi nad linią, choć w drabince
 * nie gra.
 */
export type BracketDivergence = {
  groupId: number
  inBracket: DivergenceTeam[]
  aboveLine: DivergenceTeam[]
}

/**
 * Rozjazd drabinki z tabelami grup (#268, notka z #252). Drabinka nie pamięta,
 * z którego miejsca przyszła drużyna, a wynik grupy wpisany po jej
 * wygenerowaniu jej nie rusza („Qualifiers” w `CONTEXT.md`), więc strona
 * porównuje sama: drużyny drabinki z danej grupy z drużynami nad linią tej
 * grupy. Rozjazd daje też świadoma podmiana przy remisie na linii — tak
 * ustala #252.
 *
 * Drużyny drabinki to wszystkie drużyny z jej meczów. To zbiór rozstawionych:
 * generator obsadza 1. rundę i sloty po wolnych losach od razu, a późniejsze
 * rundy dostają już tylko drużyny z wcześniejszych. Bez meczów drabinki
 * rozjazdu nie ma. Grupa bez rozjazdu nie trafia do wyniku.
 */
export function bracketDivergence(
  groups: readonly GroupLine[],
  matches: readonly { homeTeam: { id: number } | null; awayTeam: { id: number } | null }[],
): BracketDivergence[] {
  const entrants = new Set(matches.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]))
  if (entrants.size === 0) return []

  return groups.flatMap(({ groupId, qualifiers, rows }) => {
    const inBracket = rows.filter((row) => row.position > qualifiers && entrants.has(row.team.id)).map((row) => row.team)
    const aboveLine = rows.filter((row) => row.position <= qualifiers && !entrants.has(row.team.id)).map((row) => row.team)
    return inBracket.length || aboveLine.length ? [{ groupId, inBracket, aboveLine }] : []
  })
}
