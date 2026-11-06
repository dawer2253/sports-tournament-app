import { describe, expect, it } from 'vitest';
import { apiTeam, apiTournament, connect, happyRoutes, json, textOf, validation } from '../test/harness.ts';

const GROUPS_PLAYOFF_STAGES = [
  {
    id: 40,
    type: 'group',
    name: 'Faza grupowa',
    order: 1,
    groups: [
      { id: 7, name: 'Grupa A', order: 1, qualifiers: 2 },
      { id: 8, name: 'Grupa B', order: 2, qualifiers: 2 },
    ],
  },
  { id: 41, type: 'knockout', name: 'Faza pucharowa', order: 2, groups: [] },
];

describe('create_tournament', () => {
  it('zakłada szkic w wybranym formacie z id sportu z API i oddaje fazy z id', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/stages': () => json(200, { data: GROUPS_PLAYOFF_STAGES }),
    });

    const result = await call('create_tournament', { name: 'Puchar Jesieni', sport: 'volleyball', format: 'groups_playoff' });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('POST /tournaments')[0].body).toEqual({ name: 'Puchar Jesieni', sportId: 3, format: 'groups_playoff' });
    expect(result.structuredContent).toMatchObject({
      id: 12,
      format: 'groups_playoff',
      stages: [
        { id: 40, type: 'group', groups: [{ id: 7 }, { id: 8 }] },
        { id: 41, type: 'knockout' },
      ],
      panelUrl: 'http://panel.test/tournaments/12',
    });
    expect(textOf(result)).toContain('id 41');
  });

  it('na sport spoza listy odpowiada błędem z kodami z API i niczego nie zakłada', async () => {
    const { call, backend } = await connect();

    const result = await call('create_tournament', { name: 'Liga', sport: 'handball', format: 'league' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('football, basketball, volleyball');
    expect(backend.calls('POST /tournaments')).toEqual([]);
  });
});

describe('get_tournament', () => {
  it('wyprowadza format z faz i podpisuje drużyny nazwą grupy', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament({ teamsCount: 2 }) }),
      'GET /tournaments/12/stages': () => json(200, { data: GROUPS_PLAYOFF_STAGES }),
      'GET /tournaments/12/teams': () =>
        json(200, {
          data: [apiTeam(100, 'Wilki Bemowo', { groupId: 7, playersCount: 11 }), apiTeam(101, 'Sokoły Ursus', { groupId: 8 })],
        }),
    });

    const result = await call('get_tournament', { tournamentId: 12 });

    expect(result.structuredContent).toMatchObject({
      format: 'groups_playoff',
      teams: [
        { id: 100, name: 'Wilki Bemowo', groupId: 7, playersCount: 11 },
        { id: 101, name: 'Sokoły Ursus', groupId: 8, playersCount: 0 },
      ],
    });
    const text = textOf(result);
    expect(text).toContain('Wilki Bemowo (id 100, zawodników: 11, Grupa A)');
    expect(text).toContain('grupy, a potem puchar');
  });

  it('sama faza pucharowa to format knockout', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament() }),
      'GET /tournaments/12/stages': () =>
        json(200, { data: [{ id: 41, type: 'knockout', name: 'Faza pucharowa', order: 1, groups: [] }] }),
      'GET /tournaments/12/teams': () => json(200, { data: [] }),
    });

    const result = await call('get_tournament', { tournamentId: 12 });

    expect(result.structuredContent).toMatchObject({ format: 'knockout' });
  });
});

describe('update_tournament', () => {
  it('wysyła tylko podane pola, kolor w branding, a termin zapisów z offsetem warszawskim', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /tournaments/12': () => json(200, { data: apiTournament() }),
    });

    await call('update_tournament', {
      tournamentId: 12,
      name: 'Liga Zimowa',
      primaryColor: '#112233',
      registrationDeadline: '2026-07-01 12:00',
    });

    expect(backend.calls('PATCH /tournaments/12')[0].body).toEqual({
      name: 'Liga Zimowa',
      branding: { primaryColor: '#112233' },
      registration: { deadline: '2026-07-01T12:00:00+02:00' },
    });
  });

  it('null w terminie zapisów usuwa termin, a samo otwarcie zapisów nie rusza terminu', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /tournaments/12': () => json(200, { data: apiTournament() }),
    });

    await call('update_tournament', { tournamentId: 12, registrationDeadline: null });
    await call('update_tournament', { tournamentId: 12, registrationOpen: true });

    expect(backend.calls('PATCH /tournaments/12').map((request) => request.body)).toEqual([
      { registration: { deadline: null } },
      { registration: { open: true } },
    ]);
  });

  it('bez żadnego pola do zmiany kończy się błędem i nic nie wysyła', async () => {
    const { call, backend } = await connect();

    const result = await call('update_tournament', { tournamentId: 12 });

    expect(result.isError).toBe(true);
    expect(backend.calls('PATCH /tournaments/12')).toEqual([]);
  });
});

describe('set_tournament_status', () => {
  it('publikacja mówi, że turniej jest widoczny publicznie, i podaje slug', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'PATCH /tournaments/12': () => json(200, { data: apiTournament({ status: 'active' }) }),
    });

    const result = await call('set_tournament_status', { tournamentId: 12, status: 'active' });

    expect(backend.calls('PATCH /tournaments/12')[0].body).toEqual({ status: 'active' });
    expect(textOf(result)).toContain('widoczny na stronie publicznej (slug liga-osiedlowa)');
  });

  it('odmowę powrotu do szkicu oddaje z komunikatem API', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'PATCH /tournaments/12': () => validation('status', 'Turniej z rozpoczętym meczem nie wraca do szkicu.'),
    });

    const result = await call('set_tournament_status', { tournamentId: 12, status: 'draft' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Turniej z rozpoczętym meczem nie wraca do szkicu.');
  });
});

describe('delete_tournament', () => {
  it('204 bez treści to sukces z nazwą usuniętego turnieju', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament() }),
      'DELETE /tournaments/12': () => new Response(null, { status: 204 }),
    });

    const result = await call('delete_tournament', { tournamentId: 12 });

    expect(result.isError).toBeFalsy();
    expect(backend.calls('DELETE /tournaments/12')).toHaveLength(1);
    expect(result.structuredContent).toEqual({ id: 12, name: 'Liga Osiedlowa' });
  });

  it('blokadę rozpoczętych meczów oddaje jako błąd z komunikatem API', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament() }),
      'DELETE /tournaments/12': () => validation('id', 'Turniej ma rozpoczęte mecze, więc nie da się go usunąć.'),
    });

    const result = await call('delete_tournament', { tournamentId: 12 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Turniej ma rozpoczęte mecze');
  });
});

describe('get_standings', () => {
  const table = (groupId: number, groupName: string) => ({
    stageId: 40,
    stageName: 'Faza grupowa',
    groupId,
    groupName,
    scoreLabel: 'Bramki',
    rallyPointsLabel: null,
    allowsDraw: true,
    tiebreakers: [],
    rows: [
      {
        position: 1,
        team: { id: 100, name: 'Wilki Bemowo', logoUrl: null },
        played: 2,
        won: 2,
        drawn: 0,
        lost: 0,
        scoreFor: 5,
        scoreAgainst: 1,
        scoreDifference: 4,
        rallyPointsFor: null,
        rallyPointsAgainst: null,
        points: 6,
        form: ['win', 'win'],
      },
    ],
  });

  it('zawęża do jednej grupy i pisze wiersz tabeli zdaniem', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/standings': () => json(200, { data: [table(7, 'Grupa A'), table(8, 'Grupa B')] }),
    });

    const result = await call('get_standings', { tournamentId: 12, groupId: 8 });

    expect(result.structuredContent).toMatchObject({ tables: [{ groupId: 8, groupName: 'Grupa B' }] });
    expect(textOf(result)).toContain('1. Wilki Bemowo: 2, 2-0-0, 5:1, 6 pkt');
    expect(textOf(result)).not.toContain('Grupa A');
  });

  it('nieznana grupa to błąd, a nie pusta tabela', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12/standings': () => json(200, { data: [table(7, 'Grupa A')] }),
    });

    const result = await call('get_standings', { tournamentId: 12, groupId: 99 });

    expect(result.isError).toBe(true);
  });
});

describe('get_leaderboard', () => {
  it('dla szkicu odpowiada błędem i nie pyta strony publicznej', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament({ status: 'draft' }) }),
    });

    const result = await call('get_leaderboard', { tournamentId: 12 });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('szkicem');
    expect(backend.requests.some((request) => request.path.startsWith('/public/'))).toBe(false);
  });

  it('dla opublikowanego bierze klasyfikację po slugu i przycina do limitu', async () => {
    const row = (position: number, name: string) => ({
      position,
      player: { id: position, name },
      team: { id: 100, name: 'Wilki Bemowo', logoUrl: null },
      value: 10 - position,
    });
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments/12': () => json(200, { data: apiTournament({ status: 'active' }) }),
      'GET /public/t/liga-osiedlowa/leaderboard': () =>
        json(200, { data: { stat: 'goals', label: 'Gole', rows: [row(1, 'Jan Kowalski'), row(2, 'Adam Nowak'), row(3, 'Piotr Wiśniewski')] } }),
    });

    const result = await call('get_leaderboard', { tournamentId: 12, stat: 'goals', limit: 2 });

    expect(backend.calls('GET /public/t/liga-osiedlowa/leaderboard')[0].query.get('stat')).toBe('goals');
    expect(result.structuredContent).toMatchObject({ label: 'Gole', rows: [{ position: 1 }, { position: 2 }] });
    expect(textOf(result)).toContain('1. Jan Kowalski (Wilki Bemowo): 9');
  });
});

describe('list_tournaments', () => {
  it('przekazuje filtr statusów i stronę, a w tekście podaje id turniejów', async () => {
    const { call, backend } = await connect({
      ...happyRoutes(),
      'GET /tournaments': () =>
        json(200, { data: [apiTournament({ status: 'active', teamsCount: 8 })], meta: { currentPage: 2, lastPage: 3, perPage: 20, total: 41 } }),
    });

    const result = await call('list_tournaments', { status: ['draft', 'active'], page: 2 });

    const query = backend.calls('GET /tournaments')[0].query;
    expect(query.get('status')).toBe('draft,active');
    expect(query.get('page')).toBe('2');
    expect(result.structuredContent).toMatchObject({ page: 2, lastPage: 3, total: 41 });
    expect(textOf(result)).toContain('Liga Osiedlowa (id 12): trwa');
  });
});
