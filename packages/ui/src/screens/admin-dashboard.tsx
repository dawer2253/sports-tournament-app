import { Plus } from 'lucide-react'
import type { DataTableStatus } from '../components/data/data-table'
import { TournamentsTable } from '../components/data/tournaments-table'
import { Button } from '../components/ui/button'
import { tournamentList } from '../lib/demo-data'
import { ShellDemo } from './shell-demo'

/** Cztery stany listy, które odróżnia panel; reszta ekranu to ich pochodne. */
export type AdminDashboardState = 'wczytuje' | 'zawartosc' | 'pusty' | 'blad'

export interface AdminDashboardProps {
  /** Stan listy turniejów. Domyślnie wczytana, niepusta lista. */
  state?: AdminDashboardState
}

/** Stan tabeli dla każdego wariantu ekranu — `DataTableStatus`, nie własny typ. */
const STATUS: Record<AdminDashboardState, DataTableStatus> = {
  wczytuje: 'pending',
  zawartosc: 'success',
  // Pusta lista to wciąż udana odpowiedź API, nie błąd.
  pusty: 'success',
  blad: 'error',
}

/**
 * Lista turniejów organizera: ten sam ekran, który w panelu stoi pod `/`
 * (`apps/admin/src/pages/tournaments.tsx`).
 *
 * Ekran zostaje listą, a nie dashboardem z licznikami i kaflami: kafle nie mają
 * z czego liczyć „Meczów (30 dni)" ani „Odsłon public", a tabela niesie
 * wszystkie turnieje, nie pierwsze trzy. Źródłem prawdy jest `TournamentsTable`,
 * ta sama tabela, której używa panel — ekran dokłada wyłącznie shell i dane demo.
 */
export function AdminDashboard({ state = 'zawartosc' }: AdminDashboardProps) {
  const loaded = state === 'zawartosc'

  return (
    <ShellDemo
      active="dashboard"
      title="Twoje turnieje"
      subtitle="Zarządzaj ligami i turniejami"
      // Przycisk pojawia się dopiero przy niepustej liście, tak jak w panelu:
      // przy pustej prowadzi do kreatora stan pusty w tabeli (#28).
      actions={
        loaded ? (
          <Button>
            <Plus className="size-4" /> Nowy turniej
          </Button>
        ) : undefined
      }
    >
      <TournamentsTable
        status={STATUS[state]}
        tournaments={loaded ? tournamentList : []}
        total={loaded ? tournamentList.length : undefined}
        errorMessage={state === 'blad' ? 'Nie udało się pobrać turniejów.' : undefined}
        // Wejście w turniej, ponowienie i założenie turnieju są w panelu akcją.
        // Tutaj zostają nieaktywne: ekran pokazuje tę samą tabelę, nie te same
        // skutki kliknięcia.
        onOpen={() => {}}
        onRetry={() => {}}
        onCreate={() => {}}
      />
    </ShellDemo>
  )
}
