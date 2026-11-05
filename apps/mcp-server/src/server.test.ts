import { describe, expect, it } from 'vitest';
import { API_URL, connect, happyRoutes, json, TOKEN, textOf } from './test/harness.ts';

describe('tools/list', () => {
  it('wystawia trzy narzędzia, a tylko generowanie terminarza jest destrukcyjne', async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(Object.keys(byName).sort()).toEqual(['add_teams', 'create_tournament', 'generate_schedule']);
    expect(byName.create_tournament.annotations?.destructiveHint).toBe(false);
    expect(byName.add_teams.annotations?.destructiveHint).toBe(false);
    expect(byName.generate_schedule.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false });
  });
});

describe('create_tournament', () => {
  it('zakłada szkic ligi z identyfikatorem sportu z API i oddaje fazę ligi oraz link do panelu', async () => {
    const { call, backend } = await connect();

    const result = await call('create_tournament', { name: 'Liga Jesienna', sport: 'volleyball' });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /tournaments')[0]).toMatchObject({
      body: { name: 'Liga Jesienna', sportId: 3, format: 'league' },
      authorization: `Bearer ${TOKEN}`,
    });
    expect(result.structuredContent).toEqual({
      id: 12,
      name: 'Liga Jesienna',
      stageId: 34,
      status: 'draft',
      panelUrl: 'http://panel.test/tournaments/12',
    });
    expect(textOf(result)).toContain('http://panel.test/tournaments/12');
  });

  it('na sport spoza listy odpowiada błędem z kodami dostępnymi w API i niczego nie zakłada', async () => {
    const { call, backend } = await connect();

    const result = await call('create_tournament', { name: 'Liga', sport: 'handball' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('handball');
    expect(textOf(result)).toContain('football, basketball, volleyball');
    expect(backend.calls('POST /tournaments')).toEqual([]);
  });
});

describe('błędy API', () => {
  it('przepuszcza 422 do agenta z komunikatem i błędami pól', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /tournaments': () =>
        json(422, {
          message: 'Pole nazwa nie może być dłuższe niż 160 znaków. (i jeszcze 1 błąd)',
          errors: {
            name: ['Pole nazwa nie może być dłuższe niż 160 znaków.'],
            sportId: ['Wybrany sport jest nieprawidłowy.'],
          },
        }),
    });

    const result = await call('create_tournament', { name: 'x'.repeat(200), sport: 'football' });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('Pole nazwa nie może być dłuższe niż 160 znaków. (i jeszcze 1 błąd)');
    expect(text).toContain('name: Pole nazwa nie może być dłuższe niż 160 znaków.');
    expect(text).toContain('sportId: Wybrany sport jest nieprawidłowy.');
  });

  it('po 401 loguje się ponownie i powtarza żądanie z nowym tokenem', async () => {
    const tokens = ['wygasly', 'swiezy'];
    const { call, backend } = await connect({
      ...happyRoutes(),
      'POST /login': () => json(200, { data: { token: tokens.shift(), user: { id: 1 } } }),
      'GET /sports': ({ authorization }) =>
        authorization === 'Bearer swiezy'
          ? json(200, { data: [{ id: 1, code: 'football', name: 'Piłka nożna' }] })
          : json(401, { message: 'Unauthenticated.' }),
    });

    const result = await call('create_tournament', { name: 'Liga', sport: 'football' });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /login')).toHaveLength(2);
    expect(backend.calls('GET /sports').map((request) => request.authorization)).toEqual([
      'Bearer wygasly',
      'Bearer swiezy',
    ]);
    expect(backend.calls('POST /tournaments')[0].authorization).toBe('Bearer swiezy');
  });

  it('drugi 401 z rzędu kończy narzędzie błędem, bez kolejnych prób', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /sports': () => json(401, { message: 'Unauthenticated.' }),
    });

    const result = await call('create_tournament', { name: 'Liga', sport: 'football' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('401');
    expect(backend.calls('POST /login')).toHaveLength(2);
    expect(backend.calls('GET /sports')).toHaveLength(2);
  });

  it('gdy backend nie odpowiada, mówi pod jakim adresem go szukał, bez stack trace', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /login': () => {
        throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:8000') });
      },
    });

    const result = await call('create_tournament', { name: 'Liga', sport: 'football' });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain(`Backend nie odpowiada pod ${API_URL}`);
    expect(text).toContain('TOURNAMENT_API_URL');
    expect(text).not.toMatch(/\n\s+at /);
  });
});


describe('add_teams', () => {
  it('dodaje drużyny po kolei w podanej kolejności', async () => {
    const { call, backend } = await connect();

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany'] });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /tournaments/12/teams').map((request) => request.body)).toEqual([
      { name: 'Wilki Bemowo' },
      { name: 'Sokoły Ursus' },
      { name: 'Orły Bielany' },
    ]);
    expect(result.structuredContent).toEqual({
      added: [
        { id: 100, name: 'Wilki Bemowo' },
        { id: 101, name: 'Sokoły Ursus' },
        { id: 102, name: 'Orły Bielany' },
      ],
      rejected: [],
    });
  });

  it('po odrzuceniu drużyny idzie dalej i raportuje odrzuconą z komunikatem 422, bez błędu narzędzia', async () => {
    const taken = 'Wilki Bemowo';
    const routes = happyRoutes();
    const addTeam = routes['POST /tournaments/12/teams'];
    const { call, backend } = await connect({
      ...routes,
      'POST /tournaments/12/teams': (request) =>
        (request.body as { name: string }).name === taken
          ? json(422, {
              message: 'Drużyna o tej nazwie już jest w turnieju.',
              errors: { name: ['Drużyna o tej nazwie już jest w turnieju.'] },
            })
          : addTeam(request),
    });

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus'] });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /tournaments/12/teams')).toHaveLength(2);
    expect(result.structuredContent).toEqual({
      added: [{ id: 100, name: 'Sokoły Ursus' }],
      rejected: [{ name: 'Wilki Bemowo', message: 'Drużyna o tej nazwie już jest w turnieju.' }],
    });
    expect(textOf(result)).toContain('Wilki Bemowo');
  });

  it('gdy nie dodało żadnej drużyny, kończy się błędem z powodami odrzuceń', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /tournaments/12/teams': () =>
        json(422, {
          message: 'Turniej ma rozegrane mecze, więc nie przyjmuje nowych drużyn.',
          errors: { teams: ['Turniej ma rozegrane mecze, więc nie przyjmuje nowych drużyn.'] },
        }),
    });

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus'] });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('Wilki Bemowo');
    expect(text).toContain('Sokoły Ursus');
    expect(text).toContain('Turniej ma rozegrane mecze, więc nie przyjmuje nowych drużyn.');
  });
});


describe('generate_schedule', () => {
  it('generuje jedną rundę i rozkłada kolejki co 7 dni od 18:00 czasu warszawskiego, bez obiektów', async () => {
    const { call, backend } = await connect();

    const result = await call('generate_schedule', { tournamentId: 12, startDate: '2026-11-01' });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /stages/34/schedule')[0].body).toEqual({ meetings: 1 });
    expect(backend.calls('POST /stages/34/schedule/dates')[0].body).toEqual({
      mode: 'interval',
      startAt: '2026-11-01T18:00:00+01:00',
      timeZone: 'Europe/Warsaw',
      intervalDays: 7,
    });
    const matches = backend.calls('GET /tournaments/12/matches')[0];
    expect(matches.query.get('stageId')).toBe('34');
    expect(matches.query.get('perPage')).toBe('200');
  });

  it('pokazuje kolejki z parami i datami w czasie warszawskim, link do terminarza i przypomnienie o publikacji', async () => {
    const match = (id: number, round: number, home: string, away: string, kickoffAt: string) => ({
      id,
      stageId: 34,
      round: { id: 500 + round, name: `Kolejka ${round}`, order: round },
      matchNumber: id,
      homeTeam: { id: id * 10, name: home, logoUrl: null },
      awayTeam: { id: id * 10 + 1, name: away, logoUrl: null },
      kickoffAt,
    });
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/matches': () =>
        json(200, {
          data: [
            // 23:30 UTC 31 października to już 1 listopada w Warszawie.
            match(1, 1, 'Wilki Bemowo', 'Sokoły Ursus', '2026-10-31T23:30:00+00:00'),
            match(2, 1, 'Orły Bielany', 'Lwy Wola', '2026-10-31T23:30:00+00:00'),
            match(3, 2, 'Sokoły Ursus', 'Orły Bielany', '2026-11-07T23:30:00+00:00'),
          ],
          meta: { currentPage: 1, lastPage: 1, perPage: 200, total: 3 },
        }),
    });

    const result = await call('generate_schedule', { tournamentId: 12, startDate: '2026-11-01', kickoffTime: '00:30' });

    expect(result.structuredContent).toMatchObject({
      rounds: [
        {
          name: 'Kolejka 1',
          matches: [
            { home: 'Wilki Bemowo', away: 'Sokoły Ursus', kickoff: '2026-11-01 00:30' },
            { home: 'Orły Bielany', away: 'Lwy Wola', kickoff: '2026-11-01 00:30' },
          ],
        },
        { name: 'Kolejka 2', matches: [{ home: 'Sokoły Ursus', away: 'Orły Bielany', kickoff: '2026-11-08 00:30' }] },
      ],
      panelUrl: 'http://panel.test/tournaments/12/schedule',
    });
    const text = textOf(result);
    expect(text).toContain('niedziela, 1 listopada 2026 00:30');
    expect(text).toContain('Wilki Bemowo – Sokoły Ursus');
    expect(text).toContain('http://panel.test/tournaments/12/schedule');
    expect(text).toContain('szkic');
    expect(text).toContain('Opublikuj');
  });

  it('liczy offset na dzień startu: październik przed zmianą czasu to jeszcze +02:00', async () => {
    const { call, backend } = await connect();

    await call('generate_schedule', { tournamentId: 12, startDate: '2026-10-01' });

    expect(backend.calls('POST /stages/34/schedule/dates')[0].body).toMatchObject({
      startAt: '2026-10-01T18:00:00+02:00',
    });
  });

  it('przekazuje rewanże, odstęp i godzinę podane przez agenta', async () => {
    const { call, backend } = await connect();

    await call('generate_schedule', {
      tournamentId: 12,
      startDate: '2026-11-01',
      kickoffTime: '10:30',
      intervalDays: 14,
      meetings: 2,
    });

    expect(backend.calls('POST /stages/34/schedule')[0].body).toEqual({ meetings: 2 });
    expect(backend.calls('POST /stages/34/schedule/dates')[0].body).toEqual({
      mode: 'interval',
      startAt: '2026-11-01T10:30:00+01:00',
      timeZone: 'Europe/Warsaw',
      intervalDays: 14,
    });
  });

  it('turniej bez fazy ligi kończy się błędem, zanim cokolwiek nadpisze', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/stages': () =>
        json(200, { data: [{ id: 35, type: 'knockout', name: 'Puchar', order: 1, groups: [] }] }),
    });

    const result = await call('generate_schedule', { tournamentId: 12, startDate: '2026-11-01' });

    expect(result.isError).toBe(true);
    expect(backend.requests.filter((request) => request.method === 'POST' && request.path !== '/login')).toEqual([]);
  });
});

