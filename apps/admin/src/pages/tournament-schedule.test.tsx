import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMatch, Group, MatchEvent, Player, Sport, Stage, Team, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';
import { currentTournaments } from '../test/current-tournaments';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+00:00' },
};

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'score_diff'],
  matchDuration: 60,
  periods: { count: 2, minutes: 45 },
  teamsCount: 4,
  registration: { open: false, deadline: null, pendingCount: 0 },
  createdAt: '2026-09-01T10:00:00+00:00',
  updatedAt: '2026-09-01T10:00:00+00:00',
};

const LEAGUE: Stage = { id: 11, type: 'league', name: 'Faza zasadnicza', order: 1, groups: [] };

function team(id: number, name: string): Team {
  return { id, tournamentId: TOURNAMENT.id, name, logoUrl: null, groupId: null, playersCount: 0, scheduledMatchesCount: 0 };
}

const TEAMS = [team(1, 'Wilki Bemowo'), team(2, 'Sokoły Ursus'), team(3, 'Orły Bielany'), team(4, 'Rysie Wola')];

let nextId = 1;

/** Mecz kolejki `order`; drużyny po id z `TEAMS`. */
function match(order: number, matchNumber: number, home: number, away: number, overrides: Partial<AdminMatch> = {}): AdminMatch {
  const byId = (id: number) => {
    const { name, logoUrl } = TEAMS.find((candidate) => candidate.id === id)!;
    return { id, name, logoUrl };
  };
  return {
    id: nextId++,
    stageId: LEAGUE.id,
    groupId: null,
    round: { id: 100 + order, name: `Kolejka ${order}`, order },
    matchNumber,
    homeTeam: byId(home),
    awayTeam: byId(away),
    homeScore: null,
    awayScore: null,
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

const FINISHED = { status: 'finished', homeScore: 2, awayScore: 1 } as const;

/** Liga czterech drużyn, raz każdy z każdym: trzy kolejki po dwa mecze. */
function season(overrides: Record<number, Partial<AdminMatch>> = {}): AdminMatch[] {
  const pairs: [number, number, number, number][] = [
    [1, 1, 1, 4],
    [1, 2, 2, 3],
    [2, 1, 4, 3],
    [2, 2, 1, 2],
    [3, 1, 2, 4],
    [3, 2, 3, 1],
  ];
  return pairs.map(([order, number, home, away], index) => match(order, number, home, away, overrides[index]));
}

const MATCHES_URL = `${API}/tournaments/${TOURNAMENT.id}/matches`;
const GENERATE_URL = `${API}/stages/${LEAGUE.id}/schedule`;

beforeEach(() => {
  nextId = 1;
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    currentTournaments(),
    http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => HttpResponse.json({ data: TOURNAMENT })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/stages`, () => HttpResponse.json({ data: [LEAGUE] })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: TEAMS })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/venues`, () => HttpResponse.json({ data: [] })),
    // Okno meczu rozpoczętego pobiera zdarzenia i typy sportu (#200).
    http.get(`${API}/sports`, () => HttpResponse.json({ data: SPORTS })),
    http.get(`${API}/matches/:match/events`, () => HttpResponse.json({ data: [] })),
    http.get(`${API}/teams/:team/players`, () => HttpResponse.json({ data: [] })),
  );
});

/** Piłka z typami zdarzeń z kontraktu (`GET /sports`). */
const SPORTS: Sport[] = [
  {
    id: 1,
    code: 'football',
    name: 'Piłka nożna',
    config: {
      allowsDraw: true,
      runningClock: true,
      defaultPoints: { win: 3, draw: 1, loss: 0 },
      defaultMatchDuration: 60,
      defaultPeriods: { count: 2, minutes: 45 },
      eventTypes: [
        { code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals' },
        { code: 'own_goal', label: 'Bramka samobójcza', hasPlayer: true, value: 1, stat: null },
        { code: 'yellow_card', label: 'Żółta kartka', hasPlayer: true, value: 1, stat: 'yellowCards' },
        { code: 'red_card', label: 'Czerwona kartka', hasPlayer: true, value: 1, stat: 'redCards' },
      ],
      defaultTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for'],
      availableTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for', 'wins'],
      tiebreakerLabels: {},
      availableStats: ['goals', 'yellowCards', 'redCards'],
      statLabels: { goals: 'Bramki', yellowCards: 'Żółte kartki', redCards: 'Czerwone kartki' },
    },
  },
];

/**
 * Mecze fazy po stronie „serwera”, stronicowane po `perPage` z żądania, jak
 * na Laravelu. `requests` zapisuje parametry każdego pobrania.
 */
function serveMatches(initial: AdminMatch[]) {
  const state = { matches: [...initial], requests: [] as URLSearchParams[] };
  server.use(
    http.get(MATCHES_URL, ({ request }) => {
      const query = new URL(request.url).searchParams;
      state.requests.push(query);
      const perPage = Number(query.get('perPage') ?? 50);
      const page = Number(query.get('page') ?? 1);
      const total = state.matches.length;
      return HttpResponse.json({
        data: state.matches.slice((page - 1) * perPage, page * perPage),
        meta: { currentPage: page, lastPage: Math.max(1, Math.ceil(total / perPage)), perPage, total },
      });
    }),
  );
  return state;
}

function renderSchedule(search = '') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/tournaments/${TOURNAMENT.id}/schedule${search}`],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), router };
}

/** Lista kolejek w kolumnie (w jsdom stoi obok przycisku telefonowego, bo CSS nie działa). */
async function roundsNav() {
  return screen.findByRole('navigation', { name: 'Kolejki' });
}

function matchRows() {
  return screen
    .getAllByRole('button')
    .filter((element) => element.getAttribute('data-slot') === 'match-row')
    .map((row) => row.getAttribute('aria-label'));
}

describe('Terminarz — lista', () => {
  it('zbiera mecze ze wszystkich stron i pokazuje je razem', async () => {
    // 201 meczów to dwie strony po 200, a ostatni mecz siedzi na drugiej.
    const many = Array.from({ length: 200 }, (_, index) => match(1, index + 1, 1, 2));
    const last = match(2, 1, 3, 4);
    const state = serveMatches([...many, last]);
    const { user } = renderSchedule();

    const nav = await roundsNav();
    expect(within(nav).getAllByRole('button')).toHaveLength(2);
    expect(state.requests.map((query) => [query.get('stageId'), query.get('perPage'), query.get('page')])).toEqual([
      [String(LEAGUE.id), '200', '1'],
      [String(LEAGUE.id), '200', '2'],
    ]);

    await user.click(within(nav).getByRole('button', { name: /^Kolejka 2\b/ }));
    expect(matchRows()).toEqual(['Orły Bielany – Rysie Wola']);
  });

  it('bez ?round= otwiera pierwszą kolejkę z meczem innym niż finished', async () => {
    serveMatches(season({ 0: FINISHED, 1: FINISHED, 2: FINISHED }));
    renderSchedule();

    expect(await screen.findByRole('heading', { name: 'Kolejka 2' })).toBeInTheDocument();
    expect(matchRows()).toEqual(['Rysie Wola – Orły Bielany', 'Wilki Bemowo – Sokoły Ursus']);
  });

  it('wybraną kolejkę trzyma w adresie, więc przetrwa przeładowanie', async () => {
    serveMatches(season());
    const { user, router } = renderSchedule();

    await user.click(within(await roundsNav()).getByRole('button', { name: /^Kolejka 3\b/ }));
    expect(router.state.location.search).toBe('?round=3');
    expect(screen.getByRole('heading', { name: 'Kolejka 3' })).toBeInTheDocument();

    // „Przeładowanie”: świeży router i świeży cache pod tym samym adresem.
    const url = `${router.state.location.search}`;
    router.dispose();
    document.body.innerHTML = '';
    renderSchedule(url);
    expect(await screen.findByRole('heading', { name: 'Kolejka 3' })).toBeInTheDocument();
  });

  it('pokazuje „Termin do ustalenia” przy meczu bez daty', async () => {
    serveMatches(season());
    renderSchedule('?round=1');

    await screen.findByRole('heading', { name: 'Kolejka 1' });
    expect(screen.getAllByText('Termin do ustalenia')).toHaveLength(2);
  });
});

describe('Terminarz — drużyna bez meczów', () => {
  it('mówi o drużynie, która nie gra w żadnym meczu, i tylko o niej', async () => {
    // Rysie Wola dodane po wygenerowaniu: terminarz trzech drużyn.
    serveMatches([match(1, 1, 1, 2), match(2, 1, 3, 1), match(3, 1, 2, 3)]);
    renderSchedule();

    expect(await screen.findByText('Drużyna Rysie Wola nie ma meczów w terminarzu — wygeneruj go ponownie.')).toBeInTheDocument();
    expect(screen.queryByText(/Wilki Bemowo nie ma meczów/)).not.toBeInTheDocument();
  });

  // Drużyna gra tylko na wyjeździe, i to w ostatniej kolejce: komunikat nie
  // może patrzeć na samych gospodarzy ani na bieżącą kolejkę.
  it('nie mówi nic, gdy każda drużyna gra choć raz, także tylko jako gość', async () => {
    serveMatches([match(1, 1, 1, 2), match(1, 2, 3, 1), match(3, 1, 2, 4)]);
    renderSchedule();

    await roundsNav();
    expect(screen.queryByText(/nie ma meczów w terminarzu|nie mają meczów w terminarzu/)).not.toBeInTheDocument();
  });
});

describe('Terminarz — generowanie', () => {
  it('pusta faza ma „Wygeneruj terminarz”, a po sukcesie toast i świeżą listę', async () => {
    const state = serveMatches([]);
    let body: unknown;
    server.use(
      http.post(GENERATE_URL, async ({ request }) => {
        body = await request.json();
        state.matches = season();
        return HttpResponse.json({ data: { roundsCount: 3, matchesCount: 6 } }, { status: 201 });
      }),
    );
    const { user } = renderSchedule();

    await user.click(await screen.findByRole('button', { name: 'Wygeneruj terminarz' }));
    const dialog = screen.getByRole('dialog', { name: 'Wygeneruj terminarz' });
    expect(within(dialog).getByRole('radio', { name: 'Raz' })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Dwa razy (mecz i rewanż)' })).not.toBeChecked();
    expect(within(dialog).getByText('3 kolejki, 6 meczów')).toBeInTheDocument();
    expect(within(dialog).getByText('6 kolejek, 12 meczów')).toBeInTheDocument();

    // Bez wyboru nic nie wychodzi: błąd siada przy polu.
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));
    expect(within(dialog).getByText('Wybierz, ile razy grają ze sobą drużyny.')).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.click(within(dialog).getByRole('radio', { name: 'Raz' }));
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    expect(await screen.findByText('Wygenerowano 3 kolejki, 6 meczów')).toBeInTheDocument();
    expect(body).toEqual({ meetings: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { name: 'Kolejka 1' })).toBeInTheDocument();
  });

  it('przy mniej niż dwóch drużynach przycisk jest wyłączony i odsyła do Drużyn', async () => {
    serveMatches([]);
    server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: [TEAMS[0]] })));
    renderSchedule();

    expect(await screen.findByText('Liga potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wygeneruj terminarz' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Przejdź do drużyn' })).toHaveAttribute('href', `/tournaments/${TOURNAMENT.id}/teams`);
  });

  it('pokazuje 422 z generowania w oknie', async () => {
    serveMatches(season());
    server.use(
      http.post(GENERATE_URL, () => {
        const message = 'Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.';
        return HttpResponse.json({ message, errors: { stage: [message] } }, { status: 422 });
      }),
    );
    const { user } = renderSchedule();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji terminarza' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' }));
    const dialog = screen.getByRole('dialog', { name: 'Wygeneruj terminarz ponownie' });
    expect(
      within(dialog).getByText('Obecny terminarz (6 meczów) zniknie razem z terminami i obiektami, także poprawionymi ręcznie.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'Dwa razy (mecz i rewanż)' }));
    await user.click(within(dialog).getByRole('button', { name: 'Zastąp terminarz' }));

    expect(
      await within(dialog).findByText('Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('przy meczu live „Wygeneruj ponownie” jest wyłączone', async () => {
    serveMatches(season({ 3: { status: 'live', homeScore: 0, awayScore: 0 } }));
    const { user } = renderSchedule();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji terminarza' }));
    expect(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('bez meczu rozpoczętego „Wygeneruj ponownie” jest czynne', async () => {
    serveMatches(season());
    const { user } = renderSchedule();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji terminarza' }));
    expect(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' })).not.toHaveAttribute('aria-disabled');
  });

  // W pucharze Terminarz zastępuje Drabinka (#227): karta jest nieczynna,
  // a wejście z adresu odsyła na Drabinkę.
  it('puchar nie ma akcji generowania i odsyła do drabinki', async () => {
    const knockout: Stage = { id: 12, type: 'knockout', name: 'Faza pucharowa', order: 1, groups: [] };
    server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}/stages`, () => HttpResponse.json({ data: [knockout] })));
    renderSchedule();

    expect(await screen.findByText('W pucharze terminarzem jest drabinka')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do drabinki' })).toHaveAttribute(
      'href',
      `/tournaments/${TOURNAMENT.id}/bracket`,
    );
    expect(screen.queryByRole('button', { name: /Wygeneruj/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Więcej akcji terminarza' })).not.toBeInTheDocument();
  });
});

const DATES_URL = `${API}/stages/${LEAGUE.id}/schedule/dates`;

/** Stan „serwera” rozkładu: kolejność żądań i ciała rozkładu. */
function serveDates(calls: string[], bodies: unknown[]) {
  server.use(
    http.patch(`${API}/tournaments/${TOURNAMENT.id}`, async ({ request }) => {
      calls.push('patch');
      return HttpResponse.json({ data: { ...TOURNAMENT, ...(await request.json() as object) } });
    }),
    http.post(DATES_URL, async ({ request }) => {
      calls.push('dates');
      bodies.push(await request.json());
      return HttpResponse.json({ data: { matchesCount: 6, collisionsCount: 0 } });
    }),
  );
}

/** Otwiera okno rozkładu z nagłówka (ten sam przycisk stoi też nad listą bez dat). */
async function openDates(user: ReturnType<typeof userEvent.setup>) {
  const buttons = await screen.findAllByRole('button', { name: 'Rozłóż daty' });
  await user.click(buttons[0]!);
  return screen.getByRole('dialog', { name: 'Rozłóż daty' });
}

function fillStart(dialog: HTMLElement, value = '2026-09-06T10:00') {
  fireEvent.change(within(dialog).getByLabelText('Start (pierwsza kolejka)'), { target: { value } });
}

describe('Terminarz — rozkład dat (#175)', () => {
  it('przy niezmienionej długości meczu nie wysyła PATCH turnieju', async () => {
    serveMatches(season());
    const calls: string[] = [];
    serveDates(calls, []);
    const { user } = renderSchedule();

    const dialog = await openDates(user);
    fillStart(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Rozłóż' }));

    expect(await screen.findByText('Rozłożono 6 meczów, bez kolizji')).toBeInTheDocument();
    expect(calls).toEqual(['dates']);
  });

  it('przy zmienionej długości wysyła PATCH turnieju przed rozkładem', async () => {
    serveMatches(season());
    const calls: string[] = [];
    const bodies: unknown[] = [];
    serveDates(calls, bodies);
    const { user } = renderSchedule();

    const dialog = await openDates(user);
    fillStart(dialog);
    fireEvent.change(within(dialog).getByLabelText('Długość meczu (min)'), { target: { value: '90' } });
    await user.click(within(dialog).getByRole('button', { name: 'Rozłóż' }));

    await screen.findByText('Rozłożono 6 meczów, bez kolizji');
    expect(calls).toEqual(['patch', 'dates']);
    expect(bodies[0]).toMatchObject({ mode: 'interval', timeZone: expect.any(String) });
  });

  it('krok potwierdzenia pojawia się tylko, gdy w zakresie są mecze scheduled z datą', async () => {
    // Same daty: rozkład nadpisze istniejące terminy, więc pyta o potwierdzenie.
    serveMatches(season({ 0: { kickoffAt: '2026-09-06T08:00:00+00:00' } }));
    const calls: string[] = [];
    serveDates(calls, []);
    const { user } = renderSchedule();

    const dialog = await openDates(user);
    fillStart(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Rozłóż' }));

    expect(
      within(dialog).getByText(/Nadpiszesz terminy i obiekty 1 zaplanowanych meczów od kolejki 1/),
    ).toBeInTheDocument();
    expect(calls).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Tak, nadpisz terminy' }));
    await waitFor(() => expect(calls).toEqual(['dates']));
  });

  it('bez zaplanowanych meczów z datą nie pyta o potwierdzenie', async () => {
    serveMatches(season());
    const calls: string[] = [];
    serveDates(calls, []);
    const { user } = renderSchedule();

    const dialog = await openDates(user);
    fillStart(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Rozłóż' }));

    expect(within(dialog).queryByText(/Nadpiszesz terminy/)).not.toBeInTheDocument();
    await waitFor(() => expect(calls).toEqual(['dates']));
  });

  it('pokazuje plakietkę kolizji po obu stronach pary', async () => {
    serveMatches([
      match(1, 1, 1, 2, {
        kickoffAt: '2026-09-06T08:00:00+00:00',
        venue: { id: 1, name: 'Boisko A' },
        collisions: [{ type: 'venue', matchId: 2 }],
      }),
      match(1, 2, 3, 4, {
        kickoffAt: '2026-09-06T08:00:00+00:00',
        venue: { id: 1, name: 'Boisko A' },
        collisions: [{ type: 'venue', matchId: 1 }],
      }),
    ]);
    renderSchedule();

    await screen.findByRole('heading', { name: 'Kolejka 1' });
    // Opis drugiej strony pary dokłada panel, bo kontrakt zna tylko `matchId`.
    expect(screen.getAllByTitle(/^Kolizja boiska: /)).toHaveLength(2);
  });
});

const MATCH_PATCH_URL = `${API}/matches/:match`;

/** Handler zapisu meczu: zapisuje ciała i oddaje mecz z nałożonymi zmianami. */
function serveSave(matches: AdminMatch[]) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(MATCH_PATCH_URL, async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      const match = matches.find((candidate) => candidate.id === Number(params.match))!;
      return HttpResponse.json({ data: { ...match, ...body } });
    }),
  );
  return bodies;
}

async function openMatchRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog');
}

describe('Terminarz — okno meczu (#176)', () => {
  it('„Zaplanowany” czyści pola i wysyła jawne null', async () => {
    const matches = [match(1, 1, 1, 2, FINISHED)];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(within(dialog).getByRole('radio', { name: 'Zakończony' })).toBeChecked();

    await user.click(within(dialog).getByRole('radio', { name: 'Zaplanowany' }));
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'scheduled', homeScore: null, awayScore: null });
  });

  it('remis „Zakończony” w lidze nie pokazuje karnych ani notki i nie wysyła karnych', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(dialog).toHaveAccessibleDescription('Kolejka 1, mecz 1');
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await user.type(within(dialog).getByLabelText('Wynik Wilki Bemowo'), '1');
    await user.type(within(dialog).getByLabelText('Wynik Sokoły Ursus'), '1');

    expect(within(dialog).queryByLabelText(/^Karne /)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('homePenalties');
  });

  it('„Trwa” na meczu bez wyniku wstawia 0:0', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Trwa' }));
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'live', homeScore: 0, awayScore: 0 });
  });

  it('błąd pod homeScore stoi pod całym blokiem wyniku', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const message = 'Mecz trwający albo zakończony potrzebuje obu wyników.';
    server.use(
      http.patch(MATCH_PATCH_URL, () =>
        HttpResponse.json({ message, errors: { homeScore: [message] } }, { status: 422 }),
      ),
    );
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    const error = await within(dialog).findByText(message);
    // Oba pola dzielą opis błędu, więc komunikat jest pod blokiem `__ : __`,
    // a nie przy jednym z pól.
    expect(within(dialog).getByLabelText('Wynik Wilki Bemowo')).toHaveAttribute('aria-describedby', error.id);
    expect(within(dialog).getByLabelText('Wynik Sokoły Ursus')).toHaveAttribute('aria-describedby', error.id);
  });

  it('pusty termin wysyła kickoffAt: null', async () => {
    const matches = [match(1, 1, 1, 2, { kickoffAt: '2026-09-06T08:00:00+00:00' })];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    fireEvent.change(within(dialog).getByLabelText('Termin'), { target: { value: '' } });
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ kickoffAt: null });
  });

  it('kliknięcie kolizji otwiera okno drugiego meczu i przełącza kolejkę', async () => {
    serveMatches([
      match(1, 1, 1, 2, {
        kickoffAt: '2026-09-06T08:00:00+00:00',
        venue: { id: 1, name: 'Boisko A' },
        collisions: [{ type: 'venue', matchId: 2 }],
      }),
      match(2, 1, 3, 4, {
        kickoffAt: '2026-09-06T08:00:00+00:00',
        venue: { id: 1, name: 'Boisko A' },
        collisions: [{ type: 'venue', matchId: 1 }],
      }),
    ]);
    const { user, router } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(within(dialog).getByText('Kolizja nie blokuje zapisu.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Kolizja boiska: Orły Bielany – Rysie Wola/ }));

    expect(await screen.findByRole('dialog', { name: 'Orły Bielany – Rysie Wola' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?round=2');
  });

  it('błąd zakresu pod awayScore ląduje pod blokiem wyniku, nie przy gościu', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const message = 'Wynik może mieć najwyżej 999.';
    server.use(
      http.patch(MATCH_PATCH_URL, () =>
        HttpResponse.json({ message, errors: { awayScore: [message] } }, { status: 422 }),
      ),
    );
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    const error = await within(dialog).findByText(message);
    expect(within(dialog).getByLabelText('Wynik Wilki Bemowo')).toHaveAttribute('aria-describedby', error.id);
    expect(within(dialog).getByLabelText('Wynik Sokoły Ursus')).toHaveAttribute('aria-describedby', error.id);
  });

  it('błąd pod venueId stoi przy polu obiektu, nie pod wynikiem', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const message = 'Wybierz obiekt tego turnieju.';
    server.use(
      http.patch(MATCH_PATCH_URL, () =>
        HttpResponse.json({ message, errors: { venueId: [message] } }, { status: 422 }),
      ),
    );
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Wynik Wilki Bemowo')).not.toHaveAttribute('aria-describedby');
    expect(within(dialog).getByLabelText('Wynik Sokoły Ursus')).not.toHaveAttribute('aria-describedby');
  });
});

// --- zdarzenia meczu (#200) --------------------------------------------------

const EVENTS_URL = `${API}/matches/:match/events`;
const EVENT_URL = `${API}/match-events/:event`;

/** Skład drużyny: dwóch zawodników z numerami. */
function squad(teamId: number): Player[] {
  return [
    { id: teamId * 10 + 1, teamId, name: `Zawodnik ${teamId}A`, number: 7, position: null },
    { id: teamId * 10 + 2, teamId, name: `Zawodnik ${teamId}B`, number: 9, position: null },
  ];
}

function event(id: number, teamId: number, overrides: Partial<MatchEvent> = {}): MatchEvent {
  const team = TEAMS.find((candidate) => candidate.id === teamId)!;
  const player = squad(teamId)[0];
  return {
    id,
    team: { id: team.id, name: team.name, logoUrl: null },
    player: { id: player.id, name: player.name },
    type: 'goal',
    typeLabel: 'Bramka',
    minute: 10,
    ...overrides,
  };
}

/**
 * Zdarzenia meczu po stronie „serwera”: `POST` dopisuje, `DELETE` usuwa,
 * a lista oddaje stan po zmianach. `posts` zbiera ciała zapisów.
 */
function serveEvents(initial: MatchEvent[] = []) {
  const state = { events: [...initial], posts: [] as Record<string, unknown>[], deletes: [] as number[] };
  server.use(
    http.get(`${API}/teams/:team/players`, ({ params }) => HttpResponse.json({ data: squad(Number(params.team)) })),
    http.get(EVENTS_URL, () => HttpResponse.json({ data: state.events })),
    http.post(EVENTS_URL, async ({ request }) => {
      const body = (await request.json()) as { teamId: number; playerId: number; type: string; minute: number | null };
      state.posts.push(body);
      const created = event(100 + state.posts.length, body.teamId, {
        player: { id: body.playerId, name: squad(body.teamId).find((player) => player.id === body.playerId)!.name },
        type: body.type,
        typeLabel: SPORTS[0].config.eventTypes.find((type) => type.code === body.type)!.label,
        minute: body.minute,
      });
      state.events.push(created);
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
    http.delete(EVENT_URL, ({ params }) => {
      state.deletes.push(Number(params.event));
      state.events = state.events.filter((candidate) => candidate.id !== Number(params.event));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

const LIVE = { status: 'live', homeScore: 1, awayScore: 0 } as const;

describe('Terminarz — zdarzenia meczu (#200)', () => {
  it('typ, potem numer wysyła POST z drużyną kolumny, zawodnikiem i minutą z pola', async () => {
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    const state = serveEvents();
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    const away = within(await within(dialog).findByRole('group', { name: 'Zdarzenia: Sokoły Ursus' }));
    await user.click(away.getByRole('button', { name: 'Bramka' }));
    await user.type(await within(dialog).findByLabelText('Minuta'), '63');
    await user.click(within(dialog).getByRole('button', { name: '9. Zawodnik 2B' }));

    await waitFor(() => expect(state.posts).toHaveLength(1));
    expect(state.posts[0]).toEqual({ type: 'goal', teamId: 2, playerId: 22, minute: 63 });
    expect(await screen.findByText('63′ Bramka: Zawodnik 2B')).toBeInTheDocument();
    // Po zapisie kolumna wraca do przycisków, a zdarzenie stoi na osi.
    expect(
      await within(dialog).findByRole('button', { name: 'Edytuj: 63′ Bramka, Zawodnik 2B (Sokoły Ursus)' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Zdarzenia: Sokoły Ursus' })).toBeInTheDocument();
  });

  it('minuta zostaje w polu po zapisie, a puste pole wysyła minute: null', async () => {
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    const state = serveEvents();
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    const homeButton = async (name: string) =>
      within(await within(dialog).findByRole('group', { name: 'Zdarzenia: Wilki Bemowo' })).getByRole('button', { name });

    // Bez minuty.
    await user.click(await homeButton('Żółta kartka'));
    await user.click(await within(dialog).findByRole('button', { name: '7. Zawodnik 1A' }));
    await waitFor(() => expect(state.posts).toHaveLength(1));
    expect(state.posts[0]).toMatchObject({ minute: null });

    // Z minutą, która zostaje na kolejny wpis.
    await user.click(await homeButton('Bramka'));
    await user.type(await within(dialog).findByLabelText('Minuta'), '30');
    await user.click(within(dialog).getByRole('button', { name: '7. Zawodnik 1A' }));
    await waitFor(() => expect(state.posts).toHaveLength(2));
    expect(state.posts[1]).toMatchObject({ minute: 30 });

    await user.click(await homeButton('Bramka'));
    expect(await within(dialog).findByLabelText('Minuta')).toHaveValue('30');
  });

  it('422 pod playerId w pod-oknie edycji siada przy polu zawodnika', async () => {
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    serveEvents([event(5, 1)]);
    const message = 'Zawodnik nie gra w wybranej drużynie.';
    server.use(
      http.patch(EVENT_URL, () => HttpResponse.json({ message, errors: { playerId: [message] } }, { status: 422 })),
    );
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(await within(dialog).findByRole('button', { name: 'Edytuj: 10′ Bramka, Zawodnik 1A (Wilki Bemowo)' }));
    const edit = await screen.findByRole('dialog', { name: 'Edytuj zdarzenie' });
    await user.click(within(edit).getByRole('button', { name: 'Zapisz' }));

    const error = await within(edit).findByText(message);
    // Pod polem zawodnika, a nie nad przyciskami.
    expect(within(error.parentElement!).getByText('Zawodnik')).toBeInTheDocument();
    expect(within(edit).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('„Usuń zdarzenie” wymaga potwierdzenia i wysyła DELETE', async () => {
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    const state = serveEvents([event(5, 1)]);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(await within(dialog).findByRole('button', { name: 'Edytuj: 10′ Bramka, Zawodnik 1A (Wilki Bemowo)' }));
    const edit = await screen.findByRole('dialog', { name: 'Edytuj zdarzenie' });
    await user.click(within(edit).getByRole('button', { name: 'Usuń zdarzenie' }));

    expect(state.deletes).toEqual([]);
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: /Usuń/ }));

    await waitFor(() => expect(state.deletes).toEqual([5]));
    expect(await within(dialog).findByText('Brak zdarzeń.')).toBeInTheDocument();
  });

  it('mecz zaplanowany nie ma przycisków typów, a „Rozpocznij mecz” wysyła live i 0:0', async () => {
    const matches = [match(1, 1, 1, 2)];
    serveMatches(matches);
    const bodies = serveSave(matches);
    serveEvents();
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(within(dialog).queryByRole('group', { name: /^Zdarzenia:/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Zdarzenia wpiszesz, gdy mecz się zacznie.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Rozpocznij mecz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ status: 'live', homeScore: 0, awayScore: 0 });
    expect(await within(dialog).findAllByRole('group', { name: /^Zdarzenia:/ })).toHaveLength(2);
    expect(within(dialog).getByRole('radio', { name: 'Trwa' })).toBeChecked();
  });

  it('linia zgodności pojawia się tylko przy rozjeździe, a samobój liczy się przeciwnikowi', async () => {
    // Wynik 1:0, a zdarzenia: bramka gospodarza i samobój gościa — razem 2:0.
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    serveEvents([event(1, 1), event(2, 2, { type: 'own_goal', typeLabel: 'Bramka samobójcza', minute: 20 })]);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(await within(dialog).findByText('Bramki ze zdarzeń: 2:0')).toBeInTheDocument();
    expect(within(dialog).getByText('wynik meczu 1:0')).toBeInTheDocument();
    // Fakty rozdziela układ (kreska `MetaList`), nie znak.
    expect(within(dialog).getByLabelText('Zgodność wyniku')).not.toHaveTextContent('·');

    // Po wpisaniu wyniku 2:0 rozjazdu nie ma i linia znika.
    const homeScore = within(dialog).getByLabelText('Wynik Wilki Bemowo');
    await user.clear(homeScore);
    await user.type(homeScore, '2');
    expect(within(dialog).queryByText(/ze zdarzeń/)).not.toBeInTheDocument();
  });

  it('linia zgodności nazywa zdobycz etykietą statystyki ze sportu, a nie stałą w panelu', async () => {
    // Etykieta inna niż „Bramki” celowo: przejdzie tylko widok, który czyta
    // `statLabels` z `GET /sports`.
    const [football] = SPORTS;
    server.use(
      http.get(`${API}/sports`, () =>
        HttpResponse.json({ data: [{ ...football!, config: { ...football!.config, statLabels: { ...football!.config.statLabels, goals: 'Gole' } } }] }),
      ),
    );
    // Wynik 1:0, a zdarzenia dają 2:0 — linia stoi.
    serveMatches([match(1, 1, 1, 2, LIVE)]);
    serveEvents([event(1, 1), event(2, 1, { minute: 30 })]);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    expect(await within(dialog).findByText('Gole ze zdarzeń: 2:0')).toBeInTheDocument();
  });

  it('Enter w polu minuty nie wysyła PATCH meczu', async () => {
    const matches = [match(1, 1, 1, 2, LIVE)];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const state = serveEvents();
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    const home = within(await within(dialog).findByRole('group', { name: 'Zdarzenia: Wilki Bemowo' }));
    await user.click(home.getByRole('button', { name: 'Bramka' }));
    await user.type(await within(dialog).findByLabelText('Minuta'), '12{Enter}');

    // Ani mecz, ani zdarzenie: zdarzenie zapisuje dopiero klik w numer.
    expect(bodies).toEqual([]);
    expect(state.posts).toEqual([]);
    expect(within(dialog).getByLabelText('Minuta')).toHaveValue('12');
  });
});

// --- część meczu (#297) ------------------------------------------------------

/** Mecz trwający w części `livePeriod`: biegnie, w przerwie albo po powrocie z zakończonego. */
function livePeriod(livePeriod: number, state: 'running' | 'break' | 'reopened' = 'running'): Partial<AdminMatch> {
  return {
    ...LIVE,
    livePeriod,
    periodStartedAt: state === 'running' ? '2026-09-06T10:00:00+00:00' : null,
    onBreak: state === 'break',
  };
}

/** Turniej z innym podziałem meczu (`Tournament.periods`). */
function servePeriods(periods: Tournament['periods']) {
  server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => HttpResponse.json({ data: { ...TOURNAMENT, periods } })));
}

/** Przyciski części meczu w oknie: „Przerwa”, „Start …”, „Dogrywka…”. */
function periodButtons(dialog: HTMLElement) {
  return within(dialog)
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) => /^(Przerwa|Start |Dogrywka)/.test(text));
}

describe('Terminarz — część meczu (#297)', () => {
  it('przycisk części stoi tylko przy meczu zapisanym jako trwający, nie po samym przełączeniu na „Trwa”', async () => {
    serveMatches([match(1, 1, 1, 2), match(1, 2, 3, 4, livePeriod(1))]);
    const { user } = renderSchedule('?round=1');

    const scheduled = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(scheduled).getByRole('radio', { name: 'Trwa' }));
    expect(periodButtons(scheduled)).toEqual([]);
    await user.keyboard('{Escape}');

    const live = await openMatchRow(user, 'Orły Bielany – Rysie Wola');
    expect(periodButtons(live)).toEqual(['Przerwa']);
  });

  it('w przerwie po 1. części zaczyna następną: „Start 2. połowy” przy 2 częściach', async () => {
    serveMatches([match(1, 1, 1, 2, livePeriod(1, 'break'))]);
    const { user } = renderSchedule('?round=1');
    expect(periodButtons(await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus'))).toEqual(['Start 2. połowy']);
  });

  it('przy 4 częściach przycisk mówi o kwarcie', async () => {
    servePeriods({ count: 4, minutes: 10 });
    serveMatches([match(1, 1, 1, 2, livePeriod(1, 'break'))]);
    const { user } = renderSchedule('?round=1');
    expect(periodButtons(await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus'))).toEqual(['Start 2. kwarty']);
  });

  it('turniej bez podziału nie ma przerwy', async () => {
    servePeriods({ count: 1, minutes: null });
    serveMatches([match(1, 1, 1, 2, livePeriod(1))]);
    const { user } = renderSchedule('?round=1');
    expect(periodButtons(await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus'))).toEqual([]);
  });

  it('w lidze w ostatniej części nie ma przycisku', async () => {
    serveMatches([match(1, 1, 1, 2, livePeriod(2))]);
    const { user } = renderSchedule('?round=1');
    expect(periodButtons(await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus'))).toEqual([]);
  });

  it('po powrocie z „Zakończony” zaczyna część po ostatniej zapisanej, a nie przerwę', async () => {
    serveMatches([match(1, 1, 1, 2, livePeriod(1, 'reopened'))]);
    const { user } = renderSchedule('?round=1');
    expect(periodButtons(await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus'))).toEqual(['Start 2. połowy']);
  });

  it('klik wysyła od razu PATCH z samymi polami części, bez wyniku, a okno zostaje otwarte', async () => {
    const matches = [match(1, 1, 1, 2, livePeriod(1))];
    serveMatches(matches);
    // Serwer stempluje start części sam (opis `MatchUpdate`): przerwa zeruje start, start części go ustawia.
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch(MATCH_PATCH_URL, async ({ request }) => {
        const body = (await request.json()) as { livePeriod?: number; periodRunning: boolean };
        bodies.push(body);
        const clock = body.periodRunning
          ? livePeriod(body.livePeriod!)
          : { periodStartedAt: null, onBreak: true };
        return HttpResponse.json({ data: { ...matches[0], ...clock } });
      }),
    );
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.clear(within(dialog).getByLabelText('Wynik Wilki Bemowo'));
    await user.type(within(dialog).getByLabelText('Wynik Wilki Bemowo'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Przerwa' }));

    await waitFor(() => expect(bodies).toEqual([{ periodRunning: false }]));
    expect(screen.getByRole('dialog')).toBe(dialog);
    // Przerwa zapisana: przycisk zmienia się na start następnej części, a niezapisany wynik zostaje w polu.
    expect(await within(dialog).findByRole('button', { name: 'Start 2. połowy' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Wynik Wilki Bemowo')).toHaveValue(3);

    await user.click(within(dialog).getByRole('button', { name: 'Start 2. połowy' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ livePeriod: 2, periodRunning: true });
  });

  it('422 z przycisku części stoi nad przyciskami okna', async () => {
    serveMatches([match(1, 1, 1, 2, livePeriod(1))]);
    const message = 'Część meczu prowadzi się tylko w meczu trwającym.';
    server.use(http.patch(MATCH_PATCH_URL, () => HttpResponse.json({ message, errors: { livePeriod: [message] } }, { status: 422 })));
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Przerwa' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
  });

  it('„Zapisz” meczu trwającego nie wysyła pól części', async () => {
    const matches = [match(1, 1, 1, 2, livePeriod(1))];
    serveMatches(matches);
    const bodies = serveSave(matches);
    const { user } = renderSchedule('?round=1');

    const dialog = await openMatchRow(user, 'Wilki Bemowo – Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'live' });
    expect(bodies[0]).not.toHaveProperty('livePeriod');
    expect(bodies[0]).not.toHaveProperty('periodRunning');
  });
});

// --- faza grupowa (#258) -----------------------------------------------------

const GROUP_A: Group = { id: 21, name: 'Grupa A', order: 1, qualifiers: 2 };
const GROUP_B: Group = { id: 22, name: 'Grupa B', order: 2, qualifiers: 2 };
const GROUP: Stage = { id: 13, type: 'group', name: 'Faza grupowa', order: 1, groups: [GROUP_A, GROUP_B] };

/** Cztery drużyny w dwóch grupach: pierwsze dwie w A, kolejne w B. */
function groupedTeams(): Team[] {
  return [
    { ...TEAMS[0]!, groupId: GROUP_A.id },
    { ...TEAMS[1]!, groupId: GROUP_A.id },
    { ...TEAMS[2]!, groupId: GROUP_B.id },
    { ...TEAMS[3]!, groupId: GROUP_B.id },
  ];
}

/** Jedna kolejka fazy grupowej: po meczu z każdej grupy. */
function groupRound(): AdminMatch[] {
  return [
    match(1, 1, 1, 2, { stageId: GROUP.id, groupId: GROUP_A.id }),
    match(1, 2, 3, 4, { stageId: GROUP.id, groupId: GROUP_B.id }),
  ];
}

describe('Terminarz — faza grupowa (#258)', () => {
  function serveGroupPhase({ groups = GROUP.groups, teams = groupedTeams(), matches = groupRound() } = {}) {
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}/stages`, () => HttpResponse.json({ data: [{ ...GROUP, groups }] })),
      http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: teams })),
    );
    return serveMatches(matches);
  }

  it('bez składu grup odsyła do karty Grupy', async () => {
    serveGroupPhase({ groups: [], matches: [] });
    renderSchedule();

    expect(await screen.findByText('Najpierw ustal skład grup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do grup' })).toHaveAttribute(
      'href',
      `/tournaments/${TOURNAMENT.id}/groups`,
    );
  });

  it('filtr po grupie zwęża kolejkę, a bez filtra wiersz niesie plakietkę grupy', async () => {
    serveGroupPhase();
    const { user } = renderSchedule('?round=1');

    await screen.findByRole('heading', { name: 'Kolejka 1' });
    expect(matchRows()).toEqual(['Wilki Bemowo – Sokoły Ursus', 'Orły Bielany – Rysie Wola']);
    // Nazwa grupy występuje dwa razy: jako chip filtra i jako plakietka wiersza.
    expect(screen.getAllByText('Grupa A')).toHaveLength(2);

    const chip = (name: string) =>
      within(screen.getByRole('group', { name: 'Filtr grup' })).getByRole('button', { name });

    await user.click(chip('Grupa B'));
    expect(matchRows()).toEqual(['Orły Bielany – Rysie Wola']);
    // Bez filtra plakietka znika razem z meczami drugiej grupy.
    expect(screen.getAllByText('Grupa A')).toHaveLength(1);

    await user.click(chip('Wszystkie grupy'));
    expect(matchRows()).toEqual(['Wilki Bemowo – Sokoły Ursus', 'Orły Bielany – Rysie Wola']);
  });

  it('drużyna bez grupy dostaje komunikat z odnośnikiem do Grup', async () => {
    serveGroupPhase({ teams: [...groupedTeams(), team(5, 'Łosie Ursynów')] });
    renderSchedule();

    expect(await screen.findByText('Drużyna Łosie Ursynów nie ma grupy. Zapisz skład grup od nowa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do grup' })).toHaveAttribute(
      'href',
      `/tournaments/${TOURNAMENT.id}/groups`,
    );
  });

  it('pusty terminarz grup liczy grupy i generuje z tego samego okna co liga', async () => {
    serveGroupPhase({ matches: [] });
    const { user } = renderSchedule();

    expect(await screen.findByText('Terminarz grup nie jest jeszcze wygenerowany')).toBeInTheDocument();
    expect(
      screen.getByText('2 grupy, każdy z każdym w swojej grupie. Kolejka jest wspólna dla wszystkich grup.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wygeneruj terminarz' }));
    const dialog = screen.getByRole('dialog', { name: 'Wygeneruj terminarz grup' });
    // Dwie grupy po dwie drużyny: jedna kolejka i dwa mecze na spotkanie.
    expect(within(dialog).getByText('1 kolejka, 2 mecze')).toBeInTheDocument();
    expect(within(dialog).getByText('2 kolejki, 4 mecze')).toBeInTheDocument();
  });
});
