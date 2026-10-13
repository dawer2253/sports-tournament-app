import { zodResolver } from '@hookform/resolvers/zod';
import type { Team } from '@tournament/api-client';
import { ConfirmDeleteDialog, FormDialog, ImageFileField, TeamLogo } from '@tournament/ui';
import { Controller, useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { LOGO_FILE_HINT, logoFileError, logoFormData, TEAM_LOGO } from '../lib/logo-file';
import { plural, SCHEDULED_MATCHES } from '../lib/plural';
import { hasStartedMatches } from '../lib/schedule';
import { useStageMatches, useStages } from '../lib/schedule-queries';
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

/**
 * Co stanie się z drabinką, gdy drużyna w niej stoi (#215): przed startem
 * zniknie cała, a po starcie usunięcie odmówi serwer (`422`, okno pokaże
 * powód). `none`, gdy drużyna nie stoi w żadnej drabince.
 */
type BracketImpact = 'none' | 'deleted' | 'blocked';

/**
 * Drabinka fazy pucharowej z drużyną. Fazy i mecze bierze z tych samych
 * zapytań co karta Drabinka, więc po wejściu z niej nic nie idzie drugi raz.
 */
function useBracketImpact(tournamentId: number, team: Team): BracketImpact {
  const stages = useStages(tournamentId);
  const cup = stages.data?.find((stage) => stage.type === 'knockout');
  const matches = useStageMatches(tournamentId, cup?.id);
  const inBracket = (matches.data ?? []).some(
    (match) => match.homeTeam?.id === team.id || match.awayTeam?.id === team.id,
  );
  if (!inBracket) return 'none';
  return hasStartedMatches(matches.data ?? []) ? 'blocked' : 'deleted';
}

/**
 * Co jeszcze zniknie razem z drużyną: zawodnicy i jej mecze `scheduled`
 * (#171). Zdanie o meczach dopowiada, że reszta terminarza zostaje. Przy
 * zerach okno nie ma opisu. W pucharze zamiast liczby meczów stoi zdanie
 * o drabince (#227), a po starcie żadne, bo usunięcia i tak nie będzie.
 */
function teamDeleteDescription({ playersCount, scheduledMatchesCount }: Team, bracket: BracketImpact) {
  const sentences = [];
  if (playersCount > 0) sentences.push(`Usunie też ${playersAccusative(playersCount)}.`);
  if (bracket === 'deleted') {
    sentences.push('Drabinka pucharu zostanie skasowana razem z terminami — trzeba będzie wygenerować ją ponownie.');
  } else if (bracket === 'none' && scheduledMatchesCount > 0) {
    sentences.push(
      `Usunie też ${scheduledMatchesCount} ${plural(scheduledMatchesCount, SCHEDULED_MATCHES)} drużyny.`,
      'Pozostałe mecze zostają bez zmian, z tymi samymi datami.',
    );
  }
  return sentences.length > 0 ? sentences.join(' ') : undefined;
}

type TeamDeleteDialogProps = {
  tournamentId: number;
  team: Team;
  onClose: () => void;
  /** Po usunięciu, także po `404`: ekran składu wraca wtedy na listę drużyn. */
  onDeleted: () => void;
};

export function TeamDeleteDialog({ tournamentId, team, onClose, onDeleted }: TeamDeleteDialogProps) {
  const bracket = useBracketImpact(tournamentId, team);
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
      description={teamDeleteDescription(team, bracket)}
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
          bodySerializer: logoFormData,
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
