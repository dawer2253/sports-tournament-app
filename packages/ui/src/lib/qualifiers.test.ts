import { describe, expect, it } from 'vitest'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import { bracketDivergence, withQualifiers } from './qualifiers'

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

/** Tabela grupy: drużyny w kolejności miejsc, id i nazwy z listy. */
function group(groupId: number, qualifiers: number, names: string[]) {
  return {
    groupId,
    qualifiers,
    rows: names.map((name, index) => ({ position: index + 1, team: { id: groupId * 10 + index + 1, name } })),
  }
}

/** Mecz drabinki z parą drużyn z tabel (`null` to pusty slot). */
function pair(home: { id: number; name: string } | null, away: { id: number; name: string } | null) {
  return { homeTeam: home, awayTeam: away }
}

const A = group(1, 2, ['Sokoły', 'Wilki', 'Orły', 'Rysie'])
const B = group(2, 2, ['Żubry', 'Lwy', 'Niedźwiedzie', 'Jastrzębie'])
const team = (table: ReturnType<typeof group>, position: number) => table.rows[position - 1]!.team

describe('bracketDivergence', () => {
  it('drabinka z czołówki obu tabel nie ma rozjazdu', () => {
    const matches = [pair(team(A, 1), team(B, 2)), pair(team(B, 1), team(A, 2)), pair(team(A, 1), null)]

    expect(bracketDivergence([A, B], matches)).toEqual([])
  })

  it('drużyna z drabinki pod linią swojej grupy daje rozjazd z drużyną, która stoi dziś nad linią', () => {
    const matches = [pair(team(A, 1), team(B, 2)), pair(team(B, 1), team(A, 3))]

    expect(bracketDivergence([A, B], matches)).toEqual([
      { groupId: 1, inBracket: [team(A, 3)], aboveLine: [team(A, 2)] },
    ])
  })

  it('bez meczów drabinki rozjazdu nie ma, choć nikt w niej nie gra', () => {
    expect(bracketDivergence([A, B], [])).toEqual([])
  })

  it('drużyna z wolnym losem, która stoi od razu w 2. rundzie, gra w drabince', () => {
    const C = group(3, 3, ['Kruki', 'Dziki', 'Lisy'])
    // Kruki mają wolny los: ich pierwszy mecz to półfinał, a nie 1. runda.
    const matches = [pair(team(C, 2), team(C, 3)), pair(team(C, 1), null)]

    expect(bracketDivergence([C], matches)).toEqual([])
  })

  it('liczba wychodzących podniesiona po wygenerowaniu daje drużynę nad linią bez miejsca w drabince', () => {
    const raised = { ...A, qualifiers: 3 }
    const matches = [pair(team(A, 1), team(B, 2)), pair(team(B, 1), team(A, 2))]

    expect(bracketDivergence([raised, B], matches)).toEqual([{ groupId: 1, inBracket: [], aboveLine: [team(A, 3)] }])
  })
})
