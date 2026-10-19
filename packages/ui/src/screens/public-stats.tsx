import { useState } from 'react'
import { Shell } from '../public/shell'
import { LeaderboardTable } from '../components/data/leaderboard-table'
import { StatSwitcher } from '../components/data/stat-switcher'
import { Heading } from '../components/ui/typography'
import { leaderboardsBySport, publicTournament, sportSettings, statOptionsBySport } from '../lib/demo-data'

export interface PublicStatsProps {
  sport?: keyof typeof statOptionsBySport
  /** `przed-startem`: żaden mecz nie jest zakończony, klasyfikacja jest pusta. */
  state?: 'w-trakcie' | 'przed-startem'
}

/**
 * Statystyki strony publicznej (#207): przełącznik z `PublicTournament.stats`
 * i klasyfikacja wybranej statystyki na `LeaderboardTable`. W aplikacji wybór
 * siedzi w adresie (`?stat=`); tu w stanie ekranu, z `lib/demo-data`.
 */
export function PublicStats({ sport = 'football', state = 'w-trakcie' }: PublicStatsProps) {
  const stats = statOptionsBySport[sport]
  const [stat, setStat] = useState(stats[0]!.code)
  const leaderboard = leaderboardsBySport[sport][stat]!
  const shown = state === 'przed-startem' ? { ...leaderboard, rows: [] } : leaderboard
  const tournament = { ...publicTournament, sport: { code: sport, name: sportSettings[sport].name } }

  return (
    <Shell tournament={tournament} active="stats">
      <StatSwitcher stats={stats} value={stat} onValueChange={setStat}>
        <section className="space-y-3">
          <Heading level="section">{shown.label}</Heading>
          <LeaderboardTable leaderboard={shown} />
          {shown.rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Klasyfikacja obejmuje mecze zakończone ze wszystkich faz turnieju. Zawodnicy z równą wartością dzielą
              miejsce.
            </p>
          )}
        </section>
      </StatSwitcher>
    </Shell>
  )
}
