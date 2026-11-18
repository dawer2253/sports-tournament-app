import { describe, expect, it } from 'vitest'
import { leaderboardCut, standingsCut } from './rows'

const leader = (position: number, player = `Zawodnik ${position}`) => ({
  position,
  player,
  team: { name: 'Wilki Bemowo', logoUrl: null },
  value: 10 - position,
})

describe('leaderboardCut', () => {
  it('bierze pierwszą piątkę, a resztę liczy do dopisku', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((position) => leader(position))
    const cut = leaderboardCut(rows)
    expect(cut.rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5])
    expect(cut.hidden).toBe(2)
  })

  it('przy remisie na 5. miejscu wpuszcza wszystkich ex aequo', () => {
    const rows = [1, 2, 3, 4, 5, 5, 5, 8].map((position) => leader(position))
    const cut = leaderboardCut(rows)
    expect(cut.rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 5, 5])
    expect(cut.hidden).toBe(1)
  })

  it('trzyma twardą granicę 8 wierszy, nawet gdy rozcina grupę ex aequo', () => {
    const rows = [1, 2, 3, 3, 3, 3, 3, 3, 3, 3].map((position, index) => leader(position, `Z${index}`))
    const cut = leaderboardCut(rows)
    expect(cut.rows).toHaveLength(8)
    expect(cut.hidden).toBe(2)
  })

  it('krótka lista zostaje cała', () => {
    const cut = leaderboardCut([leader(1), leader(2)])
    expect(cut.rows).toHaveLength(2)
    expect(cut.hidden).toBe(0)
  })
})

describe('standingsCut', () => {
  it('trzyma najwyżej 10 drużyn w obu formatach, resztę liczy do dopisku', () => {
    const rows = Array.from({ length: 16 }, (_, index) => ({ position: index + 1 }))
    const cut = standingsCut(rows)
    expect(cut.rows).toHaveLength(10)
    expect(cut.hidden).toBe(6)
  })
})
