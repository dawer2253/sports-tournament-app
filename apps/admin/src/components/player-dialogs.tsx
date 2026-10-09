import { zodResolver } from '@hookform/resolvers/zod';
import { ConfirmDeleteDialog, FormDialog, type PlayerRow } from '@tournament/ui';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { playerSchema, type PlayerFormValues, type PlayerValues } from '../lib/player-schema';
import { PLAYER_TEXTS, teamKeys } from '../lib/team-queries';
import { useListMutation } from '../lib/use-list-mutation';
import { TextField } from './text-field';

type PlayerDialogProps = {
  tournamentId: number;
  teamId: number;
  onClose: () => void;
};

/**
 * Zmiana składu zmienia `playersCount`, a ten widać w drużynie (zdanie
 * o kaskadzie przy jej usuwaniu) i na liście drużyn.
 */
function playerChangeKeys(tournamentId: number, teamId: number) {
  return [teamKeys.players(teamId), teamKeys.team(teamId), teamKeys.list(tournamentId)];
}

/** Okno jednego zawodnika: dodanie albo, z `player`, edycja (#89 pkt 7). */
export function PlayerFormDialog({
  tournamentId,
  teamId,
  player,
  onClose,
}: PlayerDialogProps & { player?: PlayerRow }) {
  const form = useForm<PlayerFormValues, unknown, PlayerValues>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: player?.name ?? '',
      number: player?.number?.toString() ?? '',
      position: player?.position ?? '',
    },
  });
  const mutation = useListMutation({
    texts: PLAYER_TEXTS,
    invalidate: playerChangeKeys(tournamentId, teamId),
    onDone: onClose,
    // Limit składu przychodzi pod `players`, którego formularz nie zna, więc
    // hook sadza go nad formularzem.
    form: { fields: ['name', 'number', 'position'], setError: form.setError },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((body) =>
    player
      ? mutation.update({
          name: body.name,
          request: () =>
            api.PATCH('/players/{player}', { params: { path: { player: player.id } }, body }),
        })
      : mutation.create({
          name: body.name,
          request: () =>
            api.POST('/teams/{team}/players', { params: { path: { team: teamId } }, body }),
        }),
  );

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title={player ? 'Edytuj zawodnika' : 'Nowy zawodnik'}
      submitLabel={player ? 'Zapisz' : 'Dodaj'}
      pending={mutation.pending}
      error={errors.root?.message}
    >
      <TextField
        label="Imię i nazwisko"
        autoComplete="off"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <TextField
        label="Numer"
        inputMode="numeric"
        autoComplete="off"
        error={errors.number?.message}
        {...form.register('number')}
      />
      <TextField
        label="Pozycja"
        autoComplete="off"
        error={errors.position?.message}
        {...form.register('position')}
      />
    </FormDialog>
  );
}

export function PlayerDeleteDialog({
  tournamentId,
  teamId,
  player,
  onClose,
}: PlayerDialogProps & { player: PlayerRow }) {
  const mutation = useListMutation({
    texts: PLAYER_TEXTS,
    invalidate: playerChangeKeys(tournamentId, teamId),
    onDone: onClose,
  });

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() =>
        void mutation.remove({
          name: player.name,
          request: () =>
            api.DELETE('/players/{player}', { params: { path: { player: player.id } } }),
        })
      }
      entity={PLAYER_TEXTS.accusative}
      name={player.name}
      pending={mutation.pending}
      {...mutation.removeError}
    />
  );
}
