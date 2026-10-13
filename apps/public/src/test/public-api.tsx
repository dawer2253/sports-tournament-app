import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Match, PublicTournament, StandingRow, StandingTable } from '@tournament/api-client';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from '../routes';
import { API_URL as API, server } from './server';

export const SLUG = 'liga-osiedlowa-2026';

/** Turniej w kształcie kontraktu; test dopisuje tylko to, co bada. */
export function tournament(overrides: Partial<PublicTournament> = {}): PublicTournament {
  return {
    name: 'Liga Osiedlowa 2026',
    slug: SLUG,
    status: 'active',
    sport: { id: 1, code: 'football', name: 'Piłka nożna' },
    branding: { logoUrl: null, primaryColor: '#1F7A45' },
    stages: [{ id: 1, type: 'league', name: 'Faza zasadnicza', order: 1, groups: [] }],
    ...overrides,
  };
}

export function row(overrides: Partial<StandingRow> = {}): StandingRow {
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

export function table(overrides: Partial<StandingTable> = {}): StandingTable {
  return {
    stageId: 1,
    stageName: 'Faza ligowa',
    groupId: null,
    groupName: null,
    scoreLabel: 'Bramki',
    allowsDraw: true,
    tiebreakers: [{ code: 'points', label: 'Punkty w tabeli' }],
    rows: [row()],
    ...overrides,
  };
}

/**
 * Mecz w kształcie kontraktu. Kolejka `round` dostaje id równe numerowi,
 * a para drużyn bierze się z `id`, żeby nazwy w wierszach były rozróżnialne.
 */
export function match(id: number, round: number, overrides: Partial<Match> = {}): Match {
  return {
    id,
    stageId: 1,
    groupId: null,
    round: { id: round, name: `Kolejka ${round}`, order: round },
    matchNumber: 1,
    homeTeam: { id: id * 2 - 1, name: `Gospodarz ${id}`, logoUrl: null },
    awayTeam: { id: id * 2, name: `Gość ${id}`, logoUrl: null },
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    kickoffAt: '2026-10-18T10:00:00+00:00',
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    ...overrides,
  };
}

/** Mecz zakończony z wynikiem. */
export function finished(id: number, round: number, overrides: Partial<Match> = {}): Match {
  return match(id, round, { status: 'finished', homeScore: 2, awayScore: 1, ...overrides });
}

/**
 * Strona publiczna po stronie „serwera”: cztery endpointy z licznikami
 * żądań. Domyślnie turniej bez meczów i z jedną tabelą.
 */
export function publicApi({
  data = tournament(),
  standings = [table()],
  fixtures = [],
  results = [],
}: {
  data?: PublicTournament;
  standings?: StandingTable[];
  fixtures?: Match[];
  results?: Match[];
} = {}) {
  const requests = { tournament: 0, standings: 0, fixtures: 0, results: 0 };
  server.use(
    http.get(`${API}/public/t/:slug`, () => {
      requests.tournament++;
      return HttpResponse.json({ data });
    }),
    http.get(`${API}/public/t/:slug/standings`, () => {
      requests.standings++;
      return HttpResponse.json({ data: standings });
    }),
    http.get(`${API}/public/t/:slug/fixtures`, () => {
      requests.fixtures++;
      return HttpResponse.json({ data: fixtures });
    }),
    http.get(`${API}/public/t/:slug/results`, () => {
      requests.results++;
      return HttpResponse.json({ data: results });
    }),
  );
  return requests;
}

/** Drzewo tras aplikacji w routerze pamięciowym, pod podanym adresem. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}
