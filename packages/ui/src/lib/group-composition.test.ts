import { describe, expect, it } from 'vitest'
import {
  dealGroups,
  groupCompositionError,
  type GroupCompositionGroup,
  type GroupCompositionTeam,
} from './group-composition'

const teams: GroupCompositionTeam[] = [
  { id: 1, name: 'Alfa' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
  { id: 4, name: 'Delta' },
]

/** Dwie grupy po dwie drużyny — poprawny szkic. */
const valid: GroupCompositionGroup[] = [
  { name: 'Grupa A', qualifiers: 2, teamIds: [1, 2] },
  { name: 'Grupa B', qualifiers: 2, teamIds: [3, 4] },
]

describe('groupCompositionError', () => {
  it('przepuszcza poprawny skład', () => {
    expect(groupCompositionError(valid, teams)).toBeUndefined()
  })

  it('wymaga co najmniej jednej grupy', () => {
    expect(groupCompositionError([], teams)).toBe('Faza grupowa potrzebuje co najmniej jednej grupy.')
  })

  it('wymaga co najmniej dwóch drużyn w grupie', () => {
    const groups = [{ name: 'Grupa A', qualifiers: 1, teamIds: [1] }, valid[1]!]
    expect(groupCompositionError(groups, teams)).toBe('Grupa potrzebuje co najmniej dwóch drużyn.')
  })

  it.each([
    ['brakującą drużynę', [{ name: 'Grupa A', qualifiers: 1, teamIds: [1, 2] }]],
    [
      'powtórzoną drużynę',
      [
        { name: 'Grupa A', qualifiers: 1, teamIds: [1, 2] },
        { name: 'Grupa B', qualifiers: 1, teamIds: [2, 3] },
      ],
    ],
    [
      'drużynę spoza turnieju',
      [
        { name: 'Grupa A', qualifiers: 1, teamIds: [1, 99] },
        { name: 'Grupa B', qualifiers: 1, teamIds: [2, 3] },
      ],
    ],
  ])('wymaga każdej drużyny dokładnie raz: %s', (_case, groups) => {
    expect(groupCompositionError(groups, teams)).toBe('Skład musi zawierać każdą drużynę turnieju dokładnie raz.')
  })

  it('wymaga rozłącznych nazw grup', () => {
    const groups = [
      { name: 'Grupa A', qualifiers: 1, teamIds: [1, 2] },
      { name: 'Grupa A', qualifiers: 1, teamIds: [3, 4] },
    ]
    expect(groupCompositionError(groups, teams)).toBe('Nazwy grup w fazie nie mogą się powtarzać.')
  })

  it('nie pozwala wypuścić więcej drużyn, niż gra w grupie', () => {
    const groups = [
      { name: 'Grupa A', qualifiers: 3, teamIds: [1, 2] },
      { name: 'Grupa B', qualifiers: 1, teamIds: [3, 4] },
    ]
    expect(groupCompositionError(groups, teams)).toBe('Z grupy nie może wyjść więcej drużyn, niż w niej gra.')
  })

  it('wymaga co najmniej dwóch wychodzących z całej fazy', () => {
    const groups = [{ name: 'Jedyna', qualifiers: 1, teamIds: [1, 2, 3, 4] }]
    expect(groupCompositionError(groups, teams)).toBe('Z grup muszą wyjść co najmniej dwie drużyny.')
  })
})

describe('dealGroups', () => {
  it('rozkłada wszystkie drużyny po równo, zachowując nazwy i wychodzących', () => {
    const dealt = dealGroups(teams, valid, 2, () => 0)

    expect(dealt).toHaveLength(2)
    expect(dealt.map((group) => group.name)).toEqual(['Grupa A', 'Grupa B'])
    expect(dealt.map((group) => group.qualifiers)).toEqual([2, 2])
    expect(dealt.flatMap((group) => group.teamIds).sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
    expect(dealt.every((group) => group.teamIds.length === 2)).toBe(true)
  })

  it('nowym grupom nadaje kolejne nazwy i domyślnych wychodzących', () => {
    const dealt = dealGroups(teams, [], 4, () => 0)

    expect(dealt.map((group) => group.name)).toEqual(['Grupa A', 'Grupa B', 'Grupa C', 'Grupa D'])
    expect(dealt.map((group) => group.qualifiers)).toEqual([2, 2, 2, 2])
  })
})
