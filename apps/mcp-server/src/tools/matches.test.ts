import { describe, expect, it } from 'vitest';
import { apiMatch, connect, happyRoutes, json, page, textOf, validation } from '../test/harness.ts';

/** PATCH meczu, który odsyła mecz ze zmianami z ciała, jak robi to API. */
function echoMatch(base: Record<string, unknown> = {}) {
  return ({ body }: { body: unknown }) => json(200, { data: apiMatch({ ...base, ...(body as object) }) });
}

describe('set_match_result', () => {
  it('kończy mecz wynikiem i zawsze wysyła karne, jako null gdy ich nie ma', async () => {
    const { call, backend } = await connect({ ...happyRoutes(), 'PATCH /matches/1': echoMatch() });

    const result = await call('set_match_result', { matchId: 1, homeScore: 2, awayScore: 1 });

    expect(backend.calls('PATCH /matches/1')[0].body).toEqual({
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      homePenalties: null,
      awayPenalties: null,
    });
    expect(result.structuredContent).toMatchObject({ status: 'finished', homeScore: 2, awayScore: 1 });
    expect(textOf(result)).toContain('Wilki Bemowo – Sokoły Ursus, 2:1, zakończony');
  });

  it('remis w pucharze z karnymi mówi, dokąd przechodzi zwycięzca', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'PATCH /matches/1': echoMatch({ winnerToMatchId: 7 }),
    });

    const result = await call('set_match_result', {
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      homePenalties: 4,
      awayPenalties: 3,
    });

    const text = textOf(result);
    expect(text).toContain('1:1, karne 4:3');
    expect(text).toContain('Zwycięzca przechodzi do meczu #7.');
  });

  it('w siatkówce wysyła same sety, bez wyniku i karnych', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /matches/1': () =>
        json(200, {
          data: apiMatch({
            status: 'finished',
            homeScore: 2,
            awayScore: 0,
            sets: [
              { home: 25, away: 20 },
              { home: 25, away: 18 },
            ],
          }),
        }),
    });

    const result = await call('set_match_result', {
      matchId: 1,
      sets: [
        { home: 25, away: 20 },
        { home: 25, away: 18 },
      ],
    });

    expect(backend.calls('PATCH /matches/1')[0].body).toEqual({
      status: 'finished',
      sets: [
        { home: 25, away: 20 },
        { home: 25, away: 18 },
      ],
    });
    expect(textOf(result)).toContain('2:0 (25:20, 25:18)');
  });

  it('sety razem z wynikiem albo sam wynik gospodarzy to błąd bez zapisu', async () => {
    const { call, backend } = await connect();

    const mixed = await call('set_match_result', { matchId: 1, homeScore: 2, sets: [{ home: 25, away: 20 }] });
    const half = await call('set_match_result', { matchId: 1, homeScore: 2 });

    expect(mixed.isError).toBe(true);
    expect(half.isError).toBe(true);
    expect(backend.calls('PATCH /matches/1')).toEqual([]);
  });

  it('status live zapisuje wynik meczu, który trwa', async () => {
    const { call, backend } = await connect({ ...happyRoutes(), 'PATCH /matches/1': echoMatch() });

    await call('set_match_result', { matchId: 1, homeScore: 0, awayScore: 0, status: 'live' });

    expect(backend.calls('PATCH /matches/1')[0].body).toMatchObject({ status: 'live', homeScore: 0, awayScore: 0 });
  });
});

describe('clear_match_result', () => {
  it('w sporcie z setami kończy na jednym zapisie z pustymi setami', async () => {
    const { call, backend } = await connect({ ...happyRoutes(), 'PATCH /matches/1': echoMatch({ sets: [] }) });

    const result = await call('clear_match_result', { matchId: 1 });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('PATCH /matches/1').map((request) => request.body)).toEqual([{ status: 'scheduled', sets: [] }]);
  });

  it('w sporcie bez setów po odmowie pod kluczem sets czyści wynik i karne', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /matches/1': (request) =>
        'sets' in (request.body as object)
          ? validation('sets', 'Wyniki setów wpisuje się tylko w sporcie z setami.')
          : echoMatch()(request),
    });

    const result = await call('clear_match_result', { matchId: 1 });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('PATCH /matches/1').map((request) => request.body)).toEqual([
      { status: 'scheduled', sets: [] },
      { status: 'scheduled', homeScore: null, awayScore: null, homePenalties: null, awayPenalties: null },
    ]);
    expect(result.structuredContent).toMatchObject({ status: 'scheduled', homeScore: null });
  });

  it('odmowę z innego powodu (mecz ma zdarzenia) oddaje od razu, bez drugiej próby', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /matches/1': () => validation('status', 'Mecz ma zdarzenia. Usuń je, zanim cofniesz mecz do zaplanowanych.'),
    });

    const result = await call('clear_match_result', { matchId: 1 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Mecz ma zdarzenia');
    expect(backend.calls('PATCH /matches/1')).toHaveLength(1);
  });
});

describe('update_match', () => {
  it('termin zamienia na chwilę z offsetem warszawskim, a null usuwa obiekt', async () => {
    const { call, backend } = await connect({ ...happyRoutes(), 'PATCH /matches/1': echoMatch() });

    await call('update_match', { matchId: 1, kickoff: '2026-11-15 17:30', venueId: null });

    expect(backend.calls('PATCH /matches/1')[0].body).toEqual({
      kickoffAt: '2026-11-15T17:30:00+01:00',
      venueId: null,
    });
  });

  it('zgłasza kolizje z innymi meczami, ale zapis przechodzi', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'PATCH /matches/1': echoMatch({ collisions: [{ type: 'venue', matchId: 5 }] }),
    });

    const result = await call('update_match', { matchId: 1, venueId: 3 });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('#5 (obiekt)');
  });

  it('bez pól do zmiany nic nie wysyła', async () => {
    const { call, backend } = await connect();

    const result = await call('update_match', { matchId: 1 });

    expect(result.isError).toBe(true);
    expect(backend.calls('PATCH /matches/1')).toEqual([]);
  });
});

describe('list_matches', () => {
  it('przekazuje filtry, a w tekście podaje id meczów i wyniki', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/matches': () =>
        json(200, page([apiMatch({ id: 3, status: 'finished', homeScore: 3, awayScore: 0, kickoffAt: '2026-11-01T17:00:00+00:00' })])),
    });

    const result = await call('list_matches', { tournamentId: 12, stageId: 34, status: 'finished' });

    const query = backend.calls('GET /tournaments/12/matches')[0].query;
    expect(query.get('stageId')).toBe('34');
    expect(query.get('status')).toBe('finished');
    expect(query.get('perPage')).toBe('50');
    expect(textOf(result)).toContain('#3 Kolejka 1: Wilki Bemowo – Sokoły Ursus, 3:0, zakończony, 2026-11-01 18:00');
  });
});

describe('add_match_events', () => {
  it('wysyła zawodnika i minutę jako null, gdy ich nie ma, a doliczony czas tylko gdy podany', async () => {
    let nextId = 900;
    const { call, backend } = await connect({
      ...happyRoutes(),
      'POST /matches/1/events': ({ body }) => {
        const event = body as { type: string; teamId: number; playerId: number | null; minute: number | null };
        return json(201, {
          data: {
            id: nextId++,
            type: event.type,
            typeLabel: event.type === 'goal' ? 'Gol' : 'Żółta kartka',
            team: { id: event.teamId, name: 'Wilki Bemowo', logoUrl: null },
            player: event.playerId ? { id: event.playerId, name: 'Jan Kowalski' } : null,
            minute: event.minute,
            addedTime: (body as { addedTime?: number }).addedTime ?? null,
          },
        });
      },
    });

    const result = await call('add_match_events', {
      matchId: 1,
      events: [
        { type: 'goal', teamId: 100, playerId: 500, minute: 45, addedTime: 2 },
        { type: 'yellow_card', teamId: 100 },
      ],
    });

    expect(backend.calls('POST /matches/1/events').map((request) => request.body)).toEqual([
      { type: 'goal', teamId: 100, playerId: 500, minute: 45, addedTime: 2 },
      { type: 'yellow_card', teamId: 100, playerId: null, minute: null },
    ]);
    expect(textOf(result)).toContain("Gol 45+2': Jan Kowalski (Wilki Bemowo), id 900");
  });

  it('zdarzenie odrzucone (mecz zaplanowany) raportuje z komunikatem API', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /matches/1/events': () => validation('match', 'Mecz zaplanowany nie ma zdarzeń.'),
    });

    const result = await call('add_match_events', { matchId: 1, events: [{ type: 'goal', teamId: 100, minute: 12 }] });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("goal 12': Mecz zaplanowany nie ma zdarzeń.");
  });
});
