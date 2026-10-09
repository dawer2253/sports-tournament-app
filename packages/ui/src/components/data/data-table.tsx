import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

/** Stan pobierania danych — nazwy jak `status` z TanStack Query. */
export type DataTableStatus = 'pending' | 'error' | 'success'

/**
 * `className` z `meta` trafia i do nagłówka, i do komórek kolumny, żeby obie
 * strony tabeli nie rozjechały się przy zmianie.
 */
export interface DataTableColumnMeta {
  className?: string
}

const dataTableFeatures = tableFeatures({ columnMeta: {} as DataTableColumnMeta })

/** Cechy TanStack Table wspólne dla tabel danych. Kolumny buduj na nich. */
export type DataTableFeatures = typeof dataTableFeatures

// `any` jak w `helper.columns()`: kolumny jednej tabeli mają różne typy wartości.
export type DataTableColumns<Row extends RowData> = Array<ColumnDef<DataTableFeatures, Row, any>>

export interface DataTableProps<Row extends RowData> {
  data: Row[]
  /**
   * Muszą być stabilne między renderami: tabela specyficzna memoizuje je po
   * swoich callbackach, a panel na tym polega (#46).
   */
  columns: DataTableColumns<Row>
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
  /** Tytuł stanu błędu, np. „Nie udało się wczytać obiektów”. */
  errorTitle: string
  errorMessage?: string
  onRetry?: () => void
  /** Stan pustej listy. `createLabel` to etykieta akcji, np. „Dodaj obiekt”. */
  empty: {
    icon: React.ReactNode
    title: string
    description?: string
    createLabel: string
  }
  /** Akcja w stanie pustym. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  /** Nazwa dostępna szkieletu, np. „Wczytywanie obiektów”. */
  loadingLabel: string
  /** Klasy paska szkieletu, np. wyższy `h-7`, gdy wiersze są wyższe od tekstu. */
  skeletonClassName?: string
  /**
   * Treść pod tabelą. Pojawia się tylko razem z tabelą, nie w stanie błędu ani
   * pustej listy; kiedy jeszcze ją pokazać, decyduje wywołujący.
   */
  footer?: React.ReactNode
}

const SKELETON_ROWS = 3

/**
 * Rama tabel danych: stany wczytywania, błędu i pustej listy oraz wiersze.
 * Tabele specyficzne (`VenuesTable` itd.) podają tylko kolumny i teksty.
 */
export function DataTable<Row extends RowData>({
  data,
  columns,
  status = 'success',
  errorTitle,
  errorMessage,
  onRetry,
  empty,
  onCreate,
  loadingLabel,
  skeletonClassName,
  footer,
}: DataTableProps<Row>) {
  const table = useTable({ features: dataTableFeatures, columns, data })

  if (status === 'error') {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title={errorTitle}
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

  if (status === 'success' && data.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={onCreate && <Button onClick={onCreate}>{empty.createLabel}</Button>}
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
                    {/* Tylko pierwszy pasek ogłasza ładowanie: trzy naraz czytnik
                        ekranu przeczytałby trzy razy. */}
                    <Skeleton
                      role={index === 0 ? 'status' : undefined}
                      aria-label={index === 0 ? loadingLabel : undefined}
                      className={cn('h-5 w-full', skeletonClassName)}
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
      {footer}
    </>
  )
}

export interface EditDeleteColumnOptions<Row extends RowData> {
  /**
   * Byt w bierniku razem z nazwą, np. „obiekt Boisko B”, „zawodnika Jan Nowak”.
   * Cała fraza, a nie sam rzeczownik, bo odmiana zależy od bytu.
   */
  rowLabel: (row: Row) => string
  onEdit: (row: Row) => void
  onDelete: (row: Row) => void
}

/** Kolumna z ołówkiem i koszem na końcu wiersza. */
export function editDeleteColumn<Row extends RowData>({
  rowLabel,
  onEdit,
  onDelete,
}: EditDeleteColumnOptions<Row>) {
  return createColumnHelper<DataTableFeatures, Row>().display({
    id: 'actions',
    header: () => <span className="sr-only">Akcje</span>,
    // `w-0` zwęża kolumnę do szerokości przycisków, jak w `TournamentsTable`.
    meta: { className: 'w-0' },
    cell: ({ row }) => {
      const label = rowLabel(row.original)
      // Nazwy dostępne z nazwą bytu: kilka przycisków „Edytuj" obok siebie
      // brzmiałoby dla czytnika ekranu identycznie.
      return (
        <span className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edytuj ${label}`}
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Usuń ${label}`}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      )
    },
  })
}
