import type { StandingsTableRow } from '../components/data/standings-table-row'

/**
 * Linia wyjścia z grupy (**Qualifiers** w `CONTEXT.md`, #250, #259) dla
 * `StandingsTable`: wychodzi `qualifiers` czołowych miejsc tabeli, czyli
 * `qualifies` mają wiersze o `position` ≤ `qualifiers`.
 *
 * **Remis na linii** to równa liczba punktów ostatniego wychodzącego
 * i pierwszego niewychodzącego — tylko te dwa wiersze dostają `tied`, jak
 * w prototypie #251. Przed pierwszym meczem żadnej z tych dwóch drużyn
 * wszyscy mają po zero, a to jeszcze nie remis.
 *
 * Wiersze muszą stać w kolejności miejsc, jak w odpowiedzi API.
 */
export function withQualifiers<Row extends StandingsTableRow>(rows: readonly Row[], qualifiers: number): Row[] {
  const last = rows[qualifiers - 1]
  const next = rows[qualifiers]
  const tied = last !== undefined && next !== undefined && last.points === next.points && (last.played > 0 || next.played > 0)

  return rows.map((row, index) => ({
    ...row,
    qualifies: row.position <= qualifiers,
    tied: tied && (index === qualifiers - 1 || index === qualifiers),
  }))
}
