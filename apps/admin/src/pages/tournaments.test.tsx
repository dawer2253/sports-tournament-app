import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { TournamentsPage } from './tournaments';

const ME = {
  data: {
    id: 1,
    name: 'Dawid Patko',
    email: 'dawid@example.com',
    createdAt: '2026-09-01T10:00:00+02:00',
  },
};

const TOURNAMENT = {
  id: 1,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  teamsCount: 3,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

const TOURNAMENT_2 = {
  ...TOURNAMENT,
  id: 7,
  name: 'Puchar Zimowy',
  slug: 'puchar-zimowy',
  status: 'draft',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka' },
  teamsCount: 8,
};

/** Wypisuje id z adresu, żeby test mógł je odczytać z ekranu. */
function EchoId() {
  const { id } = useParams();
  return <p>Ekran turnieju: {id}</p>;
}

/** Odpowiedź `GET /tournaments` z zadaną listą i licznikiem zgodnym z kontraktem. */
function list(tournaments: unknown[]) {
  return {
    data: tournaments,
    meta: { currentPage: 1, lastPage: 1, perPage: 20, total: tournaments.length },
  };
}

beforeEach(() => {
  server.use(http.get(`${API}/me`, () => HttpResponse.json(ME)));
});

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TournamentsPage />} />
          <Route path="/tournaments/new" element={<p>Kreator turnieju</p>} />
          {/* Echo id z adresu: asercja czyta id, pod które panel faktycznie
              przeszedł, a nie tylko „jakiś ekran turnieju". */}
          <Route path="/tournaments/:id" element={<EchoId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

describe('TournamentsPage', () => {
  it('pusty stan ma wyjście do kreatora', async () => {
    server.use(http.get(`${API}/tournaments`, () => HttpResponse.json(list([]))));

    const user = renderPage();
    await screen.findByText('Nie masz jeszcze turniejów');

    await user.click(screen.getByRole('button', { name: 'Nowy turniej' }));

    expect(await screen.findByText('Kreator turnieju')).toBeInTheDocument();
  });

  it('niepusta lista też ma wyjście do kreatora — w nagłówku', async () => {
    server.use(http.get(`${API}/tournaments`, () => HttpResponse.json(list([TOURNAMENT]))));

    const user = renderPage();
    await screen.findByText('Liga Osiedlowa 2026');

    await user.click(screen.getByRole('button', { name: /Nowy turniej/ }));

    expect(await screen.findByText('Kreator turnieju')).toBeInTheDocument();
  });

  it('w stanie błędu nie proponuje zakładania turnieju, tylko ponowienie', async () => {
    server.use(
      http.get(`${API}/tournaments`, () =>
        HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 }),
      ),
    );

    renderPage();
    await screen.findByText('Nie udało się wczytać turniejów');

    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nowy turniej/ })).not.toBeInTheDocument();
  });

  it('„Otwórz" prowadzi na ekran turnieju z tego wiersza (#46)', async () => {
    // Drugi wiersz ma id 7, więc ani „zawsze pierwszy", ani „pozycja w liście"
    // nie dadzą tego samego adresu co id z odpowiedzi.
    server.use(
      http.get(`${API}/tournaments`, () =>
        HttpResponse.json(list([TOURNAMENT, TOURNAMENT_2])),
      ),
    );

    const user = renderPage();
    await screen.findByText('Puchar Zimowy');

    await user.click(screen.getByRole('button', { name: 'Otwórz turniej Puchar Zimowy' }));

    expect(await screen.findByText('Ekran turnieju: 7')).toBeInTheDocument();
  });

  it('każdy wiersz prowadzi pod własne id, nie pod id sąsiada', async () => {
    server.use(
      http.get(`${API}/tournaments`, () =>
        HttpResponse.json(list([TOURNAMENT, TOURNAMENT_2])),
      ),
    );

    const user = renderPage();
    await screen.findByText('Liga Osiedlowa 2026');

    await user.click(screen.getByRole('button', { name: 'Otwórz turniej Liga Osiedlowa 2026' }));

    expect(await screen.findByText('Ekran turnieju: 1')).toBeInTheDocument();
  });
});
