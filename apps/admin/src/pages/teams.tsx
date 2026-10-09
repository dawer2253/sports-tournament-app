import { Button, TeamsTable, type TeamRow } from '@tournament/ui';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { TeamNameDialog } from '../components/team-dialogs';
import { useTeams } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

/**
 * Lista drużyn turnieju, `/tournaments/:id/teams` (#89 pkt 1). Wiersz jest
 * wyłącznie linkiem do składu: akcje drużyny stoją w nagłówku ekranu składu.
 */
export function TeamsPage() {
  const tournament = useTournament();
  const navigate = useNavigate();
  const teams = useTeams(tournament.id);
  const [creating, setCreating] = useState(false);

  // Stabilne między renderami: `TeamsTable` memoizuje kolumny po obu funkcjach.
  const teamHref = useCallback(
    (team: TeamRow) => `/tournaments/${tournament.id}/teams/${team.id}`,
    [tournament.id],
  );
  const openTeam = useCallback(
    (team: TeamRow) => void navigate(teamHref(team)),
    [navigate, teamHref],
  );

  const rows = teams.data ?? [];

  return (
    <AdminPage
      tournament={tournament}
      section="teams"
      // Jak „Nowy turniej” (#28): przy pustej liście akcję niesie pusty stan,
      // a przy wczytywaniu i błędzie liczy się ponowienie.
      actions={
        teams.status === 'success' && rows.length > 0 ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Dodaj drużynę
          </Button>
        ) : undefined
      }
    >
      <TeamsTable
        teams={rows}
        status={teams.status}
        errorMessage={teams.error?.message}
        onRetry={() => void teams.refetch()}
        onCreate={() => setCreating(true)}
        teamHref={teamHref}
        onOpenTeam={openTeam}
      />
      {creating && (
        <TeamNameDialog tournamentId={tournament.id} onClose={() => setCreating(false)} />
      )}
    </AdminPage>
  );
}
