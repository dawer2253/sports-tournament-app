import { Plus } from 'lucide-react'
import { TournamentShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import { TeamsTable, type TeamsTableStatus } from '../components/data/teams-table'
import type { TeamRow } from '../components/data/team-row'
import { teamRows } from '../lib/demo-data'

export interface AdminTeamsProps {
  teams?: TeamRow[]
  status?: TeamsTableStatus
}

/**
 * Lista drużyn turnieju (#89 pkt 1). Wiersz jest wyłącznie linkiem do składu:
 * akcje drużyny stoją w nagłówku drużyny na ekranie składu (pkt 4).
 */
export function AdminTeams({ teams = teamRows, status = 'success' }: AdminTeamsProps) {
  // Przy pustej liście akcję niesie pusty stan tabeli: dwa „Dodaj drużynę"
  // naraz mówiłyby to samo dwa razy.
  const isEmpty = status === 'success' && teams.length === 0
  return (
    <TournamentShellDemo
      active="teams"
      actions={
        !isEmpty && (
          <Button>
            <Plus className="size-4" /> Dodaj drużynę
          </Button>
        )
      }
    >
      <TeamsTable
        teams={teams}
        status={status}
        errorMessage="Sprawdź połączenie i spróbuj ponownie."
        onRetry={() => {}}
        onCreate={() => {}}
        // Adres w hashu: kliknięcie w makiecie nie wyprowadza ramki Storybooka
        // na nieistniejącą stronę.
        teamHref={(team) => `#/tournaments/1/teams/${team.id}`}
      />
    </TournamentShellDemo>
  )
}
