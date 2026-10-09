import { zodResolver } from '@hookform/resolvers/zod';
import type { Team } from '@tournament/api-client';
import { ConfirmDeleteDialog, FormDialog, ImageFileField, TeamLogo } from '@tournament/ui';
import { Controller, useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { LOGO_FILE_HINT, logoFileError, TEAM_LOGO } from '../lib/logo-file';
import { TEAM_LOGO_TEXTS, TEAM_TEXTS, teamKeys } from '../lib/team-queries';
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

type TeamLogoDialogProps = {
  tournamentId: number;
  team: Team;
  onClose: () => void;
};

/**
 * „Wgraj herb” / „Zmień herb” na ekranie składu (#114). Wybór pliku niczego
 * nie wysyła; `POST` idzie po „Zapisz” i po walidacji klienta
 * (`logoFileError`), więc GIF czy plik 3 MB nie robią żądania. Wymiary
 * sprawdza tylko serwer, a jego `422` pod `logo` siada przy polu.
 *
 * Herb zmienia drużynę i jej wiersz na liście, więc unieważniamy oba, jak
 * przy zmianie nazwy. Odpowiedzi do cache'u nie kładziemy: odświeżona drużyna
 * i tak przychodzi, zanim okno się zamknie (`useListMutation`).
 */
export function TeamLogoDialog({ tournamentId, team, onClose }: TeamLogoDialogProps) {
  const form = useForm<{ logo: File | null }>({ defaultValues: { logo: null } });
  const mutation = useListMutation({
    texts: TEAM_LOGO_TEXTS,
    invalidate: [teamKeys.team(team.id), teamKeys.list(tournamentId)],
    onDone: onClose,
    form: { fields: ['logo'], setError: form.setError },
  });
  const title = team.logoUrl ? 'Zmień herb' : 'Wgraj herb';

  const submit = form.handleSubmit(({ logo }) => {
    // `validate` w `Controller` przepuszcza tylko plik.
    if (!logo) return;
    return mutation.update({
      name: team.name,
      request: () =>
        api.POST('/teams/{team}/logo', {
          params: { path: { team: team.id } },
          body: { logo },
          // `FormData` bez ręcznego `Content-Type`: granicę dokłada przeglądarka.
          bodySerializer: (body) => {
            const data = new FormData();
            data.append('logo', body.logo);
            return data;
          },
        }),
    });
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title={title}
      submitLabel="Zapisz"
      pending={mutation.pending}
      error={form.formState.errors.root?.message}
    >
      <Controller
        control={form.control}
        name="logo"
        rules={{ validate: (file) => logoFileError(file, TEAM_LOGO) ?? true }}
        render={({ field, fieldState }) => (
          <ImageFileField
            label="Plik z herbem"
            value={field.value}
            onChange={field.onChange}
            currentUrl={team.logoUrl}
            hint={LOGO_FILE_HINT}
            error={fieldState.error?.message}
            fallback={<TeamLogo logoUrl={null} name={team.name} className="size-full" />}
            disabled={mutation.pending}
          />
        )}
      />
    </FormDialog>
  );
}

/**
 * „Usuń herb”, widoczny tylko przy wgranym herbie. Usuwanie jest idempotentne,
 * więc `404` znaczy, że zniknęła cała drużyna — mówi o tym `TEAM_LOGO_TEXTS`.
 */
export function TeamLogoDeleteDialog({ tournamentId, team, onClose }: TeamLogoDialogProps) {
  const mutation = useListMutation({
    texts: TEAM_LOGO_TEXTS,
    invalidate: [teamKeys.team(team.id), teamKeys.list(tournamentId)],
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
          name: team.name,
          request: () => api.DELETE('/teams/{team}/logo', { params: { path: { team: team.id } } }),
        })
      }
      entity={TEAM_LOGO_TEXTS.accusative}
      name={team.name}
      description="Plik zostanie skasowany, a w jego miejsce wejdzie herb zastępczy."
      pending={mutation.pending}
      {...mutation.removeError}
    />
  );
}
