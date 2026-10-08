import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { AlertTriangle, Users } from 'lucide-react'
import * as React from 'react'
import { TeamLogo } from '../layout/team-logo'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { TeamRow } from './team-row'

export type { TeamRow }

/** Stan pobierania danych — nazwy jak `status` z TanStack Query. */
export type TeamsTableStatus = 'pending' | 'error' | 'success'

export interface TeamsTableProps {
  teams: TeamRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: TeamsTableStatus
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
   * `onNavigate` w `AdminShell`, który przejmuje każde kliknięcie, kliknięcie
   * z modyfikatorem albo środkowym przyciskiem zostaje przeglądarce (nowa
   * karta). Bez tego propsa link działa samym `href`.
   */
  onOpenTeam?: (team: TeamRow) => void
}

/**
 * `className` z `meta` trafia i do nagłówka, i do komórek kolumny, żeby obie
 * strony tabeli nie rozjechały się przy zmianie.
 */
interface TeamColumnMeta {
  className?: string
}

const features = tableFeatures({ columnMeta: {} as TeamColumnMeta })
const helper = createColumnHelper<typeof features, TeamRow>()

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

const SKELETON_ROWS = 3

export function TeamsTable({
  teams,
  status = 'success',
  errorMessage,
  onRetry,
  onCreate,
  teamHref,
  onOpenTeam,
}: TeamsTableProps) {
  const columns = React.useMemo(() => teamColumns(teamHref, onOpenTeam), [teamHref, onOpenTeam])
  const table = useTable({ features, columns, data: teams })

  if (status === 'error') {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title="Nie udało się wczytać drużyn"
        description={errorMessage}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Spróbuj ponownie
            </Button>
          )
        }
      />
    )
  }

  if (status === 'success' && teams.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Turniej nie ma jeszcze drużyn"
        description="Dodaj drużyny, a składy uzupełnisz później."
        action={onCreate && <Button onClick={onCreate}>Dodaj drużynę</Button>}
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                <table.FlexRender header={header} />
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {status === 'pending'
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={columns.length}>
                  {/* Tylko pierwszy pasek ogłasza ładowanie, jak w `TournamentsTable`. */}
                  <Skeleton
                    role={index === 0 ? 'status' : undefined}
                    aria-label={index === 0 ? 'Wczytywanie drużyn' : undefined}
                    className="h-7 w-full"
                  />
                </TableCell>
              </TableRow>
            ))
          : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
