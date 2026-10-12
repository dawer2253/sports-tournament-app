import { PublicShell } from '../components/layout/public-shell'
import { groupByRound } from '../components/data/round-groups'
import { RoundMatches } from '../components/data/round-matches'
import { publicFixtures, publicTournament, scheduleTimeZone } from '../lib/demo-data'

/**
 * Terminarz strony publicznej (#206): mecze zaplanowane i trwające
 * (`/fixtures`) po kolejce, rosnąco, na `RoundList` i `MatchRow` z panelu.
 * Bez kolizji, a oznaczony jest tylko mecz na żywo.
 */
export function PublicFixtures() {
  return (
    <PublicShell tournament={publicTournament} active="fixtures">
      <RoundMatches
        rounds={groupByRound(publicFixtures, { timeZone: scheduleTimeZone })}
        timeZone={scheduleTimeZone}
        progress={false}
        statusDisplay="live"
      />
    </PublicShell>
  )
}
