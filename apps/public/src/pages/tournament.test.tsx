import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicTournament, StandingRow, StandingTable } from '@tournament/api-client';
import { render, screen, waitFor, within } from '@testing-library/react';
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
function row(overrides: Partial<StandingRow> = {}): StandingRow {
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
function standingsReturns(data: StandingTable[]) {
  return http.get(`${API}/public/t/:slug/standings`, () => HttpResponse.json({ data }));
}

function renderPage(slug = SLUG) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/t/${slug}`]}>
        <Routes>
          <Route path="/t/:slug" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

/** Treść każdego wiersza ciała tabeli, komórka po komórce, w kolejności z DOM-u. */
function bodyRows() {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map((tr) => within(tr).getAllByRole('cell').map((cell) => cell.textContent));
}

describe('TournamentPage', () => {
  it('nagłówek zdobyczy bierze się z tabeli, nie ze sportu turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a tabela mówi „Punkty".
    // Sama zgodna para (koszykówka + „Punkty") nie wystarczy, bo przechodzi też
    // implementacji mapującej `sport.code` na etykietę — a ADR-0006 mówi wprost,
    // że etykietę niesie odpowiedź tabeli, nie sport.
    server.use(tournamentReturns(FOOTBALL), standingsReturns([table({ scoreLabel: 'Punkty' })]));

    renderPage();

    expect(await screen.findByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
  });

  it('ten sam widok pokazuje „Bramki", gdy tak mówi tabela', async () => {
    server.use(tournamentReturns(BASKETBALL), standingsReturns([table({ scoreLabel: 'Bramki' })]));

    renderPage();

    expect(await screen.findByRole('columnheader', { name: 'Bramki' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Punkty' })).not.toBeInTheDocument();
  });

  it('wiersze wychodzą w kolejności i z wartościami z API, zdobycze jako zdobyte:stracone', async () => {
    // Kolejność rozstrzygają tiebreaki, które organizator ustawia sam — widok ma jej
    // nie poprawiać. Dlatego para na górze ma równe punkty, a API stawia wyżej
    // drużynę z gorszym bilansem i dalszą w alfabecie: przestawiłoby je sortowanie
    // po bilansie, po zdobyczach i po nazwie. Liczby w wierszu są parami różne,
    // żeby zamiana dwóch kolumn nie dała przypadkiem tego samego napisu.
    server.use(
      tournamentReturns(FOOTBALL),
      standingsReturns([
        table({
          rows: [
            row({
              position: 1,
              team: { id: 2, name: 'Olimpia Park', logoUrl: null },
              played: 6,
              won: 2,
              drawn: 1,
              lost: 3,
              scoreFor: 9,
              scoreAgainst: 8,
              scoreDifference: 1,
              points: 7,
            }),
            row({
              position: 2,
              team: { id: 1, name: 'Dzielnica FC', logoUrl: null },
              played: 3,
              won: 2,
              drawn: 1,
              lost: 0,
              scoreFor: 10,
              scoreAgainst: 5,
              scoreDifference: 5,
              points: 7,
            }),
            row({
              position: 3,
              team: { id: 3, name: 'Zorza Wschód', logoUrl: null },
              played: 5,
              won: 1,
              drawn: 0,
              lost: 4,
              scoreFor: 4,
              scoreAgainst: 11,
              scoreDifference: -7,
              points: 3,
            }),
          ],
        }),
      ]),
    );

    renderPage();

    await screen.findByRole('row', { name: /Zorza Wschód/ });
    // Kolumny: #, Drużyna, M, Z, R, P, zdobycze, Pkt.
    expect(bodyRows()).toEqual([
      ['1', 'Olimpia Park', '6', '2', '1', '3', '9:8', '7'],
      ['2', 'Dzielnica FC', '3', '2', '1', '0', '10:5', '7'],
      ['3', 'Zorza Wschód', '5', '1', '0', '4', '4:11', '3'],
    ]);
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

  it('w trakcie wczytywania widok pokazuje tylko wskaźnik, choć tabele już przyszły', async () => {
    // Turniej nigdy nie odpowiada, tabele — od razu. Asercja ma sens dopiero wtedy,
    // gdy odpowiedź tabel już wylądowała: wcześniej brak tabeli wynika z samego
    // czasu, a nie z decyzji widoku.
    server.use(
      http.get(`${API}/public/t/:slug`, () => new Promise(() => {})),
      standingsReturns([table()]),
    );

    const client = renderPage();

    await waitFor(() => expect(client.isFetching()).toBe(1));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent(/^Wczytywanie\.\.\.$/);
  });

  it('błąd turnieju pokazuje komunikat z odpowiedzi zamiast tabeli', async () => {
    server.use(
      http.get(`${API}/public/t/:slug`, () =>
        // Komunikat, którego nikt nie wpisałby do widoku z ręki: przechodzi tylko
        // implementacja, która pokazuje to, co oddało API.
        HttpResponse.json(
          { message: 'Organizator ukrył ten turniej do czasu losowania grup.' },
          { status: 404 },
        ),
      ),
      // Widok w tym stanie tabel nie renderuje, ale zapytanie o nie i tak leci —
      // bez handlera `onUnhandledRequest: 'error'` wywaliłby test nie na tym, co bada.
      standingsReturns([table()]),
    );

    const client = renderPage();

    expect(
      await screen.findByText('Organizator ukrył ten turniej do czasu losowania grup.'),
    ).toBeInTheDocument();
    // Tabele też muszą już być na miejscu, inaczej brak tabeli niczego nie dowodzi.
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Wczytywanie...')).not.toBeInTheDocument();
  });
});
