import { describe, expect, it } from 'vitest'
import { formatSets } from './sets'

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
