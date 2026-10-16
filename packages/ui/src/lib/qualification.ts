import type { StandingsTableRow } from '../components/data/standings-table-row'

/**
 * Linia wyjścia z grupy (#250, #259) dla `StandingsTable`: wychodzi
 * `qualifiers` czołowych miejsc tabeli, czyli `qualifies` mają wiersze
 * o `position` ≤ `qualifiers`.
 *
 * **Remis na linii** to równa liczba punktów ostatniego wychodzącego
 * i pierwszego niewychodzącego. Plakietkę dostaje wtedy cały blok drużyn z tą
 * liczbą punktów, bo o tym, która z nich wyjdzie, rozstrzygają kryteria albo
 * organizer przy generowaniu drabinki. Przed pierwszym meczem żadnej z dwóch
 * drużyn na linii wszyscy mają po zero — to jeszcze nie remis.
 *
 * Wiersze muszą stać w kolejności miejsc, jak w odpowiedzi API.
 */
export function withQualification<Row extends StandingsTableRow>(rows: readonly Row[], qualifiers: number): Row[] {
  const last = rows[qualifiers - 1]
  const next = rows[qualifiers]
  const tiedPoints =
    last && next && last.points === next.points && (last.played > 0 || next.played > 0) ? last.points : undefined

  return rows.map((row) => ({
    ...row,
    qualifies: row.position <= qualifiers,
    tied: row.points === tiedPoints,
  }))
}
