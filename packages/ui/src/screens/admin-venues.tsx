import { Plus } from 'lucide-react'
import { TournamentShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import { VenuesTable, type VenuesTableStatus } from '../components/data/venues-table'
import type { VenueRow } from '../components/data/venue-row'
import { venueRows } from '../lib/demo-data'

export interface AdminVenuesProps {
  venues?: VenueRow[]
  status?: VenuesTableStatus
}

/** Lista obiektów turnieju (#90): nazwa i adres, bez liczby meczów. */
export function AdminVenues({ venues = venueRows, status = 'success' }: AdminVenuesProps) {
  // Przycisk w nagłówku tylko przy wczytanej, niepustej liście, jak „Nowy
  // turniej" w panelu (#28) i lista drużyn. Przy pustej liście akcję niesie
  // pusty stan, a przy błędzie i wczytywaniu liczy się ponowienie, nie
  // dodawanie kolejnego obiektu.
  const showCreate = status === 'success' && venues.length > 0
  return (
    <TournamentShellDemo
      active="venues"
      actions={
        showCreate && (
          <Button>
            <Plus className="size-4" /> Dodaj obiekt
          </Button>
        )
      }
    >
      <VenuesTable
        venues={venues}
        status={status}
        errorMessage="Sprawdź połączenie i spróbuj ponownie."
        onRetry={() => {}}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </TournamentShellDemo>
  )
}
