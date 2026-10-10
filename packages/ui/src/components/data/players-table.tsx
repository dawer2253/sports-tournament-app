import { createColumnHelper } from '@tanstack/react-table'
import { UserRound } from 'lucide-react'
import * as React from 'react'
import { DataTable, editDeleteColumn, type DataTableFeatures, type DataTableStatus } from './data-table'
import type { PlayerRow } from './player-row'

export type { PlayerRow }

export interface PlayersTableProps {
  /** Skład w kolejności ustalonej przez backend (#89 pkt 7). Tabela nie sortuje. */
  players: PlayerRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja w pustym składzie. Bez niej zostaje sam komunikat. */
  onCreate?: () => void
  onEdit: (player: PlayerRow) => void
  onDelete: (player: PlayerRow) => void
}

const helper = createColumnHelper<DataTableFeatures, PlayerRow>()

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
    editDeleteColumn<PlayerRow>({
      rowLabel: (player) => `zawodnika ${player.name}`,
      onEdit,
      onDelete,
    }),
  ])
}

export function PlayersTable({
  players,
  status,
  errorMessage,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
}: PlayersTableProps) {
  const columns = React.useMemo(() => playerColumns(onEdit, onDelete), [onEdit, onDelete])

  return (
    <DataTable
      data={players}
      columns={columns}
      status={status}
      errorTitle="Nie udało się wczytać zawodników"
      errorMessage={errorMessage}
      onRetry={onRetry}
      // Bez przykładowych pozycji (#89 pkt 10): udawały prawdziwe dane i zakładały
      // piłkę nożną także w koszykówce.
      empty={{ icon: <UserRound />, title: 'Brak zawodników', createLabel: 'Dodaj zawodnika' }}
      onCreate={onCreate}
      loadingLabel="Wczytywanie zawodników"
    />
  )
}
