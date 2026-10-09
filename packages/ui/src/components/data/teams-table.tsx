import { createColumnHelper } from '@tanstack/react-table'
import { Users } from 'lucide-react'
import * as React from 'react'
import { TeamLogo } from '../layout/team-logo'
import { DataTable, type DataTableFeatures, type DataTableStatus } from './data-table'
import type { TeamRow } from './team-row'

export type { TeamRow }

export interface TeamsTableProps {
  teams: TeamRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w stanie pustym. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  /**
   * Adres składu drużyny. Wymagany, bo wiersz listy jest wyłącznie linkiem
   * (#89 pkt 4): bez adresu nazwa nie prowadziłaby nigdzie.
   */
  teamHref: (team: TeamRow) => string
  /**
   * Przejęcie kliknięcia w nazwę, np. przez router. W odróżnieniu od
   * `onNavigate` w `AdminShell`, który przejmuje każde kliknięcie lewym
   * przyciskiem, kliknięcie z modyfikatorem (np. Ctrl) zostaje przeglądarce
   * (nowa karta). Bez tego propsa link działa samym `href`.
   */
  onOpenTeam?: (team: TeamRow) => void
}

const helper = createColumnHelper<DataTableFeatures, TeamRow>()

/**
 * Kliknięcie z modyfikatorem albo środkowym przyciskiem zostaje przeglądarce:
 * organizer otwiera wtedy skład w nowej karcie, a router by mu to zabrał.
 */
function isPlainClick(event: React.MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function teamColumns(
  teamHref: TeamsTableProps['teamHref'],
  onOpenTeam: TeamsTableProps['onOpenTeam'],
) {
  return helper.columns([
    helper.accessor('name', {
      header: 'Drużyna',
      cell: ({ row }) => {
        const team = row.original
        return (
          <span className="flex items-center gap-3">
            <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-7" />
            <a
              href={teamHref(team)}
              className="font-medium underline-offset-4 hover:underline"
              onClick={(event) => {
                if (!onOpenTeam || !isPlainClick(event)) return
                event.preventDefault()
                onOpenTeam(team)
              }}
            >
              {team.name}
            </a>
          </span>
        )
      },
    }),
    helper.accessor('playersCount', {
      header: 'Zawodnicy',
      // Sama liczba, bez odmiany: kolumna ma nagłówek, a „12 zawodników" obok
      // „1 zawodnik" tylko utrudnia porównanie w pionie.
      meta: { className: 'w-0 text-right tabular-nums' },
    }),
  ])
}

export function TeamsTable({
  teams,
  status,
  errorMessage,
  onRetry,
  onCreate,
  teamHref,
  onOpenTeam,
}: TeamsTableProps) {
  const columns = React.useMemo(() => teamColumns(teamHref, onOpenTeam), [teamHref, onOpenTeam])

  return (
    <DataTable
      data={teams}
      columns={columns}
      status={status}
      errorTitle="Nie udało się wczytać drużyn"
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: <Users />,
        title: 'Turniej nie ma jeszcze drużyn',
        description: 'Dodaj drużyny, a składy uzupełnisz później.',
        createLabel: 'Dodaj drużynę',
      }}
      onCreate={onCreate}
      loadingLabel="Wczytywanie drużyn"
    />
  )
}
