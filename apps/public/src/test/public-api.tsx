import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  Match,
  PublicMatch,
  PublicMatchDetail,
  PublicMatchEvent,
  PublicMatchScorer,
  PublicTournament,
  StandingRow,
  StandingTable,
  StatLeaderboard,
  StatLeaderboardRow,
} from '@tournament/api-client';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { demoBracket, type DemoBracketOptions } from '@tournament/ui/lib/demo-data.ts';
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
    sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
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
 * Strona meczu (`PublicMatchDetail`) meczu z `match()`: domyślnie bez
 * zdarzeń i bez części; test dopisuje to, co bada.
 */
export function detail(id: number, overrides: Partial<PublicMatchDetail> = {}): PublicMatchDetail {
  return { ...finished(id, 1), events: [], periods: [], ...overrides };
}

/**
 * Zdarzenie relacji meczu `matchId` z `match()`: `side` wskazuje drużynę
 * zdarzenia (`home` to `Gospodarz {matchId}`), także przy samobóju.
 */
export function matchEvent(
  matchId: number,
  side: 'home' | 'away',
  id: number,
  overrides: Partial<PublicMatchEvent> = {},
): PublicMatchEvent {
  const { homeTeam, awayTeam } = match(matchId, 1);
  return {
    id,
    team: side === 'home' ? homeTeam! : awayTeam!,
    player: { id: 100 + id, name: `Zawodnik ${100 + id}` },
    type: 'yellow_card',
    typeLabel: 'Żółta kartka',
    minute: id * 10,
    period: null,
    scoreAfter: null,
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
 * Strona publiczna po stronie „serwera”: sześć endpointów z licznikami
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
  matches = [],
  stageMatches = [],
}: {
  data?: PublicTournament;
  standings?: StandingTable[];
  fixtures?: PublicMatch[];
  results?: PublicMatch[];
  leaderboards?: (stat: string | null) => StatLeaderboard;
  /** Strony meczów (#210); mecz spoza listy daje `404` jak w API. */
  matches?: PublicMatchDetail[];
  /** Mecze fazy dla `/matches?stageId=` (#234); filtr po `stageId` jak w API. */
  stageMatches?: Match[];
} = {}) {
  const requests = {
    tournament: 0,
    standings: 0,
    fixtures: 0,
    results: 0,
    leaderboard: [] as (string | null)[],
    match: 0,
    stageMatches: [] as (string | null)[],
  };
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
    http.get(`${API}/public/t/:slug/matches`, ({ request }) => {
      const stageId = new URL(request.url).searchParams.get('stageId');
      requests.stageMatches.push(stageId);
      return HttpResponse.json({ data: stageMatches.filter((candidate) => String(candidate.stageId) === stageId) });
    }),
    http.get(`${API}/public/t/:slug/matches/:match`, ({ params }) => {
      requests.match++;
      const found = matches.find((candidate) => String(candidate.id) === params.match);
      return found
        ? HttpResponse.json({ data: found })
        : HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 });
    }),
  );
  return requests;
}

/** Puchar: jedna faza `knockout` o `id: 2`, jak przykład `puchar` w kontrakcie. */
export function cup(overrides: Partial<PublicTournament> = {}): PublicTournament {
  return tournament({
    name: 'Puchar Osiedlowy 2026',
    stages: [{ id: 2, type: 'knockout', name: 'Faza pucharowa', order: 1, groups: [] }],
    ...overrides,
  });
}

/**
 * Mecze fazy pucharowej w kształcie kontraktu (`Match`), ułożone regułami
 * generatora przez `demoBracket` z design systemu: id meczu to
 * `order · 1000 + matchNumber`, a drużyny („Wilki Bemowo”, „Orły Bielany”…)
 * mają id równe rozstawieniu. `overrides` po id meczu.
 */
export function cupMatches(options: DemoBracketOptions, overrides: Record<number, Partial<Match>> = {}): Match[] {
  const team = (value: { id: number; name: string } | null) => value && { ...value, logoUrl: null };
  return demoBracket(options).map((match) => ({
    ...match,
    groupId: null,
    homeTeam: team(match.homeTeam),
    awayTeam: team(match.awayTeam),
    ...overrides[match.id],
  }));
}

/** Mecz fazy jako wiersz `/fixtures` albo `/results`: bez strzelców. */
export function asPublic(match: Match): PublicMatch {
  return { ...match, scorers: [] };
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
