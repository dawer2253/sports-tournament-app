import { TournamentShellDemo } from './shell-demo'
import { StandingsTable } from '../components/data/standings-table'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import { TiebreakerEditor, TiebreakerSentence } from '../components/data/tiebreaker-editor'
import type { TiebreakerItem } from '../components/data/tiebreaker-item'
import { Heading } from '../components/ui/typography'
import {
  basketballStandingsTableRows,
  sportSettings,
  standingsTablePreviewRows,
  standingsTableRows,
} from '../lib/demo-data'

/** Sport makiety: dane tabeli, nagłówek zdobyczy i kryteria. */
const SPORTS = {
  football: {
    rows: standingsTableRows,
    scoreLabel: 'Bramki',
    available: [...sportSettings.football.tiebreakers, { code: 'wins', label: 'Zwycięstwa' }],
  },
  basketball: {
    rows: basketballStandingsTableRows,
    scoreLabel: 'Punkty',
    available: [
      ...sportSettings.basketball.tiebreakers,
      { code: 'score_for', label: 'Zdobyte punkty' },
      { code: 'wins', label: 'Zwycięstwa' },
    ],
  },
} satisfies Record<string, { rows: StandingsTableRow[]; scoreLabel: string; available: TiebreakerItem[] }>

export interface AdminStandingsProps {
  sport?: keyof typeof SPORTS
  /**
   * Szkic kolejności różny od zapisanej (piłka): `score_diff` przed
   * `head_to_head`, a tabela pokazuje podgląd ze zmianą miejsc.
   */
  preview?: boolean
}

/**
 * Tabela ligi z kartą „Rozstrzyganie remisów” (#173). W panelu dane i szkic
 * przychodzą z API; tu stoją statycznie, z `lib/demo-data`.
 */
export function AdminStandings({ sport = 'football', preview = false }: AdminStandingsProps) {
  const { rows, scoreLabel, available } = SPORTS[sport]
  const saved = sportSettings[sport].tiebreakers.map((item) => item.code)
  const value = preview ? ['points', 'score_diff', 'head_to_head', 'score_for'] : saved
  const label = (code: string) => available.find((item) => item.code === code)?.label ?? code

  return (
    <TournamentShellDemo active="standings" sportName={sportSettings[sport].name}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Heading level="card">Faza zasadnicza</Heading>
              <span className="text-xs text-muted-foreground">{rows.length} drużyn</span>
            </div>
            <StandingsTable
              rows={preview ? standingsTablePreviewRows : rows}
              scoreLabel={scoreLabel}
              allowsDraw={sportSettings[sport].allowsDraw}
              previousPositions={preview ? new Map(rows.map((row) => [row.team.id, row.position])) : undefined}
            />
          </section>
          <TiebreakerSentence items={value.map((code) => ({ code, label: label(code) }))} />
        </div>
        <div className="lg:sticky lg:top-4">
          <TiebreakerEditor
            value={value}
            onChange={() => {}}
            available={available}
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
