import { Shell } from '../public/shell'
import { groupByRound } from '../components/data/round-groups'
import { RoundSections } from '../components/data/round-sections'
import { publicResults, publicTournament, scheduleTimeZone } from '../lib/demo-data'

/**
 * Wyniki strony publicznej (#206): mecze zakończone (`/results`) po
 * kolejce, od najnowszej, jedną listą z nagłówkami kolejek (`RoundSections`, #226).
 */
export function PublicResults() {
  return (
    <Shell tournament={publicTournament} active="results">
      <RoundSections
        rounds={groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone })}
        timeZone={scheduleTimeZone}
        statusDisplay="live"
      />
    </Shell>
  )
}
