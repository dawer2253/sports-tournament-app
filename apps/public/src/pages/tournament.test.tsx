import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicTournament, StandingTable } from '@tournament/api-client';
import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { TournamentPage } from './tournament';

const SLUG = 'liga-osiedlowa-2026';

const FOOTBALL: PublicTournament = {
  name: 'Liga Osiedlowa 2026',
  slug: SLUG,
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  stages: [],
};

const BASKETBALL: PublicTournament = {
  ...FOOTBALL,
  name: 'Liga Koszykówki 2026',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka' },
};

/** Wiersz tabeli w kształcie kontraktu; dopisujemy tylko to, co test naprawdę bada. */
function row(overrides: Partial<StandingTable['rows'][number]> = {}): StandingTable['rows'][number] {
  return {
    position: 1,
    team: { id: 1, name: 'Dzielnica FC', logoUrl: null },
    played: 3,
    won: 2,
    drawn: 1,
    lost: 0,
    scoreFor: 7,
    scoreAgainst: 2,
    scoreDifference: 5,
    points: 7,
    ...overrides,
  };
}

function table(overrides: Partial<StandingTable> = {}): StandingTable {
  return {
    stageId: 1,
    stageName: 'Faza ligowa',
    groupId: null,
    groupName: null,
    scoreLabel: 'Bramki',
    rows: [row()],
    ...overrides,
  };
}

/** Handler `GET /public/t/{slug}`, który zwraca zadany turniej. */
function tournamentReturns(data: PublicTournament) {
  return http.get(`${API}/public/t/:slug`, () => HttpResponse.json({ data }));
}

/** Handler `GET /public/t/{slug}/standings`, który zwraca zadane tabele. */
function standingsReturn(data: StandingTable[]) {
  return http.get(`${API}/public/t/:slug/standings`, () => HttpResponse.json({ data }));
}

function renderPage(slug = SLUG) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[`/t/${slug}`]}>
        <Routes>
          <Route path="/t/:slug" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TournamentPage', () => {
  it('nagłówek zdobyczy bierze się z tabeli, nie ze sportu turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a tabela mówi „Punkty".
    // Sama zgodna para (koszykówka + „Punkty") nie wystarczy, bo przechodzi też
    // implementacji mapującej `sport.code` na etykietę — a ADR-0006 mówi wprost,
    // że etykietę niesie odpowiedź tabeli, nie sport.
    server.use(tournamentReturns(FOOTBALL), standingsReturn([table({ scoreLabel: 'Punkty' })]));

    renderPage();

    expect(await screen.findByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
  });

  it('ten sam widok pokazuje „Bramki", gdy tak mówi tabela', async () => {
    server.use(tournamentReturns(BASKETBALL), standingsReturn([table({ scoreLabel: 'Bramki' })]));

    renderPage();

    expect(await screen.findByRole('columnheader', { name: 'Bramki' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Punkty' })).not.toBeInTheDocument();
  });

  it('wiersz tabeli oddaje wartości z API, ze zdobyczami jako zdobyte:stracone', async () => {
    server.use(
      tournamentReturns(FOOTBALL),
      standingsReturn([
        table({
          rows: [
            row(),
            row({
              position: 2,
              team: { id: 2, name: 'Olimpia Park', logoUrl: null },
              won: 1,
              drawn: 0,
              lost: 2,
              scoreFor: 3,
              scoreAgainst: 6,
              scoreDifference: -3,
              points: 3,
            }),
          ],
        }),
      ]),
    );

    renderPage();

    const first = within(await screen.findByRole('row', { name: /Dzielnica FC/ }));
    expect(first.getByText('7:2')).toBeInTheDocument();

    const second = within(screen.getByRole('row', { name: /Olimpia Park/ }));
    expect(second.getByText('3:6')).toBeInTheDocument();

    // Kolejność jest ta, którą oddało API — widok nie sortuje po swojemu.
    const teams = screen.getAllByRole('cell', { name: /FC|Park/ }).map((cell) => cell.textContent);
    expect(teams).toEqual(['Dzielnica FC', 'Olimpia Park']);
  });

  it('oba żądania lecą pod slug z adresu, a nie pod zgadnięty', async () => {
    const requested: Record<string, string> = {};
    server.use(
      http.get(`${API}/public/t/:slug`, ({ params }) => {
        requested.tournament = String(params.slug);
        return HttpResponse.json({ data: FOOTBALL });
      }),
      http.get(`${API}/public/t/:slug/standings`, ({ params }) => {
        requested.standings = String(params.slug);
        return HttpResponse.json({ data: [table()] });
      }),
    );

    renderPage('puchar-jesieni-2026');

    await screen.findByRole('row', { name: /Dzielnica FC/ });
    expect(requested).toEqual({
      tournament: 'puchar-jesieni-2026',
      standings: 'puchar-jesieni-2026',
    });
  });

  it('w trakcie wczytywania nie ma ani tabeli, ani komunikatu błędu', async () => {
    // Turniej nigdy nie odpowiada: widok zostaje w stanie oczekiwania.
    server.use(
      http.get(`${API}/public/t/:slug`, () => new Promise(() => {})),
      standingsReturn([table()]),
    );

    renderPage();

    expect(await screen.findByText('Wczytywanie...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('błąd turnieju pokazuje komunikat z odpowiedzi zamiast tabeli', async () => {
    server.use(
      http.get(`${API}/public/t/:slug`, () =>
        HttpResponse.json({ message: 'Nie znaleziono turnieju.' }, { status: 404 }),
      ),
      // Widok w tym stanie tabel nie renderuje, ale zapytanie o nie i tak leci —
      // bez handlera `onUnhandledRequest: 'error'` wywaliłby test nie na tym, co bada.
      standingsReturn([table()]),
    );

    renderPage();

    expect(await screen.findByText('Nie znaleziono turnieju.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Wczytywanie...')).not.toBeInTheDocument();
  });
});
