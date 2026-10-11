import { createColumnHelper } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'
import { TeamLogo } from '../layout/team-logo'
import { DataTable, type DataTableFeatures, type DataTableStatus } from './data-table'
import type { StandingsTableRow } from './standings-table-row'

export type { StandingsTableRow }

export interface StandingsTableProps {
  rows: StandingsTableRow[]
  /** Nagłówek kolumny zdobyczy, `StandingTable.scoreLabel` z odpowiedzi (ADR-0006). */
  scoreLabel: string
  /** `SportConfig.allowsDraw`. Bez remisów kolumna R znika. */
  allowsDraw: boolean
  /**
   * Miejsca według zapisanych kryteriów, po `team.id`. Podane włączają
   * podgląd: wiersz, który zmienił miejsce, jest podświetlony, a przy pozycji
   * stoi strzałka.
   */
  previousPositions?: ReadonlyMap<number, number>
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
  errorMessage?: string
  onRetry?: () => void
  /** Akcja pustego stanu (turniej bez drużyn), np. odnośnik do Drużyn. */
  emptyAction?: React.ReactNode
}

const helper = createColumnHelper<DataTableFeatures, StandingsTableRow>()

const NUMBER = 'w-10 text-center tabular-nums'

/** Skrót kolumny z pełną nazwą w podpowiedzi. */
function Abbr({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <abbr title={title} className="no-underline">
      {children}
    </abbr>
  )
}

/** Pozycja ze strzałką zmiany względem zapisanych kryteriów (podgląd). */
function Position({ position, previous }: { position: number; previous: number | undefined }) {
  const up = previous !== undefined && previous > position
  const down = previous !== undefined && previous < position
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {up && <ArrowUp aria-hidden className="size-3 text-primary" />}
      {down && <ArrowDown aria-hidden className="size-3 text-destructive" />}
      {position}
      {(up || down) && <span className="sr-only">, wcześniej {previous}.</span>}
    </span>
  )
}

function standingsColumns(scoreLabel: string, allowsDraw: boolean, previousPositions: StandingsTableProps['previousPositions']) {
  return helper.columns([
    helper.accessor('position', {
      header: '#',
      meta: { className: 'w-12 text-right font-semibold tabular-nums' },
      cell: ({ row }) => (
        <Position position={row.original.position} previous={previousPositions?.get(row.original.team.id)} />
      ),
    }),
    helper.accessor('team', {
      header: 'Drużyna',
      cell: ({ getValue }) => {
        const team = getValue()
        return (
          <span className="flex items-center gap-2 font-medium">
            <TeamLogo logoUrl={team.logoUrl} name={team.name} />
            {team.name}
          </span>
        )
      },
    }),
    helper.accessor('played', { header: () => <Abbr title="Mecze">M</Abbr>, meta: { className: NUMBER } }),
    helper.accessor('won', { header: () => <Abbr title="Wygrane">W</Abbr>, meta: { className: NUMBER } }),
    ...(allowsDraw
      ? [helper.accessor('drawn', { header: () => <Abbr title="Remisy">R</Abbr>, meta: { className: NUMBER } })]
      : []),
    helper.accessor('lost', { header: () => <Abbr title="Porażki">P</Abbr>, meta: { className: NUMBER } }),
    helper.display({
      id: 'score',
      header: scoreLabel,
      meta: { className: 'w-20 text-center tabular-nums text-muted-foreground' },
      cell: ({ row }) => `${row.original.scoreFor}:${row.original.scoreAgainst}`,
    }),
    helper.accessor('scoreDifference', {
      header: () => <Abbr title="Bilans">+/−</Abbr>,
      meta: { className: 'w-12 text-center tabular-nums text-muted-foreground' },
      cell: ({ getValue }) => {
        const difference = getValue()
        return difference > 0 ? `+${difference}` : difference
      },
    }),
    helper.accessor('points', {
      header: 'Pkt',
      // Nagłówek „Pkt” w kolorze tekstu, jak w `public-standings`: to kolumna,
      // po której tabela jest ułożona.
      meta: { className: 'w-12 text-center font-bold tabular-nums text-foreground!' },
    }),
  ])
}

/**
 * Tabela ligi w panelu (#173). Nagłówek odcięty od wierszy tak jak
 * w `public-standings`: tło, wersaliki, drobniejszy i przytłumiony krój.
 * Drużyny z tą samą liczbą punktów tworzą blok, który od reszty oddziela
 * grubsza linia — remis czyta się wtedy jako całość.
 */
export function StandingsTable({
  rows,
  scoreLabel,
  allowsDraw,
  previousPositions,
  status,
  errorMessage,
  onRetry,
  emptyAction,
}: StandingsTableProps) {
  const columns = React.useMemo(
    () => standingsColumns(scoreLabel, allowsDraw, previousPositions),
    [scoreLabel, allowsDraw, previousPositions],
  )

  // Ramka tylko wokół tabeli: stan pusty i błąd mają własną, przerywaną.
  return (
    <div className="has-[table]:overflow-hidden has-[table]:rounded-xl has-[table]:border has-[table]:bg-card">
      <DataTable
        data={rows}
        columns={columns}
        status={status}
        errorTitle="Nie udało się wczytać tabeli"
        errorMessage={errorMessage}
        onRetry={onRetry}
        empty={{
          icon: <ListOrdered />,
          title: 'Turniej nie ma jeszcze drużyn',
          description: 'Tabela powstaje z drużyn turnieju. Dodaj je, a pojawią się tu od razu, jeszcze przed pierwszym meczem.',
          createLabel: 'Przejdź do drużyn',
        }}
        emptyAction={emptyAction}
        headerClassName="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:bg-muted/60 [&_tr]:hover:bg-muted/60"
        rowClassName={(row, index) => {
          const moved = previousPositions !== undefined && previousPositions.get(row.team.id) !== row.position
          const newPointsBlock = index > 0 && rows[index - 1]!.points !== row.points
          return cn(newPointsBlock && 'border-t-2 border-t-border', moved && 'bg-accent hover:bg-accent')
        }}
        loadingLabel="Wczytywanie tabeli"
      />
    </div>
  )
}
