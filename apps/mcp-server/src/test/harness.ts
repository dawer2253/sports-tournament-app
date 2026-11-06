import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, onTestFinished, vi } from 'vitest';
import { createServer } from '../server.ts';

export const API_URL = 'http://api.test/api/v1';
export const PANEL_URL = 'http://panel.test';
export const TOKEN = 'token-1';

export interface RecordedRequest {
  method: string;
  /** Ścieżka bez prefiksu `/api/v1`, np. `/tournaments/12/teams`. */
  path: string;
  query: URLSearchParams;
  body: unknown;
  authorization: string | null;
}

export type Handler = (request: RecordedRequest) => Response | Promise<Response>;

/** Trasy po kluczu `METODA /ścieżka`, z konkretnymi identyfikatorami. */
export type Routes = Record<string, Handler>;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Atrapa Laravela na poziomie `fetch`. Klient z kontraktu łapie
 * `globalThis.fetch` przy tworzeniu, więc atrapę podmienia się globalnie przed
 * `createServer`. Żądanie bez trasy nie rzuca (to wyglądałoby jak awaria sieci),
 * tylko trafia do `unhandled`, a `connect` pilnuje, żeby lista została pusta.
 */
export function fakeBackend(routes: Routes) {
  const requests: RecordedRequest[] = [];
  const unhandled: string[] = [];

  async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const recorded: RecordedRequest = {
      method: request.method,
      path: url.pathname.replace(/^\/api\/v1/, ''),
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      authorization: request.headers.get('Authorization'),
    };
    requests.push(recorded);

    const key = `${recorded.method} ${recorded.path}`;
    const handler = routes[key];
    if (!handler) {
      unhandled.push(key);
      return json(501, { message: `Atrapa nie zna trasy ${key}` });
    }
    return handler(recorded);
  }

  return {
    fetch,
    requests,
    unhandled,
    /** Żądania pod daną trasę, w kolejności wysłania. */
    calls(key: string) {
      return requests.filter((request) => `${request.method} ${request.path}` === key);
    },
  };
}

export type FakeBackend = ReturnType<typeof fakeBackend>;

export const SPORTS = [
  { id: 1, code: 'football', name: 'Piłka nożna' },
  { id: 2, code: 'basketball', name: 'Koszykówka' },
  { id: 3, code: 'volleyball', name: 'Siatkówka' },
];

/** Szczęśliwa ścieżka: turniej 12 (piłka nożna) z fazą ligi 34. Testy nadpisują wybrane trasy. */
export function happyRoutes(): Routes {
  let nextTeamId = 100;
  return {
    'POST /login': () => json(200, { data: { token: TOKEN, user: { id: 1 } } }),
    'GET /sports': () => json(200, { data: SPORTS }),
    'POST /tournaments': ({ body }) =>
      json(201, { data: apiTournament({ name: (body as { name: string }).name }) }),
    'GET /tournaments/12/stages': () =>
      json(200, { data: [{ id: 34, type: 'league', name: 'Faza zasadnicza', order: 1, groups: [] }] }),
    'POST /tournaments/12/teams': ({ body }) =>
      json(201, { data: apiTeam(nextTeamId++, (body as { name: string }).name) }),
    'POST /stages/34/schedule': () => json(201, { data: { roundsCount: 3, matchesCount: 6 } }),
    'POST /stages/34/schedule/dates': () => json(200, { data: { matchesCount: 6, collisionsCount: 0 } }),
    'GET /tournaments/12/matches': () => json(200, { data: [], meta: { currentPage: 1, lastPage: 1, perPage: 200, total: 0 } }),
  };
}

/** Mecz z API w pełnym kształcie `AdminMatch`; testy nadpisują to, co sprawdzają. */
export function apiMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    stageId: 34,
    groupId: null,
    round: { id: 501, name: 'Kolejka 1', order: 1 },
    matchNumber: 1,
    homeTeam: { id: 100, name: 'Wilki Bemowo', logoUrl: null },
    awayTeam: { id: 101, name: 'Sokoły Ursus', logoUrl: null },
    homeScore: null,
    awayScore: null,
    sets: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    kickoffAt: null,
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    livePeriod: null,
    periodStartedAt: null,
    onBreak: false,
    collisions: [],
    ...overrides,
  };
}

/** Turniej z API w pełnym kształcie `Tournament`. */
export function apiTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    name: 'Liga Osiedlowa',
    slug: 'liga-osiedlowa',
    status: 'draft',
    sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
    branding: { logoUrl: null, primaryColor: '#0F766E' },
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['points', 'head_to_head', 'score_diff'],
    matchDuration: 90,
    periods: { count: 2, minutes: 45 },
    setFormat: null,
    teamsCount: 0,
    registration: { open: false, deadline: null, pendingCount: 0 },
    createdAt: '2026-11-01T10:00:00+00:00',
    updatedAt: '2026-11-01T10:00:00+00:00',
    ...overrides,
  };
}

export function apiTeam(id: number, name: string, overrides: Record<string, unknown> = {}) {
  return { id, tournamentId: 12, name, logoUrl: null, groupId: null, playersCount: 0, scheduledMatchesCount: 0, ...overrides };
}

export const page = (data: unknown[]) => ({
  data,
  meta: { currentPage: 1, lastPage: 1, perPage: 50, total: data.length },
});

export const validation = (field: string, message: string) => json(422, { message, errors: { [field]: [message] } });

export async function connect(routes: Routes = happyRoutes()) {
  const backend = fakeBackend(routes);
  vi.stubGlobal('fetch', backend.fetch);

  const server = createServer({
    apiUrl: API_URL,
    panelUrl: PANEL_URL,
    email: 'dawid@example.com',
    password: 'tajnehaslo123',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);

  onTestFinished(async () => {
    await client.close();
    vi.unstubAllGlobals();
    expect(backend.unhandled, 'żądania bez trasy w atrapie').toEqual([]);
  });

  return {
    client,
    backend,
    call: (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }),
  };
}

export function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((item) => item.text ?? '').join('\n');
}
