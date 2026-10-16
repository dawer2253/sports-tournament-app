import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { Tournament, Venue } from '@tournament/api-client';
import {
  Button,
  ConfirmDeleteDialog,
  FormDialog,
  Input,
  Label,
  VenuesTable,
  type VenueRow,
} from '@tournament/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { SectionActions } from '../components/section-actions';
import { api } from '../lib/api';
import { plural, SCHEDULED_MATCHES } from '../lib/plural';
import { useListMutation, type ListTexts } from '../lib/use-list-mutation';
import {
  venueSchema,
  venueValues,
  type VenueFormValues,
  type VenueValues,
} from '../lib/venue-schema';
import { useTournament } from './tournament-layout';

const VENUE_TEXTS: ListTexts = {
  accusative: 'obiekt',
  alreadyDeleted: 'Obiekt został już usunięty.',
  gone: 'Tego obiektu już nie ma.',
};

/** Pola, przy których formularz umie posadzić `422`; reszta (limit pod `venues`) idzie w `root`. */
const VENUE_FIELDS = ['name', 'address'] as const;

function venuesKey(tournamentId: number) {
  return ['tournament', tournamentId, 'venues'] as const;
}

/**
 * Otwarte okno: formularz (`venue: null` to dodawanie) albo potwierdzenie
 * usunięcia. Potwierdzenie trzyma cały `Venue`, bo mówi o liczbie meczów,
 * której wiersz tabeli (`VenueRow`) nie niesie.
 */
type OpenDialog =
  | { kind: 'form'; venue: VenueRow | null }
  | { kind: 'delete'; venue: Venue }
  | null;

/**
 * Obiekty turnieju (#116, decyzje w #90): lista z `VenuesTable`, dodawanie
 * i edycja w `FormDialog`, usuwanie w `ConfirmDeleteDialog`. Zapis idzie przez
 * `useListMutation` — wzorzec opisuje `apps/admin/AGENTS.md`, „Edycja list”.
 *
 * Usunięcia panel nie blokuje z wyprzedzeniem: `scheduledMatchesCount` liczy
 * tylko mecze zaplanowane, więc o rozegranych i trwających mówi dopiero `422`
 * z guarda serwera.
 */
export function TournamentVenuesPage() {
  const tournament = useTournament();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const venues = useQuery({
    queryKey: venuesKey(tournament.id),
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}/venues', {
        params: { path: { tournament: tournament.id } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });

  // Przycisk w nagłówku tylko przy wczytanej, niepustej liście, jak w makiecie
  // z #115: pustą listę niesie pusty stan, a przy błędzie liczy się ponowienie.
  const showCreate = venues.isSuccess && venues.data.length > 0;
  const close = () => setDialog(null);

  return (
    <>
      <SectionActions>
        {showCreate && (
          <Button onClick={() => setDialog({ kind: 'form', venue: null })}>
            <Plus className="size-4" /> Dodaj obiekt
          </Button>
        )}
      </SectionActions>
      <VenuesTable
        venues={venues.data ?? []}
        status={venues.status}
        errorMessage={venues.error?.message}
        onRetry={() => void venues.refetch()}
        onCreate={() => setDialog({ kind: 'form', venue: null })}
        // Formularzowi wystarcza `VenueRow` (id, nazwa, adres). Usuwanie mówi
        // o liczbie meczów, więc bierze z listy cały `Venue`.
        onEdit={(venue) => setDialog({ kind: 'form', venue })}
        onDelete={(row) => {
          const venue = venues.data?.find((candidate) => candidate.id === row.id);
          if (venue) setDialog({ kind: 'delete', venue });
        }}
      />

      {/* Okna renderowane warunkowo: stan hooka (błąd, blokada) żyje tyle co okno. */}
      {dialog?.kind === 'form' && (
        <VenueFormDialog tournament={tournament} venue={dialog.venue} onClose={close} />
      )}
      {dialog?.kind === 'delete' && (
        <VenueDeleteDialog tournament={tournament} venue={dialog.venue} onClose={close} />
      )}
    </>
  );
}

type DialogProps = { tournament: Tournament; onClose: () => void };

function VenueFormDialog({ tournament, venue, onClose }: DialogProps & { venue: VenueRow | null }) {
  const form = useForm<VenueFormValues, unknown, VenueValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: venueValues(venue),
  });
  const mutation = useListMutation({
    texts: VENUE_TEXTS,
    invalidate: [venuesKey(tournament.id)],
    onDone: onClose,
    form: { fields: VENUE_FIELDS, setError: form.setError },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((body) =>
    venue
      ? mutation.update({
          name: body.name,
          request: () =>
            api.PATCH('/venues/{venue}', { params: { path: { venue: venue.id } }, body }),
        })
      : mutation.create({
          name: body.name,
          request: () =>
            api.POST('/tournaments/{tournament}/venues', {
              params: { path: { tournament: tournament.id } },
              body,
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
      title={venue ? 'Edytuj obiekt' : 'Nowy obiekt'}
      submitLabel={venue ? 'Zapisz' : 'Dodaj'}
      pending={mutation.pending}
      error={errors.root?.message}
    >
      <div className="grid gap-2">
        <Label htmlFor="venue-name">Nazwa</Label>
        <Input
          id="venue-name"
          autoFocus
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'venue-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="venue-name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="venue-address">Adres</Label>
        <Input
          id="venue-address"
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={errors.address ? 'venue-address-error' : undefined}
          {...form.register('address')}
        />
        {errors.address && (
          <p id="venue-address-error" className="text-sm text-destructive">
            {errors.address.message}
          </p>
        )}
      </div>
    </FormDialog>
  );
}

/**
 * Mecze `scheduled` obiektu zostają po usunięciu bez obiektu (#171), więc
 * okno o nich uprzedza. Przy zerze nie ma opisu, jak przed #171.
 */
function venueDeleteDescription({ scheduledMatchesCount: count }: Venue) {
  if (count === 0) return undefined;
  const matches = plural(count, SCHEDULED_MATCHES);
  const verb = plural(count, ['straci', 'stracą', 'straci']);
  const dates = count === 1 ? 'Data meczu się nie zmieni.' : 'Daty meczów się nie zmienią.';
  return `${count} ${matches} ${verb} obiekt. ${dates}`;
}

function VenueDeleteDialog({ tournament, venue, onClose }: DialogProps & { venue: Venue }) {
  const mutation = useListMutation({
    texts: VENUE_TEXTS,
    invalidate: [venuesKey(tournament.id)],
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
          name: venue.name,
          request: () => api.DELETE('/venues/{venue}', { params: { path: { venue: venue.id } } }),
        })
      }
      entity={VENUE_TEXTS.accusative}
      name={venue.name}
      description={venueDeleteDescription(venue)}
      pending={mutation.pending}
      {...mutation.removeError}
    />
  );
}
