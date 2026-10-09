import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { AlertTriangle, Pencil, Trash2, UserRound } from 'lucide-react'
import * as React from 'react'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { PlayerRow } from './player-row'

export type { PlayerRow }

/** Stan pobierania danych — nazwy jak `status` z TanStack Query. */
export type PlayersTableStatus = 'pending' | 'error' | 'success'

export interface PlayersTableProps {
  /** Skład w kolejności ustalonej przez backend (#89 pkt 7). Tabela nie sortuje. */
  players: PlayerRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: PlayersTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w pustym składzie. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  onEdit: (player: PlayerRow) => void
  onDelete: (player: PlayerRow) => void
}

/**
 * `className` z `meta` trafia i do nagłówka, i do komórek kolumny, żeby obie
 * strony tabeli nie rozjechały się przy zmianie.
 */
interface PlayerColumnMeta {
  className?: string
}

const features = tableFeatures({ columnMeta: {} as PlayerColumnMeta })
const helper = createColumnHelper<typeof features, PlayerRow>()

function playerColumns(onEdit: PlayersTableProps['onEdit'], onDelete: PlayersTableProps['onDelete']) {
  return helper.columns([
    helper.accessor('number', {
      header: 'Nr',
      meta: { className: 'w-0 text-right tabular-nums' },
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">–</span>,
    }),
    helper.accessor('name', {
      header: 'Imię i nazwisko',
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    helper.accessor('position', {
      header: 'Pozycja',
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">Akcje</span>,
      // `w-0` zwęża kolumnę do szerokości przycisków, jak w `TournamentsTable`.
      meta: { className: 'w-0' },
      cell: ({ row }) => {
        const player = row.original
        // Nazwy dostępne z imieniem zawodnika: dwanaście przycisków „Edytuj"
        // brzmiałoby dla czytnika ekranu identycznie.
        return (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edytuj zawodnika ${player.name}`}
              onClick={() => onEdit(player)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Usuń zawodnika ${player.name}`}
              onClick={() => onDelete(player)}
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

export function PlayersTable({
  players,
  status = 'success',
  errorMessage,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
}: PlayersTableProps) {
  const columns = React.useMemo(() => playerColumns(onEdit, onDelete), [onEdit, onDelete])
  const table = useTable({ features, columns, data: players })

  if (status === 'error') {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title="Nie udało się wczytać zawodników"
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

  // Bez przykładowych pozycji (#89 pkt 10): udawały prawdziwe dane i zakładały
  // piłkę nożną także w koszykówce.
  if (status === 'success' && players.length === 0) {
    return (
      <EmptyState
        icon={<UserRound />}
        title="Brak zawodników"
        action={onCreate && <Button onClick={onCreate}>Dodaj zawodnika</Button>}
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
                    aria-label={index === 0 ? 'Wczytywanie zawodników' : undefined}
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
