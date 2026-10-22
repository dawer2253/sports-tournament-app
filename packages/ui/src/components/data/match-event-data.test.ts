import { describe, expect, it } from 'vitest'
import { eventMinuteText, formatEventMinute, parseEventMinute } from './match-event-data'

describe('minuta zdarzenia', () => {
  it('formatuje minutę, doliczony czas i brak minuty', () => {
    expect(formatEventMinute({ minute: 67, addedTime: null })).toBe('67′')
    expect(formatEventMinute({ minute: 45, addedTime: 3 })).toBe('45+3′')
    expect(formatEventMinute(null)).toBe('—')
  })

  it('czyta „67” i „45+3”, puste pole to brak minuty', () => {
    expect(parseEventMinute('67')).toEqual({ minute: 67, addedTime: null })
    expect(parseEventMinute('45+3')).toEqual({ minute: 45, addedTime: 3 })
    expect(parseEventMinute(' 90 + 4 ')).toEqual({ minute: 90, addedTime: 4 })
    expect(parseEventMinute('')).toEqual({ minute: null, addedTime: null })
  })

  it('odrzuca wpis, który nie jest minutą', () => {
    for (const text of ['0', '151', '45+0', '45+31', 'abc', '4.5', '45+', '+3', '-2']) {
      expect(parseEventMinute(text)).toBeNull()
    }
  })

  it('składa tekst pola z minuty i doliczonego czasu', () => {
    expect(eventMinuteText({ minute: 67, addedTime: null })).toBe('67')
    expect(eventMinuteText({ minute: 45, addedTime: 3 })).toBe('45+3')
    expect(eventMinuteText(null)).toBe('')
  })
})
