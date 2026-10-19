import { describe, expect, it } from 'vitest'
import { formatRoundDates } from './kickoff'

describe('formatRoundDates', () => {
  it('mecze bez daty obok datowanych dopisują swoją liczbę po przecinku, bez kropki między faktami', () => {
    expect(formatRoundDates(['2026-09-05T08:00:00+00:00', null, null], 'Europe/Warsaw')).toBe('sob., 5 wrz, 2 bez terminu')
  })
})
