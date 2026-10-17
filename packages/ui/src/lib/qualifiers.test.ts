import { describe, expect, it } from 'vitest'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import { qualifiersDivergence, withQualifiers } from './qualifiers'

/** Wiersz z samymi polami, które liczą się dla linii wyjścia. */
function row(position: number, points: number, played = 2): StandingsTableRow {
  return {
    position,
    team: { id: position, name: `Drużyna ${position}`, logoUrl: null },
    played,
    won: 0,
    drawn: 0,
    lost: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreDifference: 0,
    points,
  }
}

const flags = (rows: StandingsTableRow[]) => rows.map(({ qualifies, tied }) => [qualifies, tied])

describe('withQualifiers', () => {
  it('oznacza wychodzących miejscami ≤ qualifiers, bez remisu przy różnych punktach', () => {
    const rows = withQualifiers([row(1, 6), row(2, 4), row(3, 3), row(4, 0)], 2)

    expect(flags(rows)).toEqual([
      [true, false],
      [true, false],
      [false, false],
      [false, false],
    ])
  })

  it('przy równych punktach na linii oznacza remisem dwa wiersze przy linii', () => {
    const rows = withQualifiers([row(1, 6), row(2, 4), row(3, 4), row(4, 4), row(5, 1)], 2)

    expect(flags(rows)).toEqual([
      [true, false],
      [true, true],
      [false, true],
      [false, false],
      [false, false],
    ])
  })

  it('widzi remis na linii także przed pierwszym meczem, bo dorobek jest równy', () => {
    const rows = withQualifiers([row(1, 0, 0), row(2, 0, 0), row(3, 0, 0)], 1)

    expect(flags(rows)).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ])
  })

  it('bez linii, gdy wychodzą wszyscy: remisu na linii nie ma', () => {
    const rows = withQualifiers([row(1, 3), row(2, 3)], 2)

    expect(flags(rows)).toEqual([
      [true, false],
      [true, false],
    ])
  })

  it('nie zmienia wierszy wejściowych', () => {
    const input = [row(1, 3), row(2, 3)]
    withQualifiers(input, 1)

    expect(input[0]).not.toHaveProperty('qualifies')
  })
})

/** Wiersze grupy w kolejności miejsc: id drużyny to jej dzisiejsze miejsce. */
const GROUP = [row(1, 9), row(2, 6), row(3, 3), row(4, 0)]
const ids = (rows: StandingsTableRow[]) => rows.map((candidate) => candidate.team.id)

describe('qualifiersDivergence', () => {
  it('drabinka z czołówki tabeli nie ma rozjazdu', () => {
    const { plays, missing } = qualifiersDivergence(GROUP, 2, new Set([1, 2, 99]))

    expect([ids(plays), ids(missing)]).toEqual([[], []])
  })

  it('drużyna z drabinki pod linią i drużyna nad linią spoza drabinki, w kolejności tabeli', () => {
    const { plays, missing } = qualifiersDivergence(GROUP, 2, new Set([1, 3]))

    expect([ids(plays), ids(missing)]).toEqual([[3], [2]])
  })

  it('liczba wychodzących zmieniona po wygenerowaniu daje człon bez pary', () => {
    expect(ids(qualifiersDivergence(GROUP, 3, new Set([1, 2])).missing)).toEqual([3])
    expect(ids(qualifiersDivergence(GROUP, 1, new Set([1, 2])).plays)).toEqual([2])
  })
})
