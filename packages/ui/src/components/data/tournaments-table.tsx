import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { AlertTriangle, Trophy } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { TournamentRow } from './tournament-row'

export type { TournamentRow }

/** Stan pobierania danych — nazwy jak `status` z TanStack Query. */
export type TournamentsTableStatus = 'pending' | 'error' | 'success'

export interface TournamentsTableProps {
  tournaments: TournamentRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: TournamentsTableStatus
  /**
   * Liczba wszystkich turniejów z kontraktu. Kontrakt stronicuje listę, a panel
   * pokazuje na razie jedną stronę, więc licznik pod tabelą mówi wprost, ile
   * turniejów jest w sumie. Bez tego propsa licznika nie ma.
   */
  total?: number
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w stanie pustym. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
}

const STATUS_BADGE: Record<
  TournamentRow['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: 'Szkic', variant: 'secondary' },
  active: { label: 'Trwa', variant: 'default' },
  finished: { label: 'Zakończony', variant: 'outline' },
}

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, TournamentRow>()

const columns = helper.columns([
  helper.accessor('name', {
    header: 'Nazwa',
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  helper.accessor((row) => row.sport.name, { id: 'sport', header: 'Sport' }),
  helper.accessor('teamsCount', { header: 'Drużyny' }),
  helper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => {
      const badge = STATUS_BADGE[getValue()]
      return <Badge variant={badge.variant}>{badge.label}</Badge>
    },
  }),
  helper.accessor('slug', {
    header: 'Adres publiczny',
    cell: ({ getValue }) => <span className="text-muted-foreground">/t/{getValue()}</span>,
  }),
])

const SKELETON_ROWS = 3

export function TournamentsTable({
  tournaments,
  status = 'success',
  total,
  errorMessage,
  onRetry,
  onCreate,
}: TournamentsTableProps) {
  const table = useTable({ features, columns, data: tournaments })

  if (status === 'error') {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title="Nie udało się wczytać turniejów"
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

  if (status === 'success' && tournaments.length === 0) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Nie masz jeszcze turniejów"
        description="Załóż pierwszy turniej, żeby wygenerować terminarz i udostępnić stronę publiczną."
        action={onCreate && <Button onClick={onCreate}>Nowy turniej</Button>}
      />
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                    {/* Tylko pierwszy pasek ogłasza ładowanie: trzy naraz czytnik
                        ekranu przeczytałby trzy razy. */}
                    <Skeleton
                      role={index === 0 ? 'status' : undefined}
                      aria-label={index === 0 ? 'Wczytywanie turniejów' : undefined}
                      className="h-5 w-full"
                    />
                  </TableCell>
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {/* Licznik nie czeka na to, aż lista zostanie ucięta: „2 z 2" to też
          uczciwa informacja, a stronicowania jeszcze nie ma. */}
      {status === 'success' && total !== undefined && total > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Pokazano {tournaments.length} z {total} turniejów.
        </p>
      ) : null}
    </>
  )
}
