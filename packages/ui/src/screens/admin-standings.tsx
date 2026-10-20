import { TournamentShellDemo } from './shell-demo'
import { StandingsTable } from '../components/data/standings-table'
import { TiebreakerEditor, TiebreakerSentence } from '../components/data/tiebreaker-editor'
import { Heading } from '../components/ui/typography'
import {
  basketballStandingsTableRows,
  volleyballStandingsTableRows,
  sportSettings,
  standingsTablePreviewDraft,
  standingsTablePreviewRows,
  standingsTableRows,
} from '../lib/demo-data'

const ROWS = { football: standingsTableRows, basketball: basketballStandingsTableRows, volleyball: volleyballStandingsTableRows }

export interface AdminStandingsProps {
  sport?: keyof typeof sportSettings
  /**
   * Szkic kolejności różny od zapisanej (piłka): `standingsTablePreviewDraft`,
   * a tabela pokazuje podgląd ze zmianą miejsc.
   */
  preview?: boolean
}

/**
 * Tabela ligi z kartą „Rozstrzyganie remisów” (#173). W panelu dane i szkic
 * przychodzą z API; tu stoją statycznie, z `lib/demo-data`.
 */
export function AdminStandings({ sport = 'football', preview = false }: AdminStandingsProps) {
  const settings = sportSettings[sport]
  const rows = ROWS[sport]
  const value = preview ? standingsTablePreviewDraft : settings.tiebreakers.map((item) => item.code)
  const label = (code: string) => settings.availableTiebreakers.find((item) => item.code === code)?.label ?? code

  return (
    <TournamentShellDemo active="standings" sportName={settings.name}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Heading level="card">Faza zasadnicza</Heading>
              <span className="text-xs text-muted-foreground">{rows.length} drużyn</span>
            </div>
            <StandingsTable
              rows={preview ? standingsTablePreviewRows : rows}
              scoreLabel={settings.scoreLabel}
              allowsDraw={settings.allowsDraw}
              rallyPointsLabel={settings.rallyPointsLabel}
              previousPositions={preview ? new Map(rows.map((row) => [row.team.id, row.position])) : undefined}
            />
          </section>
          <TiebreakerSentence items={value.map((code) => ({ code, label: label(code) }))} />
        </div>
        <div className="lg:sticky lg:top-4">
          <TiebreakerEditor
            value={value}
            onChange={() => {}}
            available={settings.availableTiebreakers}
            dirty={preview}
            preview={preview ? 'Podgląd: 4 drużyny zmieniają miejsce.' : undefined}
            onSave={() => {}}
            onDiscard={() => {}}
          />
        </div>
      </div>
    </TournamentShellDemo>
  )
}
