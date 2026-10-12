import { PublicShell } from '../components/layout/public-shell'
import { groupByRound } from '../components/data/round-groups'
import { RoundMatches } from '../components/data/round-matches'
import { publicResults, publicTournament, scheduleTimeZone } from '../lib/demo-data'

/**
 * Wyniki strony publicznej (#206): mecze zakończone (`/results`) po
 * kolejce, od najnowszej, na `RoundList` i `MatchRow` z panelu.
 */
export function PublicResults() {
  return (
    <PublicShell tournament={publicTournament} active="results">
      <RoundMatches
        rounds={groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone })}
        timeZone={scheduleTimeZone}
        progress={false}
        statusDisplay="live"
      />
    </PublicShell>
  )
}
