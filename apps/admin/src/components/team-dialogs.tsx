import { zodResolver } from '@hookform/resolvers/zod';
import type { Team } from '@tournament/api-client';
import { ConfirmDeleteDialog, FormDialog } from '@tournament/ui';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { TEAM_TEXTS, teamKeys } from '../lib/team-queries';
import { teamSchema, type TeamValues } from '../lib/team-schema';
import { useListMutation } from '../lib/use-list-mutation';
import { TextField } from './text-field';

type TeamNameDialogProps = {
  tournamentId: number;
  /** Drużyna do zmiany nazwy; bez niej okno dodaje nową. */
  team?: Team;
  onClose: () => void;
};

/**
 * Okno nazwy drużyny: „Dodaj drużynę” na liście i „Zmień nazwę” na ekranie
 * składu. Jedno pole, więc jedno okno na oba przypadki.
 */
export function TeamNameDialog({ tournamentId, team, onClose }: TeamNameDialogProps) {
  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: team?.name ?? '' },
  });
  const mutation = useListMutation({
    texts: TEAM_TEXTS,
    // Nowa drużyna zmienia `teamsCount` turnieju, a nowa nazwa — drużynę i listę.
    invalidate: team
      ? [teamKeys.team(team.id), teamKeys.list(tournamentId)]
      : [teamKeys.list(tournamentId), teamKeys.tournament(tournamentId)],
    onDone: onClose,
    form: { fields: ['name'], setError: form.setError },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(({ name }) =>
    team
      ? mutation.update({
          name,
          request: () =>
            api.PATCH('/teams/{team}', { params: { path: { team: team.id } }, body: { name } }),
        })
      : mutation.create({
          name,
          request: () =>
            api.POST('/tournaments/{tournament}/teams', {
              params: { path: { tournament: tournamentId } },
              body: { name },
            }),
        }),
  );

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title={team ? 'Zmień nazwę drużyny' : 'Nowa drużyna'}
      submitLabel={team ? 'Zapisz' : 'Dodaj'}
      pending={mutation.pending}
      error={errors.root?.message}
    >
      <TextField
        label="Nazwa drużyny"
        autoComplete="off"
        error={errors.name?.message}
        {...form.register('name')}
      />
    </FormDialog>
  );
}

/** Biernik liczby zawodników: „1 zawodnika”, ale „2 zawodników” i „12 zawodników”. */
function playersAccusative(count: number) {
  return `${count} ${count === 1 ? 'zawodnika' : 'zawodników'}`;
}

type TeamDeleteDialogProps = {
  tournamentId: number;
  team: Team;
  onClose: () => void;
  /** Po usunięciu, także po `404`: ekran składu wraca wtedy na listę drużyn. */
  onDeleted: () => void;
};

export function TeamDeleteDialog({ tournamentId, team, onClose, onDeleted }: TeamDeleteDialogProps) {
  const mutation = useListMutation({
    texts: TEAM_TEXTS,
    // Bez kluczy usuniętej drużyny i jej składu — powód przy `teamKeys`.
    invalidate: [teamKeys.list(tournamentId), teamKeys.tournament(tournamentId)],
    onDone: onDeleted,
  });

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() =>
        void mutation.remove({
          name: team.name,
          request: () => api.DELETE('/teams/{team}', { params: { path: { team: team.id } } }),
        })
      }
      entity={TEAM_TEXTS.accusative}
      name={team.name}
      description={
        team.playersCount > 0 ? `Usunie też ${playersAccusative(team.playersCount)}.` : undefined
      }
      pending={mutation.pending}
      {...mutation.removeError}
    />
  );
}
