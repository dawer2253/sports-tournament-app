import { describe, expect, it } from 'vitest'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import { withQualifiers } from './qualifiers'

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
