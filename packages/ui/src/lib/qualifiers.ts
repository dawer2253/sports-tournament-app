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
