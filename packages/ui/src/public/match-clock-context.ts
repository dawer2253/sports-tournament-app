import { createContext, useContext } from 'react'
import { matchClock, type MatchClockSettings, type MatchClockState } from '../lib/match-clock'

/** Ustawienia zegara turnieju i „teraz” przeliczane co `MATCH_CLOCK_TICK_MS` (`MatchClockProvider`). */
export const MatchClockContext = createContext<{ settings: MatchClockSettings; now: Date } | null>(null)

/**
 * Napis zegara meczu przy „Na żywo” (`matchClock`): minuta, „Przerwa”, część
 * albo „Dogrywka”. `null` (samo „Na żywo”) poza `MatchClockProvider`, przy
 * meczu bez pól zegara i tam, gdzie zegar nic nie dopisuje.
 */
export function useMatchClock(state: Partial<MatchClockState> | null | undefined): string | null {
  const clock = useContext(MatchClockContext)
  if (!clock || !state || state.livePeriod == null) return null
  return matchClock(
    { livePeriod: state.livePeriod, periodStartedAt: state.periodStartedAt ?? null, onBreak: state.onBreak ?? false },
    clock.settings,
    clock.now,
  )
}
