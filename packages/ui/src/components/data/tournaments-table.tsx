import { createColumnHelper } from '@tanstack/react-table'
import { ArrowUpRight, Trophy } from 'lucide-react'
import * as React from 'react'
import { Button } from '../ui/button'
import { DataTable, type DataTableFeatures, type DataTableStatus } from './data-table'
import type { TournamentRow } from './tournament-row'
import { TournamentStatusBadge } from './tournament-status-badge'

export type { TournamentRow }

export interface TournamentsTableProps {
  tournaments: TournamentRow[]
  /** Domyślnie `success`: dane są już w ręku. */
  status?: DataTableStatus
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

const helper = createColumnHelper<DataTableFeatures, TournamentRow>()

const dataColumns = helper.columns([
  helper.accessor('name', {
    header: 'Nazwa',
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  helper.accessor((row) => row.sport.name, { id: 'sport', header: 'Sport' }),
  helper.accessor('teamsCount', { header: 'Drużyny' }),
  helper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <TournamentStatusBadge status={getValue()} />,
  }),
  helper.accessor('slug', {
    header: 'Adres publiczny',
    cell: ({ getValue }) => <span className="text-muted-foreground">/t/{getValue()}</span>,
  }),
])

/**
 * Kolumna akcji domyka wiersz (#26). Pięć krótkich kolumn rozciągało się na całą
 * szerokość obszaru treści i zostawiało ~220 px pustki za ostatnią z nich; wąska
 * kolumna na końcu zajmuje tę nadwyżkę czymś, co ma sens, zamiast
 * przesuwać pustkę w inne miejsce.
 */
function actionsColumn(onOpen: (tournament: TournamentRow) => void) {
  return helper.display({
    id: 'actions',
    header: 'Akcje',
    // `w-0` zwęża kolumnę do szerokości przycisku, więc nadwyżka zostaje
    // w kolumnach z danymi.
    meta: { className: 'w-0' },
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        // Ghost nie ma widocznej ramki, więc za lewą krawędź przycisku uchodzi
        // jego tekst. Ujemny margines równa „Otwórz" z nagłówkiem „Akcje",
        // tak jak w pozostałych kolumnach treść stoi równo z nagłówkiem.
        className="-ml-2.5"
        // Nazwa dostępna z nazwą turnieju: trzy przyciski „Otwórz" obok siebie
        // brzmiałyby dla czytnika ekranu identycznie.
        aria-label={`Otwórz turniej ${row.original.name}`}
        onClick={() => onOpen(row.original)}
      >
        Otwórz <ArrowUpRight data-icon="inline-end" />
      </Button>
    ),
  })
}

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

  return (
    <DataTable
      data={tournaments}
      columns={columns}
      status={status}
      errorTitle="Nie udało się wczytać turniejów"
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: <Trophy />,
        title: 'Nie masz jeszcze turniejów',
        description:
          'Załóż pierwszy turniej, żeby wygenerować terminarz i udostępnić stronę publiczną.',
        createLabel: 'Nowy turniej',
      }}
      onCreate={onCreate}
      loadingLabel="Wczytywanie turniejów"
      footer={
        // Licznik nie czeka na to, aż lista zostanie ucięta: „2 z 2" to też
        // uczciwa informacja, a stronicowania jeszcze nie ma.
        status === 'success' && total !== undefined && total > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Pokazano {tournaments.length} z {total} turniejów.
          </p>
        ) : null
      }
    />
  )
}
