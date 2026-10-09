import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { AlertTriangle, MapPin, Pencil, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { VenueRow } from './venue-row'

export type { VenueRow }

/** Stan pobierania danych — nazwy jak `status` z TanStack Query. */
export type VenuesTableStatus = 'pending' | 'error' | 'success'

export interface VenuesTableProps {
  venues: VenueRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: VenuesTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w stanie pustym. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  onEdit: (venue: VenueRow) => void
  onDelete: (venue: VenueRow) => void
}

/**
 * `className` z `meta` trafia i do nagłówka, i do komórek kolumny, żeby obie
 * strony tabeli nie rozjechały się przy zmianie.
 */
interface VenueColumnMeta {
  className?: string
}

const features = tableFeatures({ columnMeta: {} as VenueColumnMeta })
const helper = createColumnHelper<typeof features, VenueRow>()

function venueColumns(onEdit: VenuesTableProps['onEdit'], onDelete: VenuesTableProps['onDelete']) {
  return helper.columns([
    helper.accessor('name', {
      header: 'Nazwa',
      cell: ({ getValue }) => (
        <span className="flex items-center gap-2 font-medium">
          <MapPin className="size-4 text-muted-foreground" />
          {getValue()}
        </span>
      ),
    }),
    helper.accessor('address', {
      header: 'Adres',
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? '–'}</span>,
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">Akcje</span>,
      // `w-0` zwęża kolumnę do szerokości przycisków, jak w `TournamentsTable`.
      meta: { className: 'w-0' },
      cell: ({ row }) => {
        const venue = row.original
        // Nazwy dostępne z nazwą obiektu: trzy przyciski „Edytuj" obok siebie
        // brzmiałyby dla czytnika ekranu identycznie.
        return (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edytuj obiekt ${venue.name}`}
              onClick={() => onEdit(venue)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Usuń obiekt ${venue.name}`}
              onClick={() => onDelete(venue)}
            >
              <Trash2 className="size-4" />
            </Button>
          </span>
        )
      },
    }),
  ])
}

const SKELETON_ROWS = 3

export function VenuesTable({
  venues,
  status = 'success',
  errorMessage,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
}: VenuesTableProps) {
  const columns = React.useMemo(() => venueColumns(onEdit, onDelete), [onEdit, onDelete])
  const table = useTable({ features, columns, data: venues })

  if (status === 'error') {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title="Nie udało się wczytać obiektów"
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

  if (status === 'success' && venues.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="Turniej nie ma jeszcze obiektów"
        description="Dodaj boiska i hale, żeby przypisywać do nich mecze w terminarzu."
        action={onCreate && <Button onClick={onCreate}>Dodaj obiekt</Button>}
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
                    aria-label={index === 0 ? 'Wczytywanie obiektów' : undefined}
                    className="h-5 w-full"
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
