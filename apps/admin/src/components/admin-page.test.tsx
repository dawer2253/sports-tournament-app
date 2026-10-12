import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '@tournament/api-client';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';
import { allTournaments, currentTournaments, isCurrentTournamentsRequest } from '../test/current-tournaments';
import { AdminPage } from './admin-page';

const TOKEN = '1|token-sprzed-wylogowania';

const ME = {
  data: {
    id: 1,
    name: 'Dawid Patko',
    email: 'dawid@example.com',
    createdAt: '2026-09-01T10:00:00+02:00',
  },
};

const replace = vi.fn();

/**
 * `endSession()` przekierowuje przez `window.location.replace`, a jsdom nie
 * umie nawigować. Samej metody nie da się podmienić — w jsdomie `replace` jest
 * niekonfigurowalną własnością `Location` (`vi.spyOn` rzuca „Cannot redefine
 * property") — ale `window.location` już tak, więc podmieniamy cały obiekt.
 * `pathname` inny niż `/login`, bo na logowaniu `endSession()` przekierowanie
 * pomija.
 */
beforeEach(() => {
  vi.stubGlobal('location', { pathname: '/', replace });
  setToken(TOKEN);
  server.use(http.get(`${API}/me`, () => HttpResponse.json(ME)), currentTournaments());
});

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AdminPage active="dashboard" title="Turnieje">
          <p>Treść ekranu</p>
        </AdminPage>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

/** „Wyloguj" siedzi w menu konta, więc każde kliknięcie zaczyna się od otwarcia menu. */
async function clickLogout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu konta' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Wyloguj' }));
}

describe('AdminPage — wylogowanie', () => {
  it('POST /logout niesie token sprzed wylogowania', async () => {
    // Nagłówek czytany w handlerze, czyli w chwili, w której żądanie wyszło.
    // Gdyby `endSession()` poszło przed `POST /logout`, klient nie miałby już
    // czego dokleić i nagłówka by nie było.
    const recordAuthorization = vi.fn<(header: string | null) => void>();
    server.use(
      http.post(`${API}/logout`, ({ request }) => {
        recordAuthorization(request.headers.get('Authorization'));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = renderPage();
    await clickLogout(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(recordAuthorization).toHaveBeenCalledExactlyOnceWith(`Bearer ${TOKEN}`);
    expect(getToken()).toBeNull();
  });

  it.each([
    [
      '500',
      () => HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 }),
    ],
    ['błędzie sieci', () => HttpResponse.error()],
  ])('token znika także przy %s', async (_, respond) => {
    server.use(http.post(`${API}/logout`, respond));

    const user = renderPage();
    await clickLogout(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(getToken()).toBeNull();
  });

  it('dwa kliknięcia „Wyloguj" pod rząd dają jedno POST /logout', async () => {
    // Odpowiedź wstrzymana do drugiego kliknięcia: tylko wtedy pierwsze
    // żądanie jest jeszcze w drodze, gdy przychodzi drugie.
    //
    // Drugie kliknięcie widzi już render z `isPending`, bo menu konta zamyka
    // się po wyborze pozycji i trzeba je otworzyć od nowa. Kliknięcia z tego
    // samego, nieaktualnego renderu UI dziś nie dopuszcza, więc test go nie
    // odtwarza — pilnuje tego, że osłona w ogóle jest.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const requests = vi.fn();
    server.use(
      http.post(`${API}/logout`, async () => {
        requests();
        await held;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = renderPage();
    await clickLogout(user);
    await waitFor(() => expect(requests).toHaveBeenCalledOnce());
    await clickLogout(user);

    release();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(requests).toHaveBeenCalledOnce();
  });
});

const LIGA: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  matchDuration: 60,
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

/** Lista bieżących w sidebarze; `findBy`, bo przychodzi osobnym żądaniem. */
async function sidebarList() {
  return within(await screen.findByRole('list', { name: 'Bieżące turnieje' }));
}

/** Prawdziwe drzewo tras: odświeżenie po mutacji widać dopiero na ekranie, na który ona prowadzi. */
function renderRoutes(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup() };
}

describe('AdminPage — bieżące turnieje w sidebarze', () => {
  it('pyta o szkice i trwające, jedną stronę po 8, i pokazuje je pod „Turnieje"', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/tournaments`, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          data: [LIGA],
          meta: { currentPage: 1, lastPage: 1, perPage: 8, total: 1 },
        });
      }),
    );

    renderPage();

    const item = (await sidebarList()).getByRole('link', { name: /Liga Osiedlowa 2026/ });
    expect(item).toHaveAttribute('href', '/tournaments/7');
    expect(queries).toHaveLength(1);
    // Jedna wartość po przecinku, nie powtórzony klucz (ADR-0009).
    expect(queries[0]!.getAll('status')).toEqual(['draft,active']);
    expect(queries[0]!.get('perPage')).toBe('8');
  });

  it('błąd mówi o sobie, a „Spróbuj ponownie" pyta API jeszcze raz', async () => {
    let fail = true;
    const requests = vi.fn();
    server.use(
      http.get(`${API}/tournaments`, ({ request }) => {
        if (!isCurrentTournamentsRequest(request)) return undefined;
        requests();
        if (fail) return HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 });
        return HttpResponse.json({
          data: [LIGA],
          meta: { currentPage: 1, lastPage: 1, perPage: 8, total: 1 },
        });
      }),
    );

    const user = renderPage();
    const sidebar = within(screen.getByRole('navigation', { name: 'Panel' }));
    expect(await sidebar.findByText(/Nie udało się wczytać turniejów/)).toBeInTheDocument();

    fail = false;
    await user.click(sidebar.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect((await sidebarList()).getByText('Liga Osiedlowa 2026')).toBeInTheDocument();
    expect(requests).toHaveBeenCalledTimes(2);
  });

  // Tu odświeża i unieważnienie w kreatorze, i nowy shell na `/`, który pyta
  // przy montowaniu; test pilnuje efektu, a nie tego, która droga zadziałała.
  // Unieważnienie bez zmiany ekranu sprawdza test zakończenia turnieju niżej.
  it('po założeniu turnieju nowy stoi na liście', async () => {
    const tournaments: Tournament[] = [];
    server.use(
      currentTournaments(() => tournaments),
      allTournaments(() =>
        HttpResponse.json({
          data: tournaments,
          meta: { currentPage: 1, lastPage: 1, perPage: 20, total: tournaments.length },
        }),
      ),
      http.get(`${API}/sports`, () =>
        HttpResponse.json({ data: [{ id: 1, code: 'football', name: 'Piłka nożna', config: {} }] }),
      ),
      http.post(`${API}/tournaments`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        const created = { ...LIGA, id: 9, name: body.name, status: 'draft' as const };
        tournaments.unshift(created);
        return HttpResponse.json({ data: created }, { status: 201 });
      }),
    );

    const { router, user } = renderRoutes('/tournaments/new');
    const sidebar = within(screen.getByRole('navigation', { name: 'Panel' }));
    expect(await sidebar.findByText(/Brak bieżących turniejów/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nazwa turnieju/), 'Puchar Jesieni');
    await user.click(await screen.findByRole('radio', { name: /Piłka nożna/ }));
    await user.click(screen.getByRole('radio', { name: /Liga każdy z każdym/ }));
    await user.click(screen.getByRole('button', { name: 'Załóż turniej' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await screen.findByRole('heading', { name: 'Twoje turnieje' });
    // W jednym `waitFor`: shell kreatora schodzi razem z ekranem, więc pozycja
    // znaleziona w nim zniknęłaby z dokumentu przed asercją.
    await waitFor(() => {
      const list = within(screen.getByRole('list', { name: 'Bieżące turnieje' }));
      expect(within(list.getByRole('link', { name: /Puchar Jesieni/ })).getByText('Szkic')).toBeInTheDocument();
    });
  });

  it('po zakończeniu turnieju w ustawieniach lista pyta API od nowa i turniej schodzi pod kreskę', async () => {
    let current = LIGA;
    const sidebarRequests = vi.fn();
    server.use(
      currentTournaments(() => [current]),
      http.get(`${API}/tournaments/:id`, () => HttpResponse.json({ data: current })),
      http.get(`${API}/sports`, () => HttpResponse.json({ data: [] })),
      http.patch(`${API}/tournaments/:id`, async ({ request }) => {
        current = { ...current, ...((await request.json()) as Partial<Tournament>) };
        return HttpResponse.json({ data: current });
      }),
    );
    // Licznik przed handlerem odpowiedzi: msw sprawdza handlery od ostatnio
    // dodanego, a licznik przepuszcza żądanie dalej.
    server.use(
      http.get(`${API}/tournaments`, ({ request }) => {
        if (isCurrentTournamentsRequest(request)) sidebarRequests();
        return undefined;
      }),
    );

    const { user } = renderRoutes('/tournaments/7/settings');
    const finish = await screen.findByRole('button', { name: 'Zakończ' });
    const open = (await sidebarList()).getByRole('link', { name: /Liga Osiedlowa 2026/ });
    expect(open).toHaveAttribute('aria-current', 'page');
    // Ile żądań poszło przed zmianą, zależy od montowania ekranów (każdy ma
    // własny shell), więc liczy się przyrost, nie liczba.
    const before = sidebarRequests.mock.calls.length;

    await user.click(finish);

    // Turniej zszedł z bieżących, a zostaje widoczny pod kreską, podświetlony.
    const pinned = within(await screen.findByRole('list', { name: 'Otwarty turniej' }));
    expect(pinned.getByRole('link', { name: /Liga Osiedlowa 2026/ })).toHaveAttribute('aria-current', 'page');
    expect(pinned.getByText('Zakończony')).toBeInTheDocument();
    // Stan otwartego turnieju shell zna i bez listy, więc samo przejście pod
    // kreskę niczego o odświeżeniu nie dowodzi; dowodzi go dopiero kolejne
    // żądanie listy.
    await waitFor(() => expect(sidebarRequests.mock.calls.length).toBeGreaterThan(before));
    const sidebar = within(screen.getByRole('navigation', { name: 'Panel' }));
    expect(await sidebar.findByText(/Brak bieżących turniejów/)).toBeInTheDocument();
    expect(sidebar.queryByText(/więcej/)).not.toBeInTheDocument();
  });
});
