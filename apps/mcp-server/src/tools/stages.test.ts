import { describe, expect, it } from 'vitest';
import { apiMatch, apiTeam, connect, happyRoutes, json, page, textOf } from '../test/harness.ts';

const GROUP_STAGE = { id: 40, type: 'group', name: 'Faza grupowa', order: 1, groups: [] };
const KNOCKOUT_STAGE = { id: 41, type: 'knockout', name: 'Faza pucharowa', order: 2, groups: [] };

const TEAM_NAMES = ['Wilki', 'Sokoły', 'Orły', 'Lwy', 'Rysie', 'Żubry', 'Jastrzębie'];
const teams = (count: number) => TEAM_NAMES.slice(0, count).map((name, index) => apiTeam(100 + index, name));

describe('generate_schedule', () => {
  it('w lidze układa same pary, bez nadawania terminów', async () => {
    const { call, backend } = await connect();

    const result = await call('generate_schedule', { tournamentId: 12, meetings: 2 });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /stages/34/schedule')[0].body).toEqual({ meetings: 2 });
    expect(backend.calls('POST /stages/34/schedule/dates')).toEqual([]);
    expect(textOf(result)).toContain('3 kolejki, 6 meczów, jeszcze bez terminów');
  });

  it('w turnieju z grupami układa terminarz fazy grupowej i podpisuje mecze grupą', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/stages': () =>
        json(200, {
          data: [{ ...GROUP_STAGE, groups: [{ id: 7, name: 'Grupa A', order: 1, qualifiers: 2 }] }, KNOCKOUT_STAGE],
        }),
      'POST /stages/40/schedule': () => json(201, { data: { roundsCount: 1, matchesCount: 1 } }),
      'GET /tournaments/12/matches': () => json(200, page([apiMatch({ id: 9, stageId: 40, groupId: 7 })])),
    });

    const result = await call('generate_schedule', { tournamentId: 12 });

    expect(backend.calls('POST /stages/40/schedule')[0].body).toEqual({ meetings: 1 });
    expect(backend.calls('GET /tournaments/12/matches')[0].query.get('stageId')).toBe('40');
    expect(textOf(result)).toContain('#9 Wilki Bemowo – Sokoły Ursus (Grupa A)');
  });

  it('turniej z samą fazą pucharową dostaje błąd, zanim cokolwiek nadpisze', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/stages': () => json(200, { data: [KNOCKOUT_STAGE] }),
    });

    const result = await call('generate_schedule', { tournamentId: 12 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Faza pucharowa (knockout)');
    expect(backend.requests.filter((request) => request.method !== 'GET' && request.path !== '/login')).toEqual([]);
  });

  it('dużej fazy nie wypisuje w odpowiedzi, tylko podaje liczby', async () => {
    const matches = Array.from({ length: 121 }, (_, index) => apiMatch({ id: index + 1 }));
    const { call } = await connect({
      ...happyRoutes(),
      'POST /stages/34/schedule': () => json(201, { data: { roundsCount: 15, matchesCount: 121 } }),
      'GET /tournaments/12/matches': () => json(200, page(matches)),
    });

    const result = await call('generate_schedule', { tournamentId: 12 });

    expect(result.structuredContent).toMatchObject({ matchesCount: 121, rounds: [] });
    expect(textOf(result)).toContain('list_matches');
  });
});

describe('set_schedule_dates', () => {
  it('w trybie interval domyślnie co 7 dni od 18:00, z offsetem z dnia startu', async () => {
    const { call, backend } = await connect();

    await call('set_schedule_dates', { tournamentId: 12, stageId: 34, startDate: '2026-10-01' });

    expect(backend.calls('POST /stages/34/schedule/dates')[0].body).toEqual({
      mode: 'interval',
      startAt: '2026-10-01T18:00:00+02:00',
      timeZone: 'Europe/Warsaw',
      intervalDays: 7,
    });
  });

  it('w trybie continuous wysyła koniec dnia, obiekty i kolejkę startową, a nie wysyła odstępu', async () => {
    const { call, backend } = await connect();

    await call('set_schedule_dates', {
      tournamentId: 12,
      stageId: 34,
      startDate: '2026-11-07',
      kickoffTime: '09:00',
      mode: 'continuous',
      dayEndTime: '17:00',
      venueIds: [3, 4],
      fromRound: 2,
    });

    expect(backend.calls('POST /stages/34/schedule/dates')[0].body).toEqual({
      mode: 'continuous',
      startAt: '2026-11-07T09:00:00+01:00',
      timeZone: 'Europe/Warsaw',
      dayEndTime: '17:00',
      venueIds: [3, 4],
      fromRound: 2,
    });
  });

  it('parametr z innego trybu to błąd bez zapisu', async () => {
    const { call, backend } = await connect();

    const result = await call('set_schedule_dates', {
      tournamentId: 12,
      stageId: 34,
      startDate: '2026-11-07',
      mode: 'continuous',
      intervalDays: 3,
    });

    expect(result.isError).toBe(true);
    expect(backend.calls('POST /stages/34/schedule/dates')).toEqual([]);
  });

  it('faza spoza turnieju to błąd bez zapisu', async () => {
    const { call, backend } = await connect();

    const result = await call('set_schedule_dates', { tournamentId: 12, stageId: 999, startDate: '2026-11-07' });

    expect(result.isError).toBe(true);
    expect(backend.requests.some((request) => request.path.includes('/schedule/dates'))).toBe(false);
  });

  it('pokazuje kolejki z dniem słownie i zgłasza kolizje jako ostrzeżenie', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /stages/34/schedule/dates': () => json(200, { data: { matchesCount: 2, collisionsCount: 1 } }),
      'GET /tournaments/12/matches': () =>
        json(200, {
          ...page([
            // 23:30 UTC 31 października to już 1 listopada w Warszawie.
            apiMatch({ id: 1, kickoffAt: '2026-10-31T23:30:00+00:00', venue: { id: 3, name: 'Orlik' } }),
            apiMatch({
              id: 2,
              kickoffAt: '2026-11-01T01:00:00+00:00',
              homeTeam: { id: 102, name: 'Orły Bielany', logoUrl: null },
              awayTeam: { id: 103, name: 'Lwy Wola', logoUrl: null },
            }),
          ]),
        }),
    });

    const result = await call('set_schedule_dates', { tournamentId: 12, stageId: 34, startDate: '2026-11-01', kickoffTime: '00:30' });

    expect(result.structuredContent).toMatchObject({
      collisionsCount: 1,
      rounds: [
        {
          name: 'Kolejka 1',
          startsAt: '2026-11-01 00:30',
          matches: [
            { id: 1, kickoff: '2026-11-01 00:30', venue: 'Orlik' },
            { id: 2, kickoff: '2026-11-01 02:00', venue: null },
          ],
        },
      ],
    });
    const text = textOf(result);
    expect(text).toContain('Kolejka 1, niedziela, 1 listopada 2026 00:30:');
    expect(text).toContain('#1 Wilki Bemowo – Sokoły Ursus (Orlik)');
    expect(text).toContain('#2 Orły Bielany – Lwy Wola (2026-11-01 02:00)');
    expect(text).toContain('Kolizji');
  });
});

describe('draw_groups', () => {
  it('każda drużyna trafia do dokładnie jednej grupy, a rozmiary różnią się najwyżej o jeden', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/stages': () => json(200, { data: [GROUP_STAGE, KNOCKOUT_STAGE] }),
      'GET /tournaments/12/teams': () => json(200, { data: teams(7) }),
      'PUT /stages/40/groups': ({ body }) => {
        const groups = (body as { groups: Array<{ name: string; qualifiers: number }> }).groups;
        return json(200, {
          data: { ...GROUP_STAGE, groups: groups.map((group, index) => ({ id: 70 + index, order: index + 1, ...group })) },
        });
      },
    });

    const result = await call('draw_groups', { tournamentId: 12, groupsCount: 2, qualifiers: 2 });

    const sent = (backend.calls('PUT /stages/40/groups')[0].body as {
      groups: Array<{ name: string; teamIds: number[]; qualifiers: number }>;
    }).groups;
    expect(sent.map((group) => group.name)).toEqual(['Grupa A', 'Grupa B']);
    expect(sent.every((group) => group.qualifiers === 2)).toBe(true);
    expect(sent.flatMap((group) => group.teamIds).sort()).toEqual([100, 101, 102, 103, 104, 105, 106]);
    expect(sent.map((group) => group.teamIds.length).sort()).toEqual([3, 4]);
    expect(result.structuredContent).toMatchObject({ stageId: 40, groups: [{ id: 70, name: 'Grupa A' }, { id: 71 }] });
  });

  it('za mało drużyn na tyle grup to błąd bez zapisu', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/teams': () => json(200, { data: teams(5) }),
    });

    const result = await call('draw_groups', { tournamentId: 12, groupsCount: 3, qualifiers: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Najwięcej grup przy tej liczbie drużyn: 2');
    expect(backend.requests.some((request) => request.method === 'PUT')).toBe(false);
  });
});

describe('generate_bracket', () => {
  /** Drabinka 3 drużyn: rozstawiona z numerem 1 ma wolny los, w pierwszej rundzie grają 2 i 3. */
  function bracketRoutes(opening: { home: number; away: number }) {
    const names = new Map(teams(7).map((team) => [team.id, team.name]));
    return {
      ...happyRoutes(),
      'GET /tournaments/12/stages': () => json(200, { data: [GROUP_STAGE, KNOCKOUT_STAGE] }),
      'GET /tournaments/12/teams': () => json(200, { data: teams(3) }),
      'POST /stages/41/bracket': () => json(201, { data: { roundsCount: 2, matchesCount: 2 } }),
      'GET /tournaments/12/matches': () =>
        json(
          200,
          page([
            apiMatch({
              id: 20,
              stageId: 41,
              round: { id: 600, name: 'Półfinał', order: 1 },
              homeTeam: { id: opening.home, name: names.get(opening.home), logoUrl: null },
              awayTeam: { id: opening.away, name: names.get(opening.away), logoUrl: null },
            }),
            apiMatch({ id: 21, stageId: 41, round: { id: 601, name: 'Finał', order: 2 }, homeTeam: null, awayTeam: null }),
          ]),
        ),
    };
  }

  it('from_groups bierze rozstawienie z API w jego kolejności i wylicza wolny los', async () => {
    const { call, backend } = await connect({
      ...bracketRoutes({ home: 100, away: 101 }),
      'GET /stages/41/bracket/seeding': () =>
        json(200, {
          data: [
            { teamId: 102, groupId: 7, position: 1 },
            { teamId: 100, groupId: 8, position: 1 },
            { teamId: 101, groupId: 7, position: 2 },
          ],
        }),
    });

    const result = await call('generate_bracket', { tournamentId: 12, seeding: 'from_groups', thirdPlaceMatch: false });

    expect(backend.calls('POST /stages/41/bracket')[0].body).toEqual({ teamIds: [102, 100, 101], thirdPlaceMatch: false });
    expect(result.structuredContent).toMatchObject({
      seeding: [
        { seed: 1, id: 102, name: 'Orły' },
        { seed: 2, id: 100 },
        { seed: 3, id: 101 },
      ],
      firstRound: [{ matchId: 20, home: 'Wilki', away: 'Sokoły' }],
      byes: [{ id: 102, name: 'Orły' }],
    });
    expect(textOf(result)).toContain('Wolny los: Orły.');
  });

  it('manual zachowuje podaną kolejność, a bez teamIds kończy się błędem bez zapisu', async () => {
    const { call, backend } = await connect(bracketRoutes({ home: 101, away: 102 }));

    const missing = await call('generate_bracket', { tournamentId: 12, seeding: 'manual' });
    await call('generate_bracket', { tournamentId: 12, seeding: 'manual', teamIds: [100, 102, 101], thirdPlaceMatch: true });

    expect(missing.isError).toBe(true);
    expect(backend.calls('POST /stages/41/bracket').map((request) => request.body)).toEqual([
      { teamIds: [100, 102, 101], thirdPlaceMatch: true },
    ]);
  });

  it('random bez teamIds tasuje wszystkie drużyny turnieju, każdą raz', async () => {
    const { call, backend } = await connect(bracketRoutes({ home: 100, away: 101 }));

    await call('generate_bracket', { tournamentId: 12, seeding: 'random' });

    const sent = (backend.calls('POST /stages/41/bracket')[0].body as { teamIds: number[] }).teamIds;
    expect([...sent].sort()).toEqual([100, 101, 102]);
  });

  it('from_groups z teamIds to sprzeczność: błąd bez zapisu', async () => {
    const { call, backend } = await connect(bracketRoutes({ home: 100, away: 101 }));

    const result = await call('generate_bracket', { tournamentId: 12, seeding: 'from_groups', teamIds: [100, 101] });

    expect(result.isError).toBe(true);
    expect(backend.calls('POST /stages/41/bracket')).toEqual([]);
  });
});
