import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Player, Team, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from './server';

export const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'draft',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  teamsCount: 2,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

export const WILKI: Team = {
  id: 3,
  tournamentId: TOURNAMENT.id,
  name: 'Wilki Bemowo',
  logoUrl: null,
  groupId: null,
  playersCount: 2,
};

/** Adres herbu po wgraniu; jak w przykładzie kontraktu, więc pod mockiem się nie ładuje. */
export const CREST_URL = 'http://localhost:8000/storage/tournaments/7/teams/3/herb.png';

export const SOKOLY: Team = { ...WILKI, id: 4, name: 'Sokoły Ursus', playersCount: 0 };

export const NOWAK: Player = { id: 11, teamId: WILKI.id, name: 'Marek Nowak', number: 9, position: 'napastnik' };
export const KOWAL: Player = { id: 12, teamId: WILKI.id, name: 'Piotr Kowal', number: null, position: null };

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+02:00' },
};

export function validationError(errors: Record<string, string[]>) {
  const message = Object.values(errors)[0]![0]!;
  return HttpResponse.json({ message, errors }, { status: 422 });
}

type Override = (request: Request) => Response | undefined | Promise<Response | undefined>;

/**
 * Turniej, jego drużyny i składy po stronie „serwera”. Zapis w handlerze zmienia
 * te tablice, więc odświeżony widok pokazuje stan po zapisie. `requests` liczy
 * żądania po metodzie i ścieżce (np. `GET /tournaments/7`), a `bodies` zbiera
 * ciała zapisów — asercja „nie poszło żadne żądanie” to brak wpisu. Ciało
 * multipart (herb) trafia tam jako `FormData`, reszta jako JSON.
 *
 * `override` podmienia odpowiedź jednego żądania (klucz jak w `requests`),
 * a `undefined` z niego oddaje głos domyślnemu handlerowi.
 */
export function serveTeams({
  teams: initialTeams = [WILKI, SOKOLY],
  players: initialPlayers = [NOWAK, KOWAL],
  override = {},
}: {
  teams?: Team[];
  players?: Player[];
  override?: Record<string, Override>;
} = {}) {
  const state = { teams: [...initialTeams], players: [...initialPlayers] };
  const requests: Record<string, number> = {};
  const bodies: Record<string, unknown[]> = {};

  function withCount(team: Team): Team {
    return { ...team, playersCount: state.players.filter((p) => p.teamId === team.id).length };
  }

  /** Handler, który liczy żądanie, zapisuje ciało i daje pierwszeństwo `override`. */
  function route(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    respond: (params: Record<string, string>, body: unknown) => Response,
  ) {
    return http[method](`${API}${path}`, async ({ request, params }) => {
      const resolved = path.replace(/:(\w+)/g, (_, key: string) => String(params[key]));
      const key = `${method.toUpperCase()} ${resolved}`;
      requests[key] = (requests[key] ?? 0) + 1;
      const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
      const body =
        method === 'post' || method === 'patch'
          ? await (multipart ? request.clone().formData() : request.clone().json())
          : undefined;
      if (body !== undefined) (bodies[key] ??= []).push(body);
      const custom = await override[key]?.(request);
      return custom ?? respond(params as Record<string, string>, body);
    });
  }

  const notFound = () => HttpResponse.json({ message: 'Zasób nie istnieje.' }, { status: 404 });

  function setLogo(teamId: number, logoUrl: string | null) {
    const index = state.teams.findIndex((t) => t.id === teamId);
    if (index < 0) return notFound();
    state.teams[index] = { ...state.teams[index]!, logoUrl };
    return HttpResponse.json({ data: withCount(state.teams[index]!) });
  }

  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    route('get', '/tournaments/:id', () =>
      HttpResponse.json({ data: { ...TOURNAMENT, teamsCount: state.teams.length } }),
    ),
    route('get', '/tournaments/:id/teams', () =>
      HttpResponse.json({ data: state.teams.map(withCount) }),
    ),
    route('post', '/tournaments/:id/teams', (_, body) => {
      const team: Team = { ...WILKI, id: 100 + state.teams.length, playersCount: 0, ...(body as object) };
      state.teams.push(team);
      return HttpResponse.json({ data: team }, { status: 201 });
    }),
    route('get', '/teams/:team', ({ team }) => {
      const found = state.teams.find((t) => t.id === Number(team));
      return found ? HttpResponse.json({ data: withCount(found) }) : notFound();
    }),
    route('patch', '/teams/:team', ({ team }, body) => {
      const index = state.teams.findIndex((t) => t.id === Number(team));
      if (index < 0) return notFound();
      state.teams[index] = { ...state.teams[index]!, ...(body as object) };
      return HttpResponse.json({ data: withCount(state.teams[index]!) });
    }),
    route('delete', '/teams/:team', ({ team }) => {
      state.teams = state.teams.filter((t) => t.id !== Number(team));
      state.players = state.players.filter((p) => p.teamId !== Number(team));
      return new HttpResponse(null, { status: 204 });
    }),
    route('post', '/teams/:team/logo', ({ team }) => setLogo(Number(team), CREST_URL)),
    // Idempotentne jak w kontrakcie: bez herbu też `200`.
    route('delete', '/teams/:team/logo', ({ team }) => setLogo(Number(team), null)),
    route('get', '/teams/:team/players', ({ team }) =>
      HttpResponse.json({ data: state.players.filter((p) => p.teamId === Number(team)) }),
    ),
    route('post', '/teams/:team/players', ({ team }, body) => {
      const player: Player = {
        id: 100 + state.players.length,
        teamId: Number(team),
        ...(body as Pick<Player, 'name' | 'number' | 'position'>),
      };
      state.players.push(player);
      return HttpResponse.json({ data: player }, { status: 201 });
    }),
    route('patch', '/players/:player', ({ player }, body) => {
      const index = state.players.findIndex((p) => p.id === Number(player));
      if (index < 0) return notFound();
      state.players[index] = { ...state.players[index]!, ...(body as object) };
      return HttpResponse.json({ data: state.players[index] });
    }),
    route('delete', '/players/:player', ({ player }) => {
      state.players = state.players.filter((p) => p.id !== Number(player));
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return { state, requests, bodies };
}

/**
 * Renderuje prawdziwe drzewo tras z `Toaster`, jak `main.tsx`. Zwraca router
 * (adres, na którym panel stanął) i szpiega `invalidateQueries`: unieważnienie
 * zapytania, którego żaden widok nie trzyma, nie wyśle żądania, więc samo
 * liczenie żądań by go nie wykryło.
 */
export function renderPanel(path: string) {
  setToken('1|token');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { router, invalidateQueries, user: userEvent.setup() };
}
