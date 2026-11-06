import { describe, expect, it } from 'vitest';
import { apiTeam, connect, happyRoutes, json, textOf, validation } from '../test/harness.ts';

describe('add_teams', () => {
  it('dodaje drużyny po kolei w podanej kolejności i oddaje ich id', async () => {
    const { call, backend } = await connect();

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany'] });

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
    expect(textOf(result)).toContain('Wilki Bemowo (id 100)');
  });

  it('po odrzuceniu drużyny idzie dalej i raportuje ją z komunikatem 422, bez błędu narzędzia', async () => {
    const routes = happyRoutes();
    const addTeam = routes['POST /tournaments/12/teams'];
    const { call, backend } = await connect({
      ...routes,
      'POST /tournaments/12/teams': (request) =>
        (request.body as { name: string }).name === 'Wilki Bemowo'
          ? validation('name', 'Drużyna o tej nazwie już jest w turnieju.')
          : addTeam(request),
    });

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus'] });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /tournaments/12/teams')).toHaveLength(2);
    expect(result.structuredContent).toEqual({
      added: [{ id: 100, name: 'Sokoły Ursus' }],
      rejected: [{ name: 'Wilki Bemowo', message: 'Drużyna o tej nazwie już jest w turnieju.' }],
    });
  });

  it('gdy nie dodało żadnej drużyny, kończy się błędem z powodami odrzuceń', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /tournaments/12/teams': () =>
        validation('teams', 'Turniej ma rozpoczęte mecze, więc nie przyjmuje nowych drużyn.'),
    });

    const result = await call('add_teams', { tournamentId: 12, names: ['Wilki Bemowo', 'Sokoły Ursus'] });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('- Wilki Bemowo: Turniej ma rozpoczęte mecze');
    expect(text).toContain('- Sokoły Ursus: Turniej ma rozpoczęte mecze');
  });

  it('gdy API padnie w połowie listy, mówi które drużyny już dodało, żeby agent ich nie dublował', async () => {
    const routes = happyRoutes();
    const addTeam = routes['POST /tournaments/12/teams'];
    const { call, backend } = await connect({
      ...routes,
      'POST /tournaments/12/teams': (request) =>
        (request.body as { name: string }).name === 'Orły Bielany' ? json(500, { message: 'Server Error' }) : addTeam(request),
    });

    const result = await call('add_teams', {
      tournamentId: 12,
      names: ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany', 'Lwy Wola'],
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('500');
    expect(text).toContain('Dodane: Wilki Bemowo (id 100); Sokoły Ursus (id 101).');
    expect(text).toContain('Niedodane: Orły Bielany; Lwy Wola.');
    // Po przerwaniu nie próbuje kolejnych pozycji.
    expect(backend.calls('POST /tournaments/12/teams')).toHaveLength(3);
  });
});

describe('delete_team', () => {
  it('mówi, ile meczów zaplanowanych zniknęło razem z drużyną', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /teams/100': () => json(200, { data: apiTeam(100, 'Wilki Bemowo', { scheduledMatchesCount: 6 }) }),
      'DELETE /teams/100': () => new Response(null, { status: 204 }),
    });

    const result = await call('delete_team', { teamId: 100 });

    expect(backend.calls('DELETE /teams/100')).toHaveLength(1);
    expect(result.structuredContent).toEqual({ id: 100, name: 'Wilki Bemowo', removedScheduledMatches: 6 });
    expect(textOf(result)).toContain('meczów zaplanowanych: 6');
  });
});

describe('add_players', () => {
  it('wysyła brakujący numer i pozycję jako null, a zajęty numer raportuje i idzie dalej', async () => {
    let nextId = 500;
    const { call, backend } = await connect({
      ...happyRoutes(),
      'POST /teams/100/players': ({ body }) => {
        const player = body as { name: string; number: number | null; position: string | null };
        return player.number === 9
          ? validation('number', 'Numer 9 nosi już inny zawodnik tej drużyny.')
          : json(201, { data: { id: nextId++, teamId: 100, ...player } });
      },
    });

    const result = await call('add_players', {
      teamId: 100,
      players: [
        { name: 'Jan Kowalski', number: 10, position: 'napastnik' },
        { name: 'Adam Nowak', number: 9 },
        { name: 'Piotr Wiśniewski' },
      ],
    });

    expect(backend.calls('POST /teams/100/players').map((request) => request.body)).toEqual([
      { name: 'Jan Kowalski', number: 10, position: 'napastnik' },
      { name: 'Adam Nowak', number: 9, position: null },
      { name: 'Piotr Wiśniewski', number: null, position: null },
    ]);
    expect(result.structuredContent).toEqual({
      added: [
        { id: 500, name: 'Jan Kowalski', number: 10, position: 'napastnik' },
        { id: 501, name: 'Piotr Wiśniewski', number: null, position: null },
      ],
      rejected: [{ name: 'Adam Nowak (nr 9)', message: 'Numer 9 nosi już inny zawodnik tej drużyny.' }],
    });
    expect(textOf(result)).toContain('Jan Kowalski (id 500, nr 10, napastnik)');
  });
});

describe('update_player', () => {
  it('null czyści numer, a pola nie podane nie jadą w ciele', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /players/500': () =>
        json(200, { data: { id: 500, teamId: 100, name: 'Jan Kowalski', number: null, position: 'napastnik' } }),
    });

    await call('update_player', { playerId: 500, number: null });

    expect(backend.calls('PATCH /players/500')[0].body).toEqual({ number: null });
  });

  it('bez pól do zmiany nic nie wysyła', async () => {
    const { call, backend } = await connect();

    const result = await call('update_player', { playerId: 500 });

    expect(result.isError).toBe(true);
    expect(backend.calls('PATCH /players/500')).toEqual([]);
  });
});
