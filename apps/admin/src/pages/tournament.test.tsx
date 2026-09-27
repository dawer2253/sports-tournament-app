import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { TournamentPage } from './tournament';

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
  sport: { id: 2, code: 'basketball', name: 'Koszykówka' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 2, draw: 0, loss: 1 },
  tiebreakers: ['points'],
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

beforeEach(() => {
  server.use(http.get(`${API}/me`, () => HttpResponse.json(ME)));
});

/**
 * Podpina `GET /tournaments/{id}` i zapisuje, o które id panel pytał —
 * asercje „nie poszło do API" i „poszło o id z adresu" czytają tę listę.
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

function renderPage(path: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tournaments/:id" element={<TournamentPage />} />
          <Route path="/" element={<p>Lista turniejów</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

describe('TournamentPage', () => {
  it('pyta API o turniej z adresu i pokazuje go w nagłówku', async () => {
    const requestedIds = tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

    renderPage('/tournaments/7');

    expect(await screen.findByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
    expect(requestedIds).toEqual(['7']);
    expect(screen.getByText('Szkic')).toBeInTheDocument();
    expect(screen.getByText('Koszykówka')).toBeInTheDocument();
    expect(screen.getByText('Drużyny: 8')).toBeInTheDocument();
    expect(screen.getByText('/t/puchar-zimowy')).toBeInTheDocument();
  });

  // 403 to cudzy turniej. Gdyby panel pokazał go inaczej niż 404 — choćby
  // przepuszczając komunikat z API — organizer mógłby sprawdzać, które id
  // należą do kogoś innego.
  it.each([
    [403, 'Zasób należy do innego organizera.'],
    [404, 'Zasób nie istnieje.'],
  ])('%i kończy się tym samym stanem „nie ma", bez ponawiania', async (status, message) => {
    tournamentEndpoint(() => HttpResponse.json({ message }, { status }));

    const user = renderPage('/tournaments/7');

    await screen.findByText('Nie ma takiego turnieju');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wróć do listy turniejów' }));
    expect(await screen.findByText('Lista turniejów')).toBeInTheDocument();
  });

  it.each(['abc', '0', '-1', '1.5', '1e3', '0x10', '007', '9007199254740993'])(
    'id „%s" nie idzie do API, tylko od razu daje „nie ma"',
    async (rawId) => {
      const requestedIds = tournamentEndpoint(() => HttpResponse.json({ data: TOURNAMENT }));

      renderPage(`/tournaments/${rawId}`);

      await screen.findByText('Nie ma takiego turnieju');
      expect(requestedIds).toEqual([]);
    },
  );

  it('inny błąd pokazuje komunikat i ponowienie, które pyta API jeszcze raz', async () => {
    let calls = 0;
    tournamentEndpoint(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 })
        : HttpResponse.json({ data: TOURNAMENT });
    });

    const user = renderPage('/tournaments/7');

    await screen.findByText('Nie udało się wczytać turnieju');
    expect(screen.getByText('Serwer nie odpowiada.')).toBeInTheDocument();
    expect(screen.queryByText('Nie ma takiego turnieju')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('heading', { name: 'Puchar Zimowy' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
