import { describe, expect, it } from 'vitest';
import { API_URL, connect, happyRoutes, json, TOKEN, textOf } from './test/harness.ts';

const READ_TOOLS = [
  'get_leaderboard',
  'get_standings',
  'get_tournament',
  'list_match_events',
  'list_matches',
  'list_players',
  'list_registrations',
  'list_sports',
  'list_tournaments',
  'list_venues',
];

/** Narzędzia, które tylko dopisują: niczego nie nadpisują ani nie kasują. */
const ADDITIVE_TOOLS = [
  'accept_registration',
  'add_match_events',
  'add_players',
  'add_teams',
  'add_venues',
  'create_tournament',
];

describe('tools/list', () => {
  it('każde narzędzie ma tytuł, schemat wyniku i podpowiedzi zgodne z tym, co robi', async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(37);
    for (const tool of tools) {
      expect(tool.name, tool.name).toMatch(/^[a-z][a-z_]{2,63}$/);
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations?.title, tool.name).toBe(tool.title);
      expect(tool.outputSchema, tool.name).toBeDefined();
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);

      if (READ_TOOLS.includes(tool.name)) {
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      } else {
        // Domyślnie destrukcyjne jest `true`, więc narzędzie zapisujące musi mówić to jawnie.
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(false);
        expect(tool.annotations?.destructiveHint, tool.name).toBe(!ADDITIVE_TOOLS.includes(tool.name));
      }
    }
  });

  it('losowanie i generowanie nie są idempotentne, a edycje i usunięcia są', async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    const idempotent = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations?.idempotentHint]));
    expect(idempotent).toMatchObject({
      draw_groups: false,
      generate_schedule: false,
      generate_bracket: false,
      set_groups: true,
      set_schedule_dates: true,
      set_match_result: true,
      clear_match_result: true,
      set_tournament_status: true,
      update_team: true,
      delete_team: true,
      delete_tournament: true,
    });
  });

  it('opisy nie wydają agentowi poleceń wołania innych narzędzi (wymóg katalogu konektorów)', async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, tool.name).not.toMatch(/\b(wywołaj|użyj|musisz|powinieneś|pamiętaj)\b/i);
    }
  });
});

describe('błędy', () => {
  it('przepuszcza 422 do agenta z komunikatem i błędami pól', async () => {
    const { call } = await connect({
      ...happyRoutes(),
      'POST /tournaments': () =>
        json(422, {
          message: 'Nazwa jest już zajęta. (i jeszcze 1 błąd)',
          errors: {
            name: ['Nazwa jest już zajęta.'],
            sportId: ['Wybrany sport jest nieprawidłowy.'],
          },
        }),
    });

    const result = await call('create_tournament', { name: 'Liga', sport: 'football', format: 'league' });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('Nazwa jest już zajęta. (i jeszcze 1 błąd)');
    expect(text).toContain('name: Nazwa jest już zajęta.');
    expect(text).toContain('sportId: Wybrany sport jest nieprawidłowy.');
  });

  it('błędne argumenty odrzuca przed wysłaniem czegokolwiek, z nazwą pola w komunikacie', async () => {
    const { call, backend } = await connect();

    const result = await call('create_tournament', { name: 'Liga', sport: 'football', format: 'swiss' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('format');
    expect(backend.calls('POST /tournaments')).toEqual([]);
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

    const result = await call('create_tournament', { name: 'Liga', sport: 'football', format: 'league' });

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

    const result = await call('list_sports', {});

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

    const result = await call('list_tournaments', {});

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain(`Backend nie odpowiada pod ${API_URL}`);
    expect(text).toContain('TOURNAMENT_API_URL');
    expect(text).not.toMatch(/\n\s+at /);
  });

  it('każde żądanie idzie z tokenem organizatora', async () => {
    const { call, backend } = await connect();

    await call('create_tournament', { name: 'Liga', sport: 'football', format: 'league' });

    const authorized = backend.requests.filter((request) => request.path !== '/login');
    expect(authorized.length).toBeGreaterThan(0);
    expect(authorized.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(true);
  });
});
