import { createColumnHelper } from '@tanstack/react-table'
import { MapPin } from 'lucide-react'
import * as React from 'react'
import { DataTable, editDeleteColumn, type DataTableFeatures, type DataTableStatus } from './data-table'
import type { VenueRow } from './venue-row'

export type { VenueRow }

export interface VenuesTableProps {
  venues: VenueRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w stanie pustym. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  onEdit: (venue: VenueRow) => void
  onDelete: (venue: VenueRow) => void
}

const helper = createColumnHelper<DataTableFeatures, VenueRow>()

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
    editDeleteColumn<VenueRow>({ rowLabel: (venue) => `obiekt ${venue.name}`, onEdit, onDelete }),
  ])
}

export function VenuesTable({
  venues,
  status,
  errorMessage,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
}: VenuesTableProps) {
  const columns = React.useMemo(() => venueColumns(onEdit, onDelete), [onEdit, onDelete])

  return (
    <DataTable
      data={venues}
      columns={columns}
      status={status}
      errorTitle="Nie udało się wczytać obiektów"
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: <MapPin />,
        title: 'Turniej nie ma jeszcze obiektów',
        description: 'Dodaj boiska i hale, żeby przypisywać do nich mecze w terminarzu.',
        createLabel: 'Dodaj obiekt',
      }}
      onCreate={onCreate}
      loadingLabel="Wczytywanie obiektów"
    />
  )
}
