import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament, Venue } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+02:00' },
};

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'score_diff'],
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

const BEMOWO: Venue = {
  id: 1,
  tournamentId: TOURNAMENT.id,
  name: 'Boisko Bemowo',
  address: 'ul. Powstańców Śląskich 1, Warszawa',
};
const URSUS: Venue = { id: 2, tournamentId: TOURNAMENT.id, name: 'Hala Ursus', address: null };

const VENUES_URL = `${API}/tournaments/${TOURNAMENT.id}/venues`;

beforeEach(() => {
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => HttpResponse.json({ data: TOURNAMENT })),
  );
});

/**
 * Obiekty turnieju po stronie „serwera”: `GET` oddaje bieżącą tablicę, a test
 * dokłada handlery zapisu, które ją zmieniają. `requests` liczy pobrania listy,
 * żeby „lista pobrana ponownie” było sprawdzalne wprost.
 */
function serveVenues(initial: Venue[]) {
  const state = { venues: [...initial], requests: 0 };
  server.use(
    http.get(VENUES_URL, () => {
      state.requests += 1;
      return HttpResponse.json({ data: [...state.venues] });
    }),
  );
  return state;
}

function validationError(errors: Record<string, string[]>) {
  const message = Object.values(errors)[0]![0]!;
  return HttpResponse.json({ message, errors }, { status: 422 });
}

function renderVenues() {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/tournaments/${TOURNAMENT.id}/venues`],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** Tabela z wczytanymi obiektami. Szkielet wczytywania też jest tabelą, więc czekamy, aż zniknie. */
async function venuesTable() {
  const table = await screen.findByRole('table');
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Wczytywanie obiektów' })).not.toBeInTheDocument(),
  );
  return table;
}

function dialogClosed(role: 'dialog' | 'alertdialog' = 'dialog') {
  return waitFor(() => expect(screen.queryByRole(role)).not.toBeInTheDocument());
}

describe('Obiekty — lista', () => {
  it('pokazuje obiekty w kolejności z serwera, a brak adresu jako „–”', async () => {
    // Kolejność odwrotna do alfabetycznej: ekran nie może jej poprawiać po swojemu.
    serveVenues([URSUS, BEMOWO]);
    renderVenues();

    const rows = within(await venuesTable()).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual([
      'Hala Ursus',
      'Boisko Bemowo',
    ]);
    expect(within(rows[0]!).getAllByRole('cell')[1]).toHaveTextContent(/^–$/);
    expect(within(rows[1]!).getAllByRole('cell')[1]).toHaveTextContent(BEMOWO.address!);
  });

  it('przy niepustej liście „Dodaj obiekt” stoi w nagłówku', async () => {
    serveVenues([BEMOWO]);
    renderVenues();

    await venuesTable();
    expect(screen.getAllByRole('button', { name: 'Dodaj obiekt' })).toHaveLength(1);
  });

  it('pusta lista ma „Dodaj obiekt” tylko w pustym stanie i otwiera nim dialog', async () => {
    serveVenues([]);
    const user = renderVenues();

    expect(await screen.findByText('Turniej nie ma jeszcze obiektów')).toBeInTheDocument();
    // Jeden przycisk, nie dwa: nagłówek milczy, gdy akcję niesie pusty stan.
    const create = screen.getAllByRole('button', { name: 'Dodaj obiekt' });
    expect(create).toHaveLength(1);

    await user.click(create[0]!);
    expect(screen.getByRole('dialog', { name: 'Nowy obiekt' })).toBeInTheDocument();
  });

  it('błąd wczytania daje ponowienie, które pobiera listę jeszcze raz', async () => {
    let attempts = 0;
    server.use(
      http.get(VENUES_URL, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ message: 'Wewnętrzny błąd serwera.' }, { status: 500 })
          : HttpResponse.json({ data: [BEMOWO] });
      }),
    );
    const user = renderVenues();

    expect(await screen.findByText('Nie udało się wczytać obiektów')).toBeInTheDocument();
    // Przy błędzie liczy się ponowienie, nie dodawanie kolejnego obiektu.
    expect(screen.queryByRole('button', { name: 'Dodaj obiekt' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(within(await venuesTable()).getByText('Boisko Bemowo')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});

describe('Obiekty — dodawanie', () => {
  it('puste pole adresu wysyła `null`, a po sukcesie dialog znika na pobranej ponownie liście', async () => {
    const state = serveVenues([BEMOWO]);
    const bodies: unknown[] = [];
    server.use(
      http.post(VENUES_URL, async ({ request }) => {
        const body = (await request.json()) as { name: string; address: string | null };
        bodies.push(body);
        const created = { id: 3, tournamentId: TOURNAMENT.id, ...body };
        state.venues.push(created);
        return HttpResponse.json({ data: created }, { status: 201 });
      }),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    const dialog = screen.getByRole('dialog', { name: 'Nowy obiekt' });
    await user.type(within(dialog).getByLabelText('Nazwa'), '  Hala Ursus ');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    await dialogClosed();
    expect(bodies).toEqual([{ name: 'Hala Ursus', address: null }]);
    expect(state.requests).toBe(2);
    expect(screen.getByRole('table')).toHaveTextContent('Hala Ursus');
    expect(await screen.findByText('Dodano obiekt „Hala Ursus”.')).toBeInTheDocument();
  });

  it('nie wysyła formularza bez nazwy i mówi to przy polu', async () => {
    serveVenues([BEMOWO]);
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    // Brak handlera `POST` + `onUnhandledRequest: 'error'`: wysyłka wywróciłaby test.
    expect(await within(dialog).findByLabelText('Nazwa')).toHaveAccessibleDescription(
      'Podaj nazwę obiektu.',
    );
  });

  it('`422` pod `name` siada przy polu, a dialog zostaje otwarty', async () => {
    serveVenues([BEMOWO]);
    const message = 'W tym turnieju jest już obiekt o tej nazwie.';
    server.use(http.post(VENUES_URL, () => validationError({ name: [message] })));
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nazwa'), 'boisko bemowo');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await within(dialog).findByLabelText('Nazwa')).toHaveAccessibleDescription(message);
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('`422` pod `venues` (limit) trafia nad formularz, a dialog zostaje otwarty', async () => {
    serveVenues([BEMOWO]);
    const message = 'Turniej może mieć najwyżej 32 obiekty.';
    server.use(http.post(VENUES_URL, () => validationError({ venues: [message] })));
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nazwa'), 'Hala Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByLabelText('Nazwa')).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).getByLabelText('Adres')).not.toHaveAttribute('aria-invalid');
  });

  it('ponowne otwarcie dodawania zaczyna od pustego formularza bez starego błędu', async () => {
    serveVenues([BEMOWO]);
    server.use(
      http.post(VENUES_URL, () =>
        validationError({ name: ['W tym turnieju jest już obiekt o tej nazwie.'] }),
      ),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    await user.type(screen.getByLabelText('Nazwa'), 'boisko bemowo');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));
    await within(screen.getByRole('dialog')).findByText('W tym turnieju jest już obiekt o tej nazwie.');
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    await dialogClosed();

    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    expect(screen.getByLabelText('Nazwa')).toHaveValue('');
    expect(screen.getByLabelText('Nazwa')).not.toHaveAttribute('aria-invalid');
  });
  it('za długą nazwę zgłasza przy polu zamiast ucinać ją po cichu', async () => {
    // Bez `maxLength` na polu: wklejona za długa nazwa zostaje w całości,
    // a organizer widzi, o ile przekroczył limit, zamiast tracić końcówkę.
    serveVenues([BEMOWO]);
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Dodaj obiekt' }));
    await user.click(screen.getByLabelText('Nazwa'));
    await user.paste('a'.repeat(121));
    expect(screen.getByLabelText('Nazwa')).toHaveValue('a'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByLabelText('Nazwa')).toHaveAccessibleDescription(
      'Nazwa może mieć najwyżej 120 znaków.',
    );
  });
});

describe('Obiekty — edycja', () => {
  it('dialog startuje z danymi obiektu, a `PATCH` idzie na `/venues/{id}` tego obiektu', async () => {
    const state = serveVenues([BEMOWO, URSUS]);
    const patched: { id: string; body: unknown }[] = [];
    server.use(
      http.patch(`${API}/venues/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Partial<Venue>;
        patched.push({ id: String(params.id), body });
        const index = state.venues.findIndex((venue) => venue.id === Number(params.id));
        state.venues[index] = { ...state.venues[index]!, ...body };
        return HttpResponse.json({ data: state.venues[index] });
      }),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Edytuj obiekt Hala Ursus' }));
    const dialog = screen.getByRole('dialog', { name: 'Edytuj obiekt' });
    expect(within(dialog).getByLabelText('Nazwa')).toHaveValue('Hala Ursus');
    expect(within(dialog).getByLabelText('Adres')).toHaveValue('');

    await user.type(within(dialog).getByLabelText('Adres'), 'ul. Sosnkowskiego 3, Warszawa');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await dialogClosed();
    expect(patched).toEqual([
      { id: String(URSUS.id), body: { name: 'Hala Ursus', address: 'ul. Sosnkowskiego 3, Warszawa' } },
    ]);
    expect(screen.getByRole('table')).toHaveTextContent('ul. Sosnkowskiego 3, Warszawa');
    expect(await screen.findByText('Zapisano obiekt „Hala Ursus”.')).toBeInTheDocument();
  });

  it('wyczyszczony adres zapisuje się jako `null`', async () => {
    serveVenues([BEMOWO]);
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API}/venues/${BEMOWO.id}`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { ...BEMOWO, address: null } });
      }),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Edytuj obiekt Boisko Bemowo' }));
    await user.clear(screen.getByLabelText('Adres'));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    await dialogClosed();
    expect(bodies).toEqual([{ name: 'Boisko Bemowo', address: null }]);
  });
});

describe('Obiekty — usuwanie', () => {
  it('pyta o obiekt po nazwie, bez zdania o meczach, i po sukcesie znika z listy', async () => {
    const state = serveVenues([BEMOWO, URSUS]);
    server.use(
      http.delete(`${API}/venues/${URSUS.id}`, () => {
        state.venues = state.venues.filter((venue) => venue.id !== URSUS.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt Hala Ursus' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Usunąć obiekt „Hala Ursus”?' });
    // Panel nie zna liczby meczów obiektu, więc nie ma o czym uprzedzać (#90).
    expect(dialog).not.toHaveTextContent(/mecz/i);

    await user.click(within(dialog).getByRole('button', { name: 'Usuń obiekt' }));
    await dialogClosed('alertdialog');
    expect(await screen.findByText('Usunięto obiekt „Hala Ursus”.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Hala Ursus'));
  });

  it('`422` pod `id` daje komunikat serwera i tylko „Zamknij”, a obiekt zostaje na liście', async () => {
    const state = serveVenues([BEMOWO, URSUS]);
    const reason = 'Nie można usunąć: obiekt „Boisko Bemowo” ma powiązane rozegrane mecze.';
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () =>
        HttpResponse.json({ message: reason, errors: { id: [reason] } }, { status: 422 }),
      ),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt Boisko Bemowo' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Usuń obiekt' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(reason);
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Zamknij',
    ]);

    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await dialogClosed('alertdialog');
    expect(screen.getByRole('table')).toHaveTextContent('Boisko Bemowo');
    // Odmowa niczego nie zmieniła, więc lista nie idzie po nowe dane.
    expect(state.requests).toBe(1);
  });

  it('`404` działa jak sukces: okno znika z toastem, a lista się odświeża', async () => {
    const state = serveVenues([BEMOWO, URSUS]);
    server.use(
      http.delete(`${API}/venues/${URSUS.id}`, () => {
        // Ktoś usunął obiekt w innej karcie.
        state.venues = state.venues.filter((venue) => venue.id !== URSUS.id);
        return HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 });
      }),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt Hala Ursus' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Usuń obiekt' }),
    );

    await dialogClosed('alertdialog');
    expect(await screen.findByText('Obiekt został już usunięty.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Hala Ursus'));
  });

  it('blokada z jednego obiektu nie wraca przy usuwaniu następnego', async () => {
    serveVenues([BEMOWO, URSUS]);
    const reason = 'Nie można usunąć: obiekt „Boisko Bemowo” ma powiązane rozegrane mecze.';
    server.use(
      http.delete(`${API}/venues/${BEMOWO.id}`, () =>
        HttpResponse.json({ message: reason, errors: { id: [reason] } }, { status: 422 }),
      ),
    );
    const user = renderVenues();

    await venuesTable();
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt Boisko Bemowo' }));
    await user.click(screen.getByRole('button', { name: 'Usuń obiekt' }));
    await screen.findByText(reason);
    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    await dialogClosed('alertdialog');

    await user.click(screen.getByRole('button', { name: 'Usuń obiekt Hala Ursus' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Usunąć obiekt „Hala Ursus”?' });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Usuń obiekt' })).toBeInTheDocument();
  });
});
