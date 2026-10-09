import type { Player, Team } from '@tournament/api-client';
import {
  Button,
  EmptyState,
  Heading,
  PlayersTable,
  Skeleton,
  TeamLogo,
  type PlayerRow,
} from '@tournament/ui';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { PlayerDeleteDialog, PlayerFormDialog } from '../components/player-dialogs';
import { TeamDeleteDialog, TeamNameDialog } from '../components/team-dialogs';
import { isNotFound } from '../lib/api-error';
import { parseRouteId } from '../lib/route-id';
import { usePlayers, useTeam } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

/** Otwarte okno ekranu; jedno naraz, więc jeden stan zamiast flagi na każde. */
type Dialog =
  | { kind: 'rename' }
  | { kind: 'delete-team' }
  | { kind: 'player'; player?: PlayerRow }
  | { kind: 'delete-player'; player: PlayerRow };

/**
 * Skład drużyny, `/tournaments/:id/teams/:teamId` (#89 pkt 3). Ekran stoi
 * w karcie „Drużyny”: tytuł to nazwa turnieju, a drużynę pokazuje jej własny
 * nagłówek pod kartami, razem z jej akcjami (pkt 4). Herb dochodzi w #114.
 */
export function TeamPage() {
  const tournament = useTournament();
  const navigate = useNavigate();
  const teamId = parseRouteId(useParams().teamId);
  const team = useTeam(teamId);
  const players = usePlayers(teamId);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const listPath = `/tournaments/${tournament.id}/teams`;
  const close = useCallback(() => setDialog(null), []);

  // Stabilne między renderami: `PlayersTable` memoizuje kolumny po obu funkcjach.
  const editPlayer = useCallback((player: PlayerRow) => setDialog({ kind: 'player', player }), []);
  const deletePlayer = useCallback(
    (player: PlayerRow) => setDialog({ kind: 'delete-player', player }),
    [],
  );

  // Drużyna z innego turnieju to adres sklejony ręcznie albo nieaktualny. Panel
  // nie pokazuje jej pod cudzym turniejem, tylko tak jak 403 i 404.
  const notFound =
    teamId === null ||
    isNotFound(team.error) ||
    (team.data !== undefined && team.data.tournamentId !== tournament.id);

  let content;
  if (notFound) {
    content = (
      <EmptyState
        title="Nie ma takiej drużyny"
        description="Mogła zostać usunięta albo należy do innego turnieju."
        action={
          <Button asChild>
            <Link to={listPath}>Wróć do listy drużyn</Link>
          </Button>
        }
      />
    );
  } else if (team.data) {
    content = (
      <Squad
        team={team.data}
        players={players.data ?? []}
        playersStatus={players.status}
        playersError={players.error?.message}
        onRetryPlayers={() => void players.refetch()}
        onRename={() => setDialog({ kind: 'rename' })}
        onDelete={() => setDialog({ kind: 'delete-team' })}
        onCreatePlayer={() => setDialog({ kind: 'player' })}
        onEditPlayer={editPlayer}
        onDeletePlayer={deletePlayer}
      />
    );
  } else if (team.isError) {
    content = (
      <EmptyState
        variant="error"
        title="Nie udało się wczytać drużyny"
        description={team.error.message}
        action={
          <Button variant="outline" onClick={() => void team.refetch()}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  } else {
    content = (
      <div aria-busy="true" aria-label="Wczytywanie drużyny" className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-6 w-60" />
      </div>
    );
  }

  return (
    <AdminPage tournament={tournament} section="teams">
      <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Drużyny
      </Link>
      <div className="mt-4">{content}</div>

      {team.data && teamId !== null && (
        <>
          {dialog?.kind === 'rename' && (
            <TeamNameDialog tournamentId={tournament.id} team={team.data} onClose={close} />
          )}
          {dialog?.kind === 'delete-team' && (
            <TeamDeleteDialog
              tournamentId={tournament.id}
              team={team.data}
              onClose={close}
              onDeleted={() => void navigate(listPath)}
            />
          )}
          {dialog?.kind === 'player' && (
            <PlayerFormDialog
              tournamentId={tournament.id}
              teamId={teamId}
              player={dialog.player}
              onClose={close}
            />
          )}
          {dialog?.kind === 'delete-player' && (
            <PlayerDeleteDialog
              tournamentId={tournament.id}
              teamId={teamId}
              player={dialog.player}
              onClose={close}
            />
          )}
        </>
      )}
    </AdminPage>
  );
}

type SquadProps = {
  team: Team;
  players: Player[];
  playersStatus: 'pending' | 'error' | 'success';
  playersError?: string;
  onRetryPlayers: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreatePlayer: () => void;
  onEditPlayer: (player: PlayerRow) => void;
  onDeletePlayer: (player: PlayerRow) => void;
};

/** Nagłówek drużyny z jej akcjami i skład, jak w makiecie „Admin · Skład drużyny”. */
function Squad({
  team,
  players,
  playersStatus,
  playersError,
  onRetryPlayers,
  onRename,
  onDelete,
  onCreatePlayer,
  onEditPlayer,
  onDeletePlayer,
}: SquadProps) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-12" />
          <Heading level="section" className="truncate">
            {team.name}
          </Heading>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={onRename}>
            <Pencil className="size-4" /> Zmień nazwę
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Usuń drużynę
          </Button>
        </div>
      </div>

      {/* Przy pustym składzie akcję niesie pusty stan tabeli: dwa przyciski
          „Dodaj zawodnika” jeden pod drugim mówiłyby to samo dwa razy. */}
      <div className="mt-6 mb-3 flex min-h-8 justify-end">
        {playersStatus === 'success' && players.length > 0 && (
          <Button onClick={onCreatePlayer}>
            <Plus className="size-4" /> Dodaj zawodnika
          </Button>
        )}
      </div>
      <PlayersTable
        players={players}
        status={playersStatus}
        errorMessage={playersError}
        onRetry={onRetryPlayers}
        onCreate={onCreatePlayer}
        onEdit={onEditPlayer}
        onDelete={onDeletePlayer}
      />
    </>
  );
}
