import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type Stage, type Tournament } from '@tournament/api-client';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  GroupCompositionEditor,
  Heading,
  Skeleton,
  toast,
  type GroupCompositionGroup,
} from '@tournament/ui';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';
import { scheduleKeys, useStageMatches, useStages } from '../lib/schedule-queries';
import { hasStartedMatches } from '../lib/schedule';
import { teamKeys, useTeams } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

const SAVE_FAILED = 'Nie udało się zapisać składu grup. Spróbuj ponownie.';

/** Szkic na start, gdy faza nie ma jeszcze składu: dwie grupy (albo jedna przy dwóch drużynach). */
function firstDraft(teamsCount: number): GroupCompositionGroup[] {
  const count = Math.max(1, Math.min(2, Math.floor(teamsCount / 2)));
  return Array.from({ length: count }, (_, index) => ({
    name: `Grupa ${'ABCDEFGH'[index]}`,
    qualifiers: 2,
    teamIds: [],
  }));
}

/**
 * Błąd zapisu nad przyciskami. `422` niesie powód pod `groups`, `groups.N.…`
 * albo `stage`; reszta i padnięta sieć dostają komunikat ogólny, bo tekst
 * przeglądarki byłby po angielsku.
 */
function saveErrorMessage(error: unknown): string {
  if (isValidationError(error)) return Object.values(firstFieldErrors(error)).join(' ') || error.message;
  return SAVE_FAILED;
}

/**
 * Karta Grupy (#258): skład fazy grupowej zastępuje się w całości przez
 * `PUT /stages/{stage}/groups`. Zapis unieważnia fazy, mecze i drużyny
 * (`group_id`), bo wszystkie trzy się zmieniają. Odmowy (`422`) siadają
 * w edytorze nad przyciskami, a odmowa niczego nie zmienia.
 */
export function TournamentGroupsPage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const groupStage = stages.data?.find((stage) => stage.type === 'group');

  return (
    <AdminPage tournament={tournament} section="groups">
      <GroupsSection tournament={tournament} stage={groupStage} stagesFailed={stages.isError} stagesPending={stages.isPending} />
    </AdminPage>
  );
}

function GroupsSection({
  tournament,
  stage,
  stagesFailed,
  stagesPending,
}: {
  tournament: Tournament;
  stage: Stage | undefined;
  stagesFailed: boolean;
  stagesPending: boolean;
}) {
  const teams = useTeams(tournament.id);
  const matches = useStageMatches(tournament.id, stage?.id);

  if (stagesFailed) {
    return <EmptyState variant="error" title="Nie udało się wczytać faz turnieju" />;
  }
  if (stagesPending) {
    return <Skeleton role="status" aria-label="Wczytywanie składu grup" className="h-64 w-full" />;
  }
  if (!stage) {
    return (
      <EmptyState
        icon={<Users />}
        title="Ten turniej nie ma fazy grupowej"
        description="Skład grup ustala się tylko w turnieju z fazą grupową."
      />
    );
  }
  if (teams.isError || matches.isError) {
    return <EmptyState variant="error" title="Nie udało się wczytać danych fazy grupowej" />;
  }
  if (!teams.data || !matches.data) {
    return <Skeleton role="status" aria-label="Wczytywanie składu grup" className="h-64 w-full" />;
  }
  if (teams.data.length < 2) {
    return (
      <EmptyState
        icon={<Users />}
        title="Faza grupowa potrzebuje co najmniej dwóch drużyn"
        description="Dodaj drużyny, a potem ustal skład grup."
        action={
          <Button asChild>
            <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
          </Button>
        }
      />
    );
  }

  return <CompositionEditor tournament={tournament} stage={stage} teams={teams.data} started={hasStartedMatches(matches.data)} scheduledMatches={matches.data.length} />;
}

function CompositionEditor({
  tournament,
  stage,
  teams,
  started,
  scheduledMatches,
}: {
  tournament: Tournament;
  stage: Stage;
  teams: { id: number; name: string; groupId: number | null }[];
  started: boolean;
  scheduledMatches: number;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GroupCompositionGroup[] | null>(null);

  const saved: GroupCompositionGroup[] = stage.groups.map((group) => ({
    name: group.name,
    qualifiers: group.qualifiers,
    teamIds: teams.filter((team) => team.groupId === group.id).map((team) => team.id),
  }));
  const current = draft ?? (saved.length > 0 ? saved : firstDraft(teams.length));

  const save = useMutation({
    mutationFn: async (groups: GroupCompositionGroup[]) => {
      let result;
      try {
        result = await api.PUT('/stages/{stage}/groups', {
          params: { path: { stage: stage.id } },
          body: { groups },
        });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`. Inny wyjątek to
        // błąd w kodzie i ma polecieć dalej, a nie udawać padniętej sieci.
        if (cause instanceof TypeError) throw new Error(SAVE_FAILED);
        throw cause;
      }
      const { data, error, response } = result;
      if (data) return data.data;
      throw response.status === 422 && isValidationError(error) ? error : new Error(SAVE_FAILED);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.stages(tournament.id) }),
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournament.id) }),
        queryClient.invalidateQueries({ queryKey: teamKeys.list(tournament.id) }),
      ]);
      setDraft(null);
      toast.success('Zapisano skład grup.');
    },
  });

  return (
    <div className="grid gap-4">
      <div>
        <Heading level="card">Skład grup</Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          Skład zastępuje się w całości: każda drużyna turnieju dokładnie raz, co najmniej dwie drużyny w grupie.
          Zapis skasuje terminarz grup.
        </p>
      </div>
      <Card>
        <CardContent>
          <GroupCompositionEditor
            teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            value={current}
            onChange={setDraft}
            onSave={() => save.mutate(current)}
            saving={save.isPending}
            error={save.isError ? saveErrorMessage(save.error) : undefined}
            frozen={started}
            scheduledMatchesCount={scheduledMatches}
          />
        </CardContent>
      </Card>
    </div>
  );
}
