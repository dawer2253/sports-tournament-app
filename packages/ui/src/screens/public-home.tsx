import { PublicShell } from '../components/layout/public-shell'
import { PublicOverview } from '../components/data/public-overview'
import { groupByRound } from '../components/data/round-groups'
import {
  leaderboardsBySport,
  publicFixtures,
  publicResults,
  publicTournament,
  scheduleTimeZone,
  standingsTableRows,
} from '../lib/demo-data'

export interface PublicHomeProps {
  /**
   * `przed-startem`: brak meczów trwających i rozegranych, tabela z zerami,
   * a klasyfikacja bez wierszy.
   */
  state?: 'w-trakcie' | 'przed-startem'
}

/**
 * Przegląd strony publicznej (#206) na `PublicOverview` — tym samym, który
 * renderuje `apps/public`.
 */
export function PublicHome({ state = 'w-trakcie' }: PublicHomeProps) {
  const started = state === 'w-trakcie'
  const fixtures = started ? publicFixtures : publicFixtures.map((match) => ({ ...match, status: 'scheduled' as const, homeScore: null, awayScore: null }))
  const results = started ? publicResults : []
  const goals = leaderboardsBySport.football.goals!
  const rows = started
    ? standingsTableRows
    : standingsTableRows
        .map((row) => ({ ...row, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0 }))
        .toSorted((a, b) => a.team.name.localeCompare(b.team.name, 'pl'))
        .map((row, index) => ({ ...row, position: index + 1 }))

  return (
    <PublicShell tournament={publicTournament} active="home">
      <PublicOverview
        fixtures={groupByRound(fixtures, { timeZone: scheduleTimeZone })}
        results={groupByRound(results, { direction: 'desc', timeZone: scheduleTimeZone })}
        standings={rows}
        leaderboard={started ? goals : { ...goals, rows: [] }}
        timeZone={scheduleTimeZone}
      />
    </PublicShell>
  )
}
