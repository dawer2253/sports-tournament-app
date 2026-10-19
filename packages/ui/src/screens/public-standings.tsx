import { Shell } from '../public/shell'
import { StandingsTable } from '../components/data/standings-table'
import { TiebreakerSentence } from '../components/data/tiebreaker-editor'
import { Heading } from '../components/ui/typography'
import { basketballStandingsTableRows, publicTournament, sportSettings, standingsTableRows } from '../lib/demo-data'

const ROWS = { football: standingsTableRows, basketball: basketballStandingsTableRows }

export interface PublicStandingsProps {
  sport?: keyof typeof sportSettings
}

/**
 * Tabela strony publicznej (#206): te same `StandingsTable`
 * i `TiebreakerSentence` co panel. Nagłówek kolumny zdobyczy, kolumnę R
 * i zdanie o kolejności niesie odpowiedź tabeli (`scoreLabel`, `allowsDraw`,
 * `tiebreakers`); tu stoją statycznie, z `lib/demo-data`.
 */
export function PublicStandings({ sport = 'football' }: PublicStandingsProps) {
  const settings = sportSettings[sport]
  const tournament = { ...publicTournament, sport: { code: sport, name: settings.name } }

  return (
    <Shell tournament={tournament} active="standings">
      <section className="space-y-3">
        <Heading level="section">Faza zasadnicza</Heading>
        <StandingsTable rows={ROWS[sport]} scoreLabel={settings.scoreLabel} allowsDraw={settings.allowsDraw} />
        <TiebreakerSentence items={settings.tiebreakers} />
      </section>
    </Shell>
  )
}
