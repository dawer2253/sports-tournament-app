import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from './lib/session';
import { routes } from './routes';
import { API_URL as API, server } from './test/server';
import { allTournaments, currentTournaments } from './test/current-tournaments';
import { tournamentStages } from './test/tournament-stages';

const ME = {
  data: {
    id: 1,
    name: 'Dawid Patko',
    email: 'dawid@example.com',
    createdAt: '2026-09-01T10:00:00+02:00',
  },
};

const TOURNAMENT = {
  id: 7,
  name: 'Puchar Zimowy',
  slug: 'puchar-zimowy',
  status: 'draft',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 2, draw: 0, loss: 1 },
  tiebreakers: ['points'],
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

const SECTION_PATHS = ['teams', 'venues', 'settings'];

beforeEach(() => {
  // Trasy panelu stoją za `RequireAuth`, a bez tokenu każdy test lądowałby na logowaniu.
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    currentTournaments(),
    tournamentStages(),
    // Drużyny są ekranem domyślnym turnieju; ich treść sprawdza `pages/teams.test.tsx`.
    http.get(`${API}/tournaments/:id/teams`, () => HttpResponse.json({ data: [] })),
    // Obiekty służą tu za zwykłą sekcję; ich treść sprawdza `pages/tournament-venues.test.tsx`.
    http.get(`${API}/tournaments/:id/venues`, () => HttpResponse.json({ data: [] })),
  );
});

/**
 * Podpina `GET /tournaments/{id}` i zapisuje, o które id panel pytał —
 * asercje „nie poszło do API", „poszło o id z adresu" i „poszło raz" czytają
 * tę listę.
 */
function tournamentEndpoint(respond: () => Response) {
  const requestedIds: string[] = [];
  server.use(
    http.get(`${API}/tournaments/:id`, ({ params }) => {
      requestedIds.push(String(params.id));
      return respond();
    }),
  );
  return requestedIds;
}

/**
 * Renderuje prawdziwe drzewo tras panelu, a nie pojedynczy ekran: przekierowanie
 * z indeksu, wspólne wczytywanie w trasie-rodzicu i adresy kart istnieją tylko
 * w nim. Router zwracamy, żeby asercje czytały adres, na którym panel stanął.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, user: userEvent.setup() };
}

function sectionTabs() {
  return within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));
}

describe('trasy turnieju', () => {
  it('/tournaments/:id ląduje na drużynach i nie zostawia indeksu w historii', async () => {
    tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    const { router } = renderAt('/tournaments/7');

    await screen.findByRole('heading', { name: 'Puchar Zimowy' });
    expect(router.state.location.pathname).toBe('/tournaments/7/teams');
    // `replace`: „Wstecz" z drużyn nie wraca na indeks, który i tak odbija z powrotem.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('nagłówek: nazwa turnieju, sport i adres publiczny, status po prawej', async () => {
    const requestedIds = tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    renderAt('/tournaments/7/teams');

    expect(await screen.findByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
    expect(requestedIds).toEqual(['7']);
    expect(screen.getByText('Koszykówka · /t/puchar-zimowy')).toBeInTheDocument();
    // Status jest dwa razy: przy turnieju w sidebarze i w nagłówku, bo
    // poniżej `md` sidebar siedzi w zamkniętej szufladzie.
    expect(screen.getAllByText('Szkic')).toHaveLength(2);
  });

  it.each([
    ['Drużyny', '/tournaments/7/teams'],
    ['Obiekty', '/tournaments/7/venues'],
    ['Ustawienia', '/tournaments/7/settings'],
  ])('karta „%s" prowadzi na %s i jest tam aktywna', async (label, path) => {
    tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    // Start z innej sekcji niż cel, żeby kliknięcie faktycznie coś zmieniało.
    const start = path.endsWith('/settings') ? '/tournaments/7/teams' : '/tournaments/7/settings';
    const { router, user } = renderAt(start);
    await screen.findByRole('heading', { name: 'Puchar Zimowy' });

    const tab = sectionTabs().getByRole('link', { name: label });
    expect(tab).toHaveAttribute('href', path);
    await user.click(tab);

    expect(router.state.location.pathname).toBe(path);
    expect(sectionTabs().getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    // Aktywna jest dokładnie jedna karta, a nie „ta, w którą kliknięto, i poprzednia".
    expect(
      sectionTabs()
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toHaveLength(1);
  });

  it('Statystyki są nieczynne', async () => {
    tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    const { router, user } = renderAt('/tournaments/7/teams');
    await screen.findByRole('heading', { name: 'Puchar Zimowy' });

    for (const label of ['Statystyki']) {
      // Bez `href` element `<a>` nie ma roli `link`, więc szukamy po tekście.
      const tab = sectionTabs().getByText(label).closest('a')!;
      expect(tab).not.toHaveAttribute('href');
      expect(tab).toHaveAttribute('aria-disabled', 'true');
      expect(tab).toHaveAttribute('title', 'Wkrótce');
      await user.click(tab);
      expect(router.state.location.pathname).toBe('/tournaments/7/teams');
    }
    expect(sectionTabs().getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Drużyny',
      'Obiekty',
      'Ustawienia',
      'Terminarz',
      'Tabela',
      'Drabinka',
    ]);
    expect(sectionTabs().getByRole('link', { name: 'Tabela' })).toHaveAttribute('href', '/tournaments/7/standings');
    expect(sectionTabs().getByRole('link', { name: 'Terminarz' })).toHaveAttribute('href', '/tournaments/7/schedule');
  });

  it('przejście między sekcjami nie pyta API o turniej drugi raz', async () => {
    const requestedIds = tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    const { router, user } = renderAt('/tournaments/7/teams');
    await screen.findByRole('heading', { name: 'Puchar Zimowy' });

    await user.click(sectionTabs().getByRole('link', { name: 'Obiekty' }));
    await user.click(sectionTabs().getByRole('link', { name: 'Ustawienia' }));
    await user.click(sectionTabs().getByRole('link', { name: 'Drużyny' }));

    expect(router.state.location.pathname).toBe('/tournaments/7/teams');
    expect(screen.getByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
    expect(requestedIds).toEqual(['7']);
  });

  it('turniej w sidebarze prowadzi na drużyny, a nie do sekcji, w której stoi organizer', async () => {
    tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));
    server.use(currentTournaments([{ ...TOURNAMENT, id: 8, name: 'Liga Letnia' }, TOURNAMENT]));
    // Każdy ekran ma własny shell, więc listę szukamy od nowa po każdym przejściu.
    const sidebar = async () => within(await screen.findByRole('list', { name: 'Bieżące turnieje' }));

    const { router, user } = renderAt('/tournaments/7/venues');
    await screen.findByRole('heading', { name: 'Puchar Zimowy' });

    // Otwarty turniej jest pozycją listy, podświetloną; osobnej karty nie ma.
    const open = (await sidebar()).getByRole('link', { name: /Puchar Zimowy/ });
    expect(open).toHaveAttribute('aria-current', 'page');
    expect(open).toHaveAttribute('href', '/tournaments/7');
    await user.click(open);
    expect(router.state.location.pathname).toBe('/tournaments/7/teams');

    // Przełączenie turnieju nie przenosi sekcji: z obiektów A idzie na drużyny B.
    await user.click(sectionTabs().getByRole('link', { name: 'Obiekty' }));
    await user.click((await sidebar()).getByRole('link', { name: /Liga Letnia/ }));
    expect(router.state.location.pathname).toBe('/tournaments/8/teams');
  });

  describe.each(SECTION_PATHS)('/tournaments/:id/%s', (section) => {
    // 403 to cudzy turniej. Gdyby panel pokazał go inaczej niż 404 — choćby
    // przepuszczając komunikat z API — organizer mógłby sprawdzać, które id
    // należą do kogoś innego.
    it.each([
      [403, 'Zasób należy do innego organizera.'],
      [404, 'Zasób nie istnieje.'],
    ])('%i kończy się tym samym stanem „nie ma", bez ponawiania', async (status, message) => {
      tournamentEndpoint(() => HttpResponse.json({ message }, { status }));

      const { router, user } = renderAt(`/tournaments/7/${section}`);

      await screen.findByText('Nie ma takiego turnieju');
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
      // Bez turnieju nie ma czego pokazać w kontekście: ani podświetlonej pozycji, ani kart sekcji.
      expect(screen.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument();

      server.use(allTournaments(() => HttpResponse.json(emptyList())));
      await user.click(screen.getByRole('button', { name: 'Wróć do listy turniejów' }));
      expect(router.state.location.pathname).toBe('/');
    });

    it.each(['abc', '0', '-1', '1.5', '1e3', '0x10', '007', '9007199254740993'])(
      'id „%s" nie idzie do API, tylko od razu daje „nie ma"',
      async (rawId) => {
        const requestedIds = tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

        renderAt(`/tournaments/${rawId}/${section}`);

        await screen.findByText('Nie ma takiego turnieju');
        expect(requestedIds).toEqual([]);
      },
    );
  });

  it('inny błąd pokazuje komunikat i ponowienie, które pyta API jeszcze raz', async () => {
    let calls = 0;
    tournamentEndpoint(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 })
        : HttpResponse.json({ data: TOURNAMENT });
    });

    const { user } = renderAt('/tournaments/7/venues');

    await screen.findByText('Nie udało się wczytać turnieju');
    expect(screen.getByText('Serwer nie odpowiada.')).toBeInTheDocument();
    expect(screen.queryByText('Nie ma takiego turnieju')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
    expect(sectionTabs().getByRole('link', { name: 'Obiekty' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(calls).toBe(2);
  });
});

describe('odświeżenie turnieju w tle', () => {
  // Ekrany sekcji unieważniają `['tournament', id]` po zmianie drużyn (`teamsCount`).
  // Chwilowy błąd serwera przy takim odświeżeniu nie może zdjąć organizerowi
  // sekcji, na której pracuje.
  it('błąd serwera zostawia sekcję z ostatnio wczytanym turniejem', async () => {
    let calls = 0;
    tournamentEndpoint(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ data: TOURNAMENT })
        : HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 });
    });

    const { queryClient } = renderAt('/tournaments/7/venues');
    await screen.findByText('Turniej nie ma jeszcze obiektów');

    await queryClient.invalidateQueries({ queryKey: ['tournament', 7] });

    expect(calls).toBe(2);
    // React dorysowuje stan zapytania asynchronicznie, więc samo `queryByText`
    // zaraz po odświeżeniu przeszłoby także na kodzie, który sekcję zdejmuje.
    // Czekamy na stan błędu i wymagamy, żeby się nie pojawił.
    await expect(
      screen.findByText('Nie udało się wczytać turnieju', undefined, { timeout: 300 }),
    ).rejects.toThrow();
    expect(screen.getByText('Turniej nie ma jeszcze obiektów')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
  });

  it('404 przy odświeżeniu daje „nie ma”, bo turniej zniknął naprawdę', async () => {
    let calls = 0;
    tournamentEndpoint(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ data: TOURNAMENT })
        : HttpResponse.json({ message: 'Zasób nie istnieje.' }, { status: 404 });
    });

    const { queryClient } = renderAt('/tournaments/7/venues');
    await screen.findByText('Turniej nie ma jeszcze obiektów');

    await queryClient.invalidateQueries({ queryKey: ['tournament', 7] });

    expect(await screen.findByText('Nie ma takiego turnieju')).toBeInTheDocument();
    expect(screen.queryByText('Turniej nie ma jeszcze obiektów')).not.toBeInTheDocument();
  });
});

describe('poza turniejem', () => {
  it.each([
    ['lista', '/', 'Twoje turnieje'],
    ['kreator', '/tournaments/new', 'Nowy turniej'],
  ])('%s nie ma otwartego turnieju ani kart sekcji', async (_, path, heading) => {
    server.use(
      allTournaments(() => HttpResponse.json(emptyList())),
      http.get(`${API}/sports`, () => HttpResponse.json({ data: [] })),
    );

    renderAt(path);

    await screen.findByRole('heading', { name: heading });
    expect(screen.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument();
    // Sidebar po przyjściu listy: bez bieżących jest tylko wyjście do kreatora.
    const sidebar = within(screen.getByRole('navigation', { name: 'Panel' }));
    await sidebar.findByText(/Brak bieżących turniejów/);
    expect(sidebar.getAllByRole('link').map((link) => link.textContent)).toEqual(['Turnieje', 'Nowy turniej']);
    expect(sidebar.getByRole('link', { name: 'Nowy turniej' })).toHaveAttribute('href', '/tournaments/new');
    expect(sidebar.queryByRole('list', { name: 'Otwarty turniej' })).not.toBeInTheDocument();
  });
});

function emptyList() {
  return { data: [], meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 0 } };
}
