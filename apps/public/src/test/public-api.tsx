import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  PublicMatch,
  PublicMatchScorer,
  PublicTournament,
  StandingRow,
  StandingTable,
  StatLeaderboard,
  StatLeaderboardRow,
} from '@tournament/api-client';
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
    stats: [
      { code: 'goals', label: 'Bramki' },
      { code: 'yellowCards', label: 'Żółte kartki' },
      { code: 'redCards', label: 'Czerwone kartki' },
    ],
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
 * Mecz w kształcie kontraktu (`PublicMatch`). Kolejka `round` dostaje id
 * równe numerowi, a para drużyn bierze się z `id`, żeby nazwy w wierszach
 * były rozróżnialne. Bez strzelców, jak mecz zaplanowany.
 */
export function match(id: number, round: number, overrides: Partial<PublicMatch> = {}): PublicMatch {
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
    scorers: [],
    ...overrides,
  };
}

/** Mecz zakończony z wynikiem. */
export function finished(id: number, round: number, overrides: Partial<PublicMatch> = {}): PublicMatch {
  return match(id, round, { status: 'finished', homeScore: 2, awayScore: 1, ...overrides });
}

/**
 * Wiersz strzelca meczu `matchId` z `match()`: `side` wskazuje drużynę
 * strzelca (`home` to `Gospodarz {matchId}`), także przy samobóju.
 */
export function scorer(
  matchId: number,
  side: 'home' | 'away',
  playerId: number,
  overrides: Partial<PublicMatchScorer> = {},
): PublicMatchScorer {
  const { homeTeam, awayTeam } = match(matchId, 1);
  return {
    team: side === 'home' ? homeTeam! : awayTeam!,
    player: { id: playerId, name: `Zawodnik ${playerId}` },
    value: 1,
    minutes: [10 + playerId],
    ownGoal: false,
    ...overrides,
  };
}

/**
 * Wiersz klasyfikacji: zawodnik o podanym id, drużyna rozróżnialna po nim.
 */
export function leaderRow(playerId: number, overrides: Partial<StatLeaderboardRow> = {}): StatLeaderboardRow {
  return {
    position: 1,
    player: { id: playerId, name: `Zawodnik ${playerId}` },
    team: { id: 100 + playerId, name: `Drużyna ${playerId}`, logoUrl: null },
    value: 1,
    ...overrides,
  };
}

/** Klasyfikacja w kształcie kontraktu; domyślnie pusta, jak przed pierwszym meczem. */
export function leaderboard(overrides: Partial<StatLeaderboard> = {}): StatLeaderboard {
  return { stat: 'goals', label: 'Bramki', rows: [], ...overrides };
}

/**
 * Strona publiczna po stronie „serwera”: pięć endpointów z licznikami
 * żądań. Domyślnie turniej bez meczów, z jedną tabelą i pustą klasyfikacją.
 *
 * `leaderboards` dostaje `stat` z adresu (`null` bez parametru), a
 * `requests.leaderboard` zapisuje go przy każdym żądaniu — test sprawdza
 * nim, o co ekran zapytał.
 */
export function publicApi({
  data = tournament(),
  standings = [table()],
  fixtures = [],
  results = [],
  leaderboards = (stat) => leaderboard({ stat: stat ?? 'goals' }),
}: {
  data?: PublicTournament;
  standings?: StandingTable[];
  fixtures?: PublicMatch[];
  results?: PublicMatch[];
  leaderboards?: (stat: string | null) => StatLeaderboard;
} = {}) {
  const requests = { tournament: 0, standings: 0, fixtures: 0, results: 0, leaderboard: [] as (string | null)[] };
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
    http.get(`${API}/public/t/:slug/leaderboard`, ({ request }) => {
      const stat = new URL(request.url).searchParams.get('stat');
      requests.leaderboard.push(stat);
      return HttpResponse.json({ data: leaderboards(stat) });
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
