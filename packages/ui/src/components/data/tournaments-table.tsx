import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { AlertTriangle, ArrowUpRight, Trophy } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'
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
  /**
   * Wejście w turniej z wiersza. Bez tego propsa kolumny akcji nie ma: tabela
   * nie pokazuje przycisku, który donikąd nie prowadzi.
   */
  onOpen?: (tournament: TournamentRow) => void
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

const dataColumns = helper.columns([
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

const ACTIONS_COLUMN_ID = 'actions'

/**
 * Klasa komórki kolumny akcji — jedna dla nagłówka i dla wiersza, żeby obie
 * strony tabeli nie rozjechały się przy zmianie. `w-0` zwęża kolumnę do treści
 * przycisku: nadwyżka szerokości ma zostać w kolumnach z danymi.
 */
function actionsCellClass(columnId: string) {
  return cn(columnId === ACTIONS_COLUMN_ID && 'w-0 text-right')
}

/**
 * Kolumna akcji domyka wiersz (#26). Pięć krótkich kolumn rozciągało się na całą
 * szerokość obszaru treści i zostawiało ~220 px pustki za ostatnią z nich; wąska
 * kolumna wyrównana do prawej zajmuje tę nadwyżkę czymś, co ma sens, zamiast
 * przesuwać pustkę w inne miejsce.
 */
function actionsColumn(onOpen: (tournament: TournamentRow) => void) {
  return helper.display({
    id: ACTIONS_COLUMN_ID,
    header: 'Akcje',
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        // Nazwa dostępna z nazwą turnieju: trzy przyciski „Otwórz" obok siebie
        // brzmiałyby dla czytnika ekranu identycznie.
        aria-label={`Otwórz turniej ${row.original.name}`}
        onClick={() => onOpen(row.original)}
      >
        Otwórz <ArrowUpRight className="size-4" />
      </Button>
    ),
  })
}

const SKELETON_ROWS = 3

export function TournamentsTable({
  tournaments,
  status = 'success',
  total,
  errorMessage,
  onRetry,
  onCreate,
  onOpen,
}: TournamentsTableProps) {
  const columns = React.useMemo(
    () => (onOpen ? [...dataColumns, actionsColumn(onOpen)] : dataColumns),
    [onOpen],
  )
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
                <TableHead
                  key={header.id}
                  className={actionsCellClass(header.column.id)}
                >
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
                    <TableCell
                      key={cell.id}
                      className={actionsCellClass(cell.column.id)}
                    >
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
