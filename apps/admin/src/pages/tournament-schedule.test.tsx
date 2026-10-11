import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMatch, Stage, Team, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+00:00' },
};

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'score_diff'],
  matchDuration: 60,
  teamsCount: 4,
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
    http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => HttpResponse.json({ data: TOURNAMENT })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/stages`, () => HttpResponse.json({ data: [LEAGUE] })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: TEAMS })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/venues`, () => HttpResponse.json({ data: [] })),
  );
});

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

  it('turniej bez fazy league nie ma żadnej akcji generowania', async () => {
    const knockout: Stage = { id: 12, type: 'knockout', name: 'Faza pucharowa', order: 1, groups: [] };
    server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}/stages`, () => HttpResponse.json({ data: [knockout] })));
    renderSchedule();

    expect(await screen.findByText('Terminarz pucharu pojawi się razem z drabinką')).toBeInTheDocument();
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
});
