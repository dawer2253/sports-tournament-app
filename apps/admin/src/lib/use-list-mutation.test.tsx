import { QueryClient, QueryClientProvider, useQuery, type QueryKey } from '@tanstack/react-query';
import type { Team, Venue } from '@tournament/api-client';
import { ConfirmDeleteDialog, FormDialog, Input, Label, Toaster } from '@tournament/ui';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { api } from './api';
import { useListMutation, type ListTexts } from './use-list-mutation';

const TOURNAMENT_ID = 1;
const VENUES_KEY = ['tournament', TOURNAMENT_ID, 'venues'];

const VENUE_TEXTS: ListTexts = {
  accusative: 'obiekt',
  alreadyDeleted: 'Obiekt został już usunięty.',
  gone: 'Tego obiektu już nie ma.',
};

const TEAM_TEXTS: ListTexts = {
  accusative: 'drużynę',
  alreadyDeleted: 'Drużyna została już usunięta.',
  gone: 'Tej drużyny już nie ma.',
};

const BEMOWO: Venue = { id: 1, tournamentId: TOURNAMENT_ID, name: 'Boisko Bemowo', address: null };
const URSUS: Venue = { id: 2, tournamentId: TOURNAMENT_ID, name: 'Hala Ursus', address: null };

/**
 * Lista obiektów „pod oknem”, tak jak na ekranie. Odpytuje msw naprawdę, więc
 * test widzi, czy unieważnienie ją odświeżyło, a nie tylko czy ktoś je zawołał.
 */
function VenueList() {
  const venues = useQuery({
    queryKey: VENUES_KEY,
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}/venues', {
        params: { path: { tournament: TOURNAMENT_ID } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });

  return (
    <ul data-testid="venues">
      {venues.data?.map((venue) => (
        <li key={venue.id}>{venue.name}</li>
      ))}
    </ul>
  );
}

type DialogProps = { onClose: () => void; invalidate: QueryKey[] };

/** Okno dodawania i edycji obiektu, złożone tak, jak złoży je ekran. */
function VenueFormDialog({ venue, onClose, invalidate }: DialogProps & { venue: Venue | null }) {
  const form = useForm<{ name: string }>({ defaultValues: { name: venue?.name ?? '' } });
  const mutation = useListMutation({
    texts: VENUE_TEXTS,
    invalidate,
    onDone: onClose,
    form: { fields: ['name'], setError: form.setError },
  });
  const nameError = form.formState.errors.name?.message;

  const submit = form.handleSubmit(({ name }) =>
    venue
      ? mutation.update({
          name,
          request: () =>
            api.PATCH('/venues/{venue}', { params: { path: { venue: venue.id } }, body: { name } }),
        })
      : mutation.create({
          name,
          request: () =>
            api.POST('/tournaments/{tournament}/venues', {
              params: { path: { tournament: TOURNAMENT_ID } },
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
      title={venue ? 'Edytuj obiekt' : 'Nowy obiekt'}
      submitLabel={venue ? 'Zapisz' : 'Dodaj'}
      pending={mutation.pending}
      error={form.formState.errors.root?.message}
    >
      <Label htmlFor="name">Nazwa</Label>
      <Input
        id="name"
        aria-invalid={nameError ? true : undefined}
        aria-describedby={nameError ? 'name-error' : undefined}
        {...form.register('name')}
      />
      {nameError && <p id="name-error">{nameError}</p>}
    </FormDialog>
  );
}

/** Okno potwierdzenia usunięcia obiektu, złożone tak, jak złoży je ekran. */
function VenueDeleteDialog({ venue, onClose, invalidate }: DialogProps & { venue: Venue }) {
  const mutation = useListMutation({ texts: VENUE_TEXTS, invalidate, onDone: onClose });

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
      pending={mutation.pending}
      {...mutation.removeError}
    />
  );
}

/** Ekran w miniaturze: lista, okno otwarte na starcie i `Toaster`, jak w `main.tsx`. */
function Screen({
  dialog,
  invalidate,
}: {
  dialog: (props: DialogProps) => ReactNode;
  invalidate: QueryKey[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <VenueList />
      {open && dialog({ onClose: () => setOpen(false), invalidate })}
      <Toaster />
    </>
  );
}

function renderScreen(
  dialog: (props: DialogProps) => ReactNode,
  { invalidate = [VENUES_KEY] }: { invalidate?: QueryKey[] } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <Screen dialog={dialog} invalidate={invalidate} />
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), invalidateQueries };
}

/**
 * Obiekty turnieju po stronie „serwera”. Zapis w handlerze zmienia tę tablicę,
 * więc odświeżona lista pokazuje stan po zapisie, a nieodświeżona — sprzed.
 *
 * Lista odpowiada z opóźnieniem celowo: przy natychmiastowej odpowiedzi okno
 * zamknięte przed odświeżeniem i tak zastałoby świeżą listę, więc test nie
 * odróżniłby jednego od drugiego.
 */
function serveVenues(initial: Venue[]) {
  const venues = [...initial];
  server.use(
    http.get(`${API}/tournaments/${TOURNAMENT_ID}/venues`, async () => {
      await delay(50);
      return HttpResponse.json({ data: [...venues] });
    }),
  );
  return venues;
}

/** Czeka, aż okno zniknie. Potwierdzenie usunięcia ma rolę `alertdialog`. */
function dialogClosed(role: 'dialog' | 'alertdialog' = 'dialog') {
  return waitFor(() => expect(screen.queryByRole(role)).not.toBeInTheDocument());
}

describe('useListMutation — dodawanie i edycja', () => {
  it('po dodaniu zamyka okno na już odświeżonej liście i pokazuje toast', async () => {
    const venues = serveVenues([BEMOWO]);
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, async ({ request }) => {
        const { name } = (await request.json()) as { name: string };
        const created = { id: 2, tournamentId: TOURNAMENT_ID, name, address: null };
        venues.push(created);
        return HttpResponse.json({ data: created }, { status: 201 });
      }),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    await dialogClosed();
    // Bez czekania: okno ma zniknąć dopiero na świeżej liście. Inaczej organizer
    // przez chwilę patrzy na listę bez obiektu, który właśnie dodał.
    expect(screen.getByTestId('venues')).toHaveTextContent('Hala Ursus');
    expect(await screen.findByText('Dodano obiekt „Hala Ursus”.')).toBeInTheDocument();
  });

  it('po edycji zamyka okno na odświeżonej liście i mówi, co zapisano', async () => {
    const venues = serveVenues([BEMOWO]);
    server.use(
      http.patch(`${API}/venues/${BEMOWO.id}`, async ({ request }) => {
        const { name } = (await request.json()) as { name: string };
        venues[0] = { ...BEMOWO, name };
        return HttpResponse.json({ data: venues[0] });
      }),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={BEMOWO} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.clear(screen.getByLabelText('Nazwa'));
    await user.type(screen.getByLabelText('Nazwa'), 'Boisko Bemowo II');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    await dialogClosed();
    expect(screen.getByTestId('venues')).toHaveTextContent('Boisko Bemowo II');
    expect(await screen.findByText('Zapisano obiekt „Boisko Bemowo II”.')).toBeInTheDocument();
  });

  it('czeka z zamknięciem na odpowiedź i do tego czasu nie da się okna zamknąć', async () => {
    serveVenues([]);
    let respond = () => {};
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, async () => {
        await new Promise<void>((resolve) => (respond = resolve));
        return HttpResponse.json({ data: URSUS }, { status: 201 });
      }),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    // Zapis po odpowiedzi, nie optymistyczny: okno stoi, dopóki serwer milczy,
    // bo tylko w nim jest gdzie pokazać ewentualny błąd pola.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dodaj' })).toHaveAttribute('aria-disabled', 'true'),
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    respond();
    await dialogClosed();
  });

  it('`422` sadza błąd przy polu, a okno zostaje otwarte bez toastu', async () => {
    serveVenues([BEMOWO]);
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () =>
        HttpResponse.json(
          {
            message: 'W tym turnieju jest już obiekt o tej nazwie.',
            errors: { name: ['W tym turnieju jest już obiekt o tej nazwie.'] },
          },
          { status: 422 },
        ),
      ),
    );

    const { user, invalidateQueries } = renderScreen((props) => (
      <VenueFormDialog venue={null} {...props} />
    ));
    await user.type(screen.getByLabelText('Nazwa'), 'boisko bemowo');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByLabelText('Nazwa')).toHaveAccessibleDescription(
      'W tym turnieju jest już obiekt o tej nazwie.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Komunikat jest przy polu, więc nie dubluje się nad formularzem.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Dodano/)).not.toBeInTheDocument();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('`422` pod kluczem, którego formularz nie zna (limit obiektów), trafia nad formularz', async () => {
    serveVenues([BEMOWO]);
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () =>
        HttpResponse.json(
          {
            message: 'Turniej może mieć najwyżej 32 obiekty.',
            errors: { venues: ['Turniej może mieć najwyżej 32 obiekty.'] },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Turniej może mieć najwyżej 32 obiekty.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa')).not.toHaveAttribute('aria-invalid');
  });

  it('`404` przy edycji zamyka okno, mówi, że obiektu już nie ma, i odświeża listę', async () => {
    // Ktoś usunął obiekt w innej karcie, a ta lista jeszcze go pokazuje.
    const venues = serveVenues([BEMOWO]);
    server.use(
      http.patch(`${API}/venues/${BEMOWO.id}`, () => {
        venues.length = 0;
        return HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 });
      }),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={BEMOWO} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.type(screen.getByLabelText('Nazwa'), ' II');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    await dialogClosed();
    expect(screen.getByTestId('venues')).not.toHaveTextContent('Boisko Bemowo');
    expect(await screen.findByText('Tego obiektu już nie ma.')).toBeInTheDocument();
    expect(screen.queryByText(/^Zapisano/)).not.toBeInTheDocument();
  });

  it('`404` przy dodawaniu zostaje w oknie, bo nie chodzi o ten obiekt', async () => {
    // Przy dodawaniu `404` dotyczy turnieju, a nie obiektu, którego jeszcze nie ma.
    // „Tego obiektu już nie ma” byłoby nieprawdą.
    serveVenues([]);
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () =>
        HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 }),
      ),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie znaleziono zasobu.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Tego obiektu już nie ma.')).not.toBeInTheDocument();
  });

  it('`500` daje ogólny komunikat w oknie, a ponowienie zapisuje', async () => {
    const venues = serveVenues([]);
    let attempts = 0;
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Wewnętrzny błąd serwera.' }, { status: 500 });
        }
        venues.push(URSUS);
        return HttpResponse.json({ data: URSUS }, { status: 201 });
      }),
    );

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    // Tekst serwera nie mówi organizerowi, co dalej; ogólny mówi „spróbuj ponownie”.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się zapisać. Spróbuj ponownie.',
    );

    await user.click(screen.getByRole('button', { name: 'Dodaj' }));
    await dialogClosed();
    expect(screen.getByTestId('venues')).toHaveTextContent('Hala Ursus');
  });

  it('błąd sieci daje ten sam komunikat po polsku, a nie tekst przeglądarki', async () => {
    serveVenues([]);
    server.use(http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () => HttpResponse.error()));

    const { user } = renderScreen((props) => <VenueFormDialog venue={null} {...props} />);
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się zapisać. Spróbuj ponownie.',
    );
    expect(screen.getByRole('button', { name: 'Dodaj' })).not.toHaveAttribute('aria-disabled');
  });

  it('unieważnia każdy podany klucz — przy drużynach także turniej z `teamsCount`', async () => {
    serveVenues([]);
    server.use(
      http.post(`${API}/tournaments/${TOURNAMENT_ID}/venues`, () =>
        HttpResponse.json({ data: URSUS }, { status: 201 }),
      ),
    );

    const tournamentKey = ['tournament', TOURNAMENT_ID];
    const { user, invalidateQueries } = renderScreen(
      (props) => <VenueFormDialog venue={null} {...props} />,
      { invalidate: [VENUES_KEY, tournamentKey] },
    );
    await user.type(screen.getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    await dialogClosed();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: VENUES_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: tournamentKey });
  });
});

describe('useListMutation — usuwanie', () => {
  it('po usunięciu zamyka okno, pokazuje toast, a potem odświeża listę', async () => {
    const venues = serveVenues([BEMOWO]);
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () => {
        venues.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderScreen((props) => <VenueDeleteDialog venue={BEMOWO} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    await dialogClosed('alertdialog');
    expect(await screen.findByText('Usunięto obiekt „Boisko Bemowo”.')).toBeInTheDocument();
    // Lista odświeża się już po zamknięciu — powód przy kolejności w hooku.
    await waitFor(() => expect(screen.getByTestId('venues')).not.toHaveTextContent('Boisko Bemowo'));
  });

  it('`422` z guarda blokuje okno: powód serwera i samo „Zamknij”', async () => {
    serveVenues([BEMOWO]);
    const reason = 'Nie można usunąć: obiekt „Boisko Bemowo” ma powiązane rozegrane mecze.';
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () =>
        HttpResponse.json({ message: reason, errors: { id: [reason] } }, { status: 422 }),
      ),
    );

    const { user, invalidateQueries } = renderScreen((props) => (
      <VenueDeleteDialog venue={BEMOWO} {...props} />
    ));
    await screen.findByText('Boisko Bemowo');
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
    // Ponowienie nic nie zmieni, więc nie ma czego kliknąć poza zamknięciem.
    expect(screen.queryByRole('button', { name: 'Usuń obiekt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Usunięto/)).not.toBeInTheDocument();
    expect(invalidateQueries).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    await dialogClosed('alertdialog');
    expect(screen.getByTestId('venues')).toHaveTextContent('Boisko Bemowo');
  });

  it('`404` działa jak sukces: okno znika, lista się odświeża, toast mówi, że już usunięty', async () => {
    // Usunięty w innej karcie: cel organizera jest osiągnięty, błędu nie ma co pokazywać.
    const venues = serveVenues([BEMOWO]);
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () => {
        venues.length = 0;
        return HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 });
      }),
    );

    const { user } = renderScreen((props) => <VenueDeleteDialog venue={BEMOWO} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    await dialogClosed('alertdialog');
    expect(await screen.findByText('Obiekt został już usunięty.')).toBeInTheDocument();
    expect(screen.queryByText(/^Usunięto/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('venues')).not.toHaveTextContent('Boisko Bemowo'));
  });

  it('`500` daje ogólny komunikat w oknie, a ponowienie usuwa', async () => {
    const venues = serveVenues([BEMOWO]);
    let attempts = 0;
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Wewnętrzny błąd serwera.' }, { status: 500 });
        }
        venues.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderScreen((props) => <VenueDeleteDialog venue={BEMOWO} {...props} />);
    await screen.findByText('Boisko Bemowo');
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się usunąć. Spróbuj ponownie.',
    );
    // Inaczej niż przy guardzie: awaria może minąć, więc „Usuń” zostaje.
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    await dialogClosed('alertdialog');
    expect(await screen.findByText('Usunięto obiekt „Boisko Bemowo”.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('venues')).not.toHaveTextContent('Boisko Bemowo'));
  });

  it('usunięcie bytu, na którego ekranie stoimy, najpierw z niego wychodzi, potem odświeża', async () => {
    // Drużyna z ekranu składu (#89): po sukcesie `onDone` wraca na listę drużyn.
    // Odświeżenie przed wyjściem dopytałoby o usuniętą drużynę, dostało `404`
    // i mignęło stanem „Nie ma takiej drużyny”.
    const team: Team = {
      id: 3,
      tournamentId: TOURNAMENT_ID,
      name: 'Wilki Bemowo',
      logoUrl: null,
      groupId: null,
      playersCount: 12,
    };
    let deleted = false;
    let teamRequests = 0;
    server.use(
      http.get(`${API}/teams/${team.id}`, () => {
        teamRequests += 1;
        return deleted
          ? HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 })
          : HttpResponse.json({ data: team });
      }),
      http.delete(`${API}/teams/${team.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const teamKey = ['tournament', TOURNAMENT_ID, 'teams', team.id];

    function TeamHeader() {
      const shown = useQuery({
        queryKey: teamKey,
        queryFn: async () => {
          const { data, error } = await api.GET('/teams/{team}', {
            params: { path: { team: team.id } },
          });
          if (error) throw new Error(error.message);
          return data.data;
        },
      });
      return <h1>{shown.data?.name ?? (shown.isError ? 'Nie ma takiej drużyny' : '…')}</h1>;
    }

    function TeamDeleteDialog({ onDone }: { onDone: () => void }) {
      // Najgorszy przypadek: prefiks turnieju obejmuje też klucz usuniętej drużyny.
      // `AGENTS.md` każe tego unikać; kolejność w hooku jest drugą linią obrony.
      const mutation = useListMutation({
        texts: TEAM_TEXTS,
        invalidate: [['tournament', TOURNAMENT_ID]],
        onDone,
      });
      return (
        <ConfirmDeleteDialog
          open
          onOpenChange={() => {}}
          onConfirm={() =>
            void mutation.remove({
              name: team.name,
              request: () => api.DELETE('/teams/{team}', { params: { path: { team: team.id } } }),
            })
          }
          entity={TEAM_TEXTS.accusative}
          name={team.name}
          pending={mutation.pending}
          {...mutation.removeError}
        />
      );
    }

    function SquadScreen() {
      const [onSquad, setOnSquad] = useState(true);
      if (!onSquad) return <p>Lista drużyn</p>;
      // `flushSync` zdejmuje ekran od razu, więc test widzi samą kolejność
      // w hooku: przy odświeżeniu przed `onDone` drużyna zostałaby dopytana.
      return (
        <>
          <TeamHeader />
          <TeamDeleteDialog onDone={() => flushSync(() => setOnSquad(false))} />
        </>
      );
    }

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SquadScreen />
        <Toaster />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await screen.findByText('Wilki Bemowo');
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));

    expect(await screen.findByText('Lista drużyn')).toBeInTheDocument();
    expect(await screen.findByText('Usunięto drużynę „Wilki Bemowo”.')).toBeInTheDocument();
    expect(teamRequests).toBe(1);
  });

  it('błąd sieci daje ten sam komunikat i zostawia „Usuń” do ponowienia', async () => {
    serveVenues([BEMOWO]);
    server.use(http.delete(`${API}/venues/${BEMOWO.id}`, () => HttpResponse.error()));

    const { user } = renderScreen((props) => <VenueDeleteDialog venue={BEMOWO} {...props} />);
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się usunąć. Spróbuj ponownie.',
    );
    expect(screen.getByRole('button', { name: 'Usuń obiekt' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('useListMutation — błąd w kodzie wywołania', () => {
  // Tylko `TypeError` z `fetch` znaczy „brak sieci”. Inny wyjątek to błąd
  // programisty i ma polecieć dalej, a nie skończyć się „Spróbuj ponownie”.
  it('wyjątek inny niż sieciowy nie jest brany za brak sieci', async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useListMutation({ texts: VENUE_TEXTS, invalidate: [VENUES_KEY], onDone }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
        ),
      },
    );

    await act(async () => {
      await expect(
        result.current.remove({
          name: 'Boisko Bemowo',
          request: () => Promise.reject(new Error('Literówka w ścieżce')),
        }),
      ).rejects.toThrow('Literówka w ścieżce');
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.removeError).toEqual({});
    expect(result.current.pending).toBe(false);
  });
});
