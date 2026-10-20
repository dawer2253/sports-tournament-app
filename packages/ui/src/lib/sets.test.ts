import { describe, expect, it } from 'vitest'
import { formatRallyPoints, formatSets, isSetComplete, maxSets, playedSets, setThreshold, setsWon, type SetFormat } from './sets'

/** Format domyślny siatkówki: mecz do 3 setów, set do 25, decydujący do 15, przewaga 2. */
const VOLLEYBALL: SetFormat = { setsToWin: 3, setPoints: 25, decidingSetPoints: 15, minLead: 2 }

describe('formatSets', () => {
  it('składa sety w jedną linię od pierwszego', () => {
    expect(
      formatSets([
        { home: 25, away: 20 },
        { home: 23, away: 25 },
        { home: 25, away: 18 },
        { home: 25, away: 22 },
      ]),
    ).toBe('25:20, 23:25, 25:18, 25:22')
  })

  it('pokazuje niedokończony set meczu trwającego tak samo jak zakończony', () => {
    expect(formatSets([{ home: 25, away: 21 }, { home: 14, away: 12 }])).toBe('25:21, 14:12')
  })

  it('bez setów daje pusty napis', () => {
    expect(formatSets([])).toBe('')
  })
})

describe('reguły seta (te same co na serwerze, #301)', () => {
  it('set decydujący to ostatni możliwy: 5. przy meczu do 3, 3. przy meczu do 2', () => {
    expect(maxSets(VOLLEYBALL)).toBe(5)
    expect(setThreshold(3, VOLLEYBALL)).toBe(25)
    expect(setThreshold(4, VOLLEYBALL)).toBe(15)
    expect(setThreshold(2, { ...VOLLEYBALL, setsToWin: 2 })).toBe(15)
  })

  it.each([
    [25, 23, 2, true],
    [27, 25, 2, true],
    [25, 24, 2, false],
    [28, 25, 2, false],
    [24, 24, 2, false],
    [25, 24, 1, true],
    [26, 24, 1, false],
  ])('%i:%i przy przewadze %i jest zakończony: %s', (home, away, minLead, complete) => {
    expect(isSetComplete({ home, away }, 25, minLead)).toBe(complete)
  })

  it('liczy sety wygrane bez niedokończonego ostatniego seta', () => {
    expect(
      setsWon(
        [
          { home: 25, away: 21 },
          { home: 18, away: 25 },
          { home: 14, away: 12 },
        ],
        VOLLEYBALL,
      ),
    ).toEqual([1, 1])
    expect(
      setsWon(
        [
          { home: 25, away: 23 },
          { home: 23, away: 25 },
          { home: 25, away: 21 },
          { home: 20, away: 25 },
          { home: 15, away: 11 },
        ],
        VOLLEYBALL,
      ),
    ).toEqual([3, 2])
  })
})

describe('playedSets i formatRallyPoints', () => {
  it('sety pokazuje tylko mecz rozpoczęty z co najmniej jednym setem', () => {
    const sets = [{ home: 25, away: 20 }]
    expect(playedSets({ status: 'finished', sets })).toBe(sets)
    expect(playedSets({ status: 'live', sets: [] })).toBeNull()
    expect(playedSets({ status: 'scheduled', sets })).toBeNull()
    expect(playedSets({ status: 'finished', sets: null })).toBeNull()
  })

  it('punkty w setach jako zdobyte:stracone, a brak wartości jako zero', () => {
    expect(formatRallyPoints({ rallyPointsFor: 183, rallyPointsAgainst: 162 })).toBe('183:162')
    expect(formatRallyPoints({})).toBe('0:0')
  })
})
