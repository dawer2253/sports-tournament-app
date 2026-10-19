import { Shell } from '../public/shell'
import { groupByRound } from '../components/data/round-groups'
import { RoundSections } from '../components/data/round-sections'
import { publicFixtures, publicTournament, scheduleTimeZone } from '../lib/demo-data'

/**
 * Terminarz strony publicznej (#206): mecze zaplanowane i trwające
 * (`/fixtures`) po kolejce, rosnąco, jedną listą z nagłówkami kolejek (`RoundSections`, #226).
 * Bez kolizji, a oznaczony jest tylko mecz na żywo.
 */
export function PublicFixtures() {
  return (
    <Shell tournament={publicTournament} active="fixtures">
      <RoundSections
        rounds={groupByRound(publicFixtures, { timeZone: scheduleTimeZone })}
        timeZone={scheduleTimeZone}
        statusDisplay="live"
      />
    </Shell>
  )
}
