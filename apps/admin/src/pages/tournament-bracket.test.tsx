import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMatch, Sport, Team, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { currentTournaments } from '../test/current-tournaments';
import { API_URL as API, server } from '../test/server';
import { CUP_STAGE, LEAGUE_STAGE, tournamentStages } from '../test/tournament-stages';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+00:00' },
};

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Puchar Bemowa 2026',
  slug: 'puchar-bemowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  matchDuration: 60,
  periods: { count: 2, minutes: 45 },
  teamsCount: 6,
  createdAt: '2026-09-01T10:00:00+00:00',
  updatedAt: '2026-09-01T10:00:00+00:00',
};

function team(id: number, name: string): Team {
  return { id, tournamentId: TOURNAMENT.id, name, logoUrl: null, groupId: null, playersCount: 0, scheduledMatchesCount: 0 };
}

/** Kolejność listy drużyn (po nazwie, jak z API) to wyjściowe rozstawienie. */
const TEAMS = [
  team(1, 'Lwy Mokotów'),
  team(2, 'Orły Wola'),
  team(3, 'Rysie Bielany'),
  team(4, 'Sokoły Ursus'),
  team(5, 'Wilki Bemowo'),
  team(6, 'Żubry Praga'),
];

const ROUNDS = {
  1: { id: 10, name: 'Ćwierćfinał', order: 1 },
  2: { id: 11, name: 'Półfinał', order: 2 },
  3: { id: 12, name: 'Finał', order: 3 },
} as const;

/** Mecz drabinki z rundy `order`; drużyny po id z `TEAMS`, `null` to pusty slot. */
function match(
  id: number,
  order: 1 | 2 | 3,
  matchNumber: number,
  home: number | null,
  away: number | null,
  overrides: Partial<AdminMatch> = {},
): AdminMatch {
  const byId = (teamId: number | null) => {
    if (teamId === null) return null;
    const { name, logoUrl } = TEAMS.find((candidate) => candidate.id === teamId)!;
    return { id: teamId, name, logoUrl };
  };
  return {
    id,
    stageId: CUP_STAGE.id,
    groupId: null,
    round: ROUNDS[order],
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

/**
 * Drabinka sześciu drużyn z meczem o 3. miejsce, jak z generatora: seedy
 * 1 i 2 z wolnym losem w półfinałach, ćwierćfinały 2 (4–5) i 4 (3–6).
 * Lista idzie po rundzie i numerze, jak z API, więc mecz o 3. miejsce
 * (numer 2) stoi w niej za finałem.
 */
function bracket(overrides: Record<number, Partial<AdminMatch>> = {}): AdminMatch[] {
  return [
    match(102, 1, 2, 4, 5, { winnerToMatchId: 201, advancesToSlot: 'away', ...overrides[102] }),
    match(104, 1, 4, 3, 6, { winnerToMatchId: 202, advancesToSlot: 'away', ...overrides[104] }),
    match(201, 2, 1, 1, null, { winnerToMatchId: 301, loserToMatchId: 302, advancesToSlot: 'home', ...overrides[201] }),
    match(202, 2, 2, 2, null, { winnerToMatchId: 301, loserToMatchId: 302, advancesToSlot: 'away', ...overrides[202] }),
    match(301, 3, 1, null, null, overrides[301]),
    match(302, 3, 2, null, null, overrides[302]),
  ];
}

/** Sporty z kontraktu, okrojone do tego, czego używa okno meczu: remisy i typy zdarzeń. */
function sport(id: number, code: Sport['code'], name: string, allowsDraw: boolean): Sport {
  return {
    id,
    code,
    name,
    config: {
      allowsDraw,
      defaultPoints: { win: 3, draw: 1, loss: 0 },
      defaultMatchDuration: 60,
      defaultPeriods: { count: 2, minutes: 45 },
      eventTypes: [{ code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals' }],
      defaultTiebreakers: ['points'],
      availableTiebreakers: ['points'],
      tiebreakerLabels: {},
      availableStats: ['goals'],
      statLabels: { goals: 'Bramki' },
    },
  };
}

const SPORTS: Sport[] = [sport(1, 'football', 'Piłka nożna', true), sport(2, 'basketball', 'Koszykówka', false)];

const MATCHES_URL = `${API}/tournaments/${TOURNAMENT.id}/matches`;
const BRACKET_URL = `${API}/stages/${CUP_STAGE.id}/bracket`;

/** Mecze fazy po stronie „serwera”; zapis podmienia `state.matches`. */
function serveMatches(initial: AdminMatch[]) {
  const state = { matches: [...initial] };
  server.use(
    http.get(MATCHES_URL, () =>
      HttpResponse.json({
        data: state.matches,
        meta: { currentPage: 1, lastPage: 1, perPage: 200, total: state.matches.length },
      }),
    ),
  );
  return state;
}

/** Ciało generowania i sterowanie odpowiedzią. */
function serveGenerate(state: { matches: AdminMatch[] }, respond?: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(BRACKET_URL, async ({ request }) => {
      bodies.push(await request.json());
      if (respond) return respond();
      state.matches = bracket();
      return HttpResponse.json({ data: { roundsCount: 3, matchesCount: 6 } }, { status: 201 });
    }),
  );
  return bodies;
}

beforeEach(() => {
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    currentTournaments(),
    http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => HttpResponse.json({ data: TOURNAMENT })),
    tournamentStages([CUP_STAGE]),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: TEAMS })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/venues`, () => HttpResponse.json({ data: [] })),
    // Okno meczu bierze remisy i typy zdarzeń ze sportu, a mecz rozpoczęty pobiera zdarzenia.
    http.get(`${API}/sports`, () => HttpResponse.json({ data: SPORTS })),
    http.get(`${API}/matches/:match/events`, () => HttpResponse.json({ data: [] })),
  );
});

function renderBracket(search = '') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/tournaments/${TOURNAMENT.id}/bracket${search}`],
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

/** Wiersze meczów wybranej rundy, po nazwie dostępnej. Każdy otwiera okno meczu (#228). */
function matchRows() {
  return within(screen.getByRole('tabpanel'))
    .getAllByRole('button')
    .map((row) => row.getAttribute('aria-label'));
}

/**
 * Pozycje listy rozstawienia, z numerem na początku. Zablokowana pozycja
 * kończy się niewidocznym „zablokowana” dla czytnika ekranu.
 */
function seeding(dialog: HTMLElement) {
  const list = within(dialog).getByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' });
  return within(list).getAllByRole('listitem').map((item) => item.textContent ?? '');
}

async function openGenerate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Rozstaw i wygeneruj' }));
  return screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj' });
}

describe('Drabinka — pusty stan', () => {
  it('przy 6 drużynach mówi o rozmiarze drabinki i wolnych losach', async () => {
    serveMatches([]);
    renderBracket();

    expect(await screen.findByText(/6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rozstaw i wygeneruj' })).toBeEnabled();
  });

  it('przy 1 drużynie przycisk jest wyłączony i odsyła do Drużyn', async () => {
    serveMatches([]);
    server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: [TEAMS[0]] })));
    renderBracket();

    expect(await screen.findByText('Puchar potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rozstaw i wygeneruj' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Przejdź do drużyn' })).toHaveAttribute('href', `/tournaments/${TOURNAMENT.id}/teams`);
  });

  it('turniej bez fazy pucharowej dostaje pusty stan bez generowania', async () => {
    server.use(tournamentStages([LEAGUE_STAGE]));
    renderBracket();

    expect(await screen.findByText('Ten turniej nie ma fazy pucharowej')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /wygeneruj/i })).not.toBeInTheDocument();
  });
});

describe('Drabinka — okno rozstawienia', () => {
  it('wysyła teamIds w kolejności z listy po ↑/↓, a po sukcesie toast i pierwsza runda', async () => {
    const state = serveMatches([]);
    const bodies = serveGenerate(state);
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    expect(seeding(dialog)).toEqual([
      '1Lwy Mokotów',
      '2Orły Wola',
      '3Rysie Bielany',
      '4Sokoły Ursus',
      '5Wilki Bemowo',
      '6Żubry Praga',
    ]);
    expect(within(dialog).queryByRole('button', { name: /Poprzednia/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Przesuń „Wilki Bemowo” wyżej' }));
    await user.click(within(dialog).getByRole('button', { name: 'Przesuń „Lwy Mokotów” niżej' }));
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    expect(await screen.findByText('Wygenerowano drabinkę: 3 rundy, 6 meczów')).toBeInTheDocument();
    expect(bodies).toEqual([{ teamIds: [2, 1, 3, 5, 4, 6], thirdPlaceMatch: true }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('tab', { selected: true })).toHaveTextContent('Ćwierćfinał');
  });

  it('„Wylosuj resztę” nie rusza zablokowanych pozycji', async () => {
    serveMatches([]);
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Zablokowane pozycje' }));
    await user.click(await screen.findByRole('option', { name: 'Zablokuj 2 pierwsze' }));

    for (let attempt = 0; attempt < 5; attempt++) {
      await user.click(within(dialog).getByRole('button', { name: 'Wylosuj resztę' }));
      const order = seeding(dialog);
      expect(order.slice(0, 2)).toEqual(['1Lwy Mokotówzablokowana', '2Orły Wolazablokowana']);
      expect(order.map((item) => item.replace(/^[0-9]+|zablokowana$/g, '')).toSorted()).toEqual(
        TEAMS.map((candidate) => candidate.name).toSorted(),
      );
    }
  });

  it('podgląd pokazuje wolne losy seedów 1 i 2', async () => {
    serveMatches([]);
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    const preview = within(within(dialog).getByRole('list', { name: 'Podgląd 1. rundy' })).getAllByRole('listitem');
    expect(preview.map((item) => item.textContent)).toEqual([
      '1Lwy Mokotów→wolny los → 2. runda',
      '2Sokoły Ursus–Wilki Bemowo',
      '3Orły Wola→wolny los → 2. runda',
      '4Rysie Bielany–Żubry Praga',
    ]);
  });

  it('przy 3 drużynach przełącznik meczu o 3. miejsce jest nieaktywny i wysyła false', async () => {
    const state = serveMatches([]);
    server.use(http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: TEAMS.slice(0, 3) })));
    const bodies = serveGenerate(state);
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    const toggle = within(dialog).getByRole('switch', { name: /Mecz o 3\. miejsce/ });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(within(dialog).getByText('Wymaga co najmniej czterech drużyn.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));
    await waitFor(() => expect(bodies).toEqual([{ teamIds: [1, 2, 3], thirdPlaceMatch: false }]));
  });

  it('422 pod teamIds siada nad przyciskami, a okno zostaje', async () => {
    const state = serveMatches([]);
    const message = 'Lista musi zawierać każdą drużynę turnieju dokładnie raz.';
    serveGenerate(state, () => HttpResponse.json({ message, errors: { teamIds: [message] } }, { status: 422 }));
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('422 pod thirdPlaceMatch siada przy przełączniku', async () => {
    const state = serveMatches([]);
    const message = 'Mecz o 3. miejsce wymaga co najmniej czterech drużyn.';
    serveGenerate(state, () => HttpResponse.json({ message, errors: { thirdPlaceMatch: [message] } }, { status: 422 }));
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    const field = (await within(dialog).findByText(message)).closest('[data-slot="third-place-field"]');
    expect(field).not.toBeNull();
  });

  it('przy istniejącej drabince okno ostrzega i ma „Zastąp drabinkę”, a po generowaniu ?round= znika', async () => {
    const state = serveMatches(bracket());
    const bodies = serveGenerate(state);
    const { user, router } = renderBracket('?round=3');

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji drabinki' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' }));
    const dialog = screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj ponownie' });
    expect(
      within(dialog).getByText('Obecna drabinka (6 meczów) zniknie razem z terminami i obiektami, także poprawionymi ręcznie.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Zastąp drabinkę' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Ćwierćfinał'));
  });
});

describe('Drabinka — rundy i mecze', () => {
  it('?round= wybiera rundę, a wybór karty trafia do adresu', async () => {
    serveMatches(bracket());
    const { user, router } = renderBracket('?round=2');

    expect(await screen.findByRole('tab', { selected: true })).toHaveTextContent('Półfinał');
    expect(matchRows()).toEqual([
      'Półfinał 1: Lwy Mokotów – Zwycięzca: Ćwierćfinał 2',
      'Półfinał 2: Orły Wola – Zwycięzca: Ćwierćfinał 4',
    ]);

    await user.click(screen.getByRole('tab', { name: /^Ćwierćfinał/ }));
    expect(router.state.location.search).toBe('?round=1');
    expect(matchRows()).toEqual(['Ćwierćfinał 2: Sokoły Ursus – Wilki Bemowo', 'Ćwierćfinał 4: Rysie Bielany – Żubry Praga']);
  });

  it('bez ?round= otwiera rundę z pierwszym niezakończonym meczem', async () => {
    const done = { status: 'finished', homeScore: 1, awayScore: 0 } as const;
    serveMatches(bracket({ 102: done, 104: done }));
    renderBracket();

    expect(await screen.findByRole('tab', { selected: true })).toHaveTextContent('Półfinał');
  });

  it('w rundzie finału mecz o 3. miejsce stoi przed finałem', async () => {
    serveMatches(bracket());
    renderBracket('?round=3');

    await screen.findByRole('tab', { selected: true });
    expect(matchRows()).toEqual([
      'Mecz o 3. miejsce: Przegrany: Półfinał 1 – Przegrany: Półfinał 2',
      'Finał: Zwycięzca: Półfinał 1 – Zwycięzca: Półfinał 2',
    ]);
  });

  it('wolne losy opisuje notka pod 1. i 2. rundą, ale nie pod finałem', async () => {
    serveMatches(bracket());
    const { user } = renderBracket('?round=1');

    const note = 'Wolne losy (bez meczu w 1. rundzie): Lwy Mokotów → Półfinał 1, Orły Wola → Półfinał 2';
    expect(await screen.findByText(note)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Półfinał/ }));
    expect(screen.getByText(note)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Finał/ }));
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it('przy meczu live „Wygeneruj ponownie” jest wyłączone', async () => {
    serveMatches(bracket({ 102: { status: 'live', homeScore: 0, awayScore: 0 } }));
    const { user } = renderBracket();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji drabinki' }));
    expect(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('świeża drabinka bez dat podpowiada rozkład', async () => {
    serveMatches(bracket());
    const { user } = renderBracket();

    expect(await screen.findByText('Drabinka nie ma jeszcze dat. Rozłóż je, żeby mecze dostały terminy i obiekty.')).toBeInTheDocument();
    const [header] = screen.getAllByRole('button', { name: 'Rozłóż daty' });
    await user.click(header!);
    const dialog = screen.getByRole('dialog', { name: 'Rozłóż daty' });
    expect(within(dialog).getByLabelText('Od rundy')).toBeInTheDocument();
  });

  it('mówi o drużynie dodanej po generowaniu', async () => {
    serveMatches(bracket());
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () =>
        HttpResponse.json({ data: [...TEAMS, team(7, 'Kruki Żoliborz')] }),
      ),
    );
    renderBracket();

    expect(
      await screen.findByText('Kruki Żoliborz jest w turnieju, ale nie w drabince — wygeneruj ją ponownie.'),
    ).toBeInTheDocument();
  });

  it('pod finałem ze zwycięzcą stoi mistrz', async () => {
    serveMatches(
      bracket({
        301: { homeTeam: { id: 1, name: 'Lwy Mokotów', logoUrl: null }, awayTeam: { id: 2, name: 'Orły Wola', logoUrl: null }, status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 },
      }),
    );
    renderBracket('?round=3');

    const champion = (await screen.findByText('Zwycięzca pucharu')).closest('[data-slot="bracket-champion"]');
    expect(champion).toHaveTextContent('Orły Wola');
    // Karne w polu wyniku, w nawiasie przy wyniku każdej drużyny, pogrubione u zwycięzcy (#234).
    const final = within(screen.getByRole('button', { name: 'Finał: Lwy Mokotów – Orły Wola' }));
    expect(final.getByText('1:1')).toBeInTheDocument();
    expect(final.getByText('(3)')).not.toHaveClass('font-bold');
    expect(final.getByText('(4)')).toHaveClass('font-bold');
  });
});

describe('Drabinka — nawigacja', () => {
  it('w pucharze karta Terminarz jest wyszarzona, a Drabinka czynna', async () => {
    serveMatches([]);
    renderBracket();

    const tabs = await screen.findByRole('navigation', { name: 'Sekcje turnieju' });
    await waitFor(() => expect(within(tabs).getByText('Terminarz').closest('a')).toHaveAttribute('aria-disabled', 'true'));
    expect(within(tabs).getByText('Terminarz').closest('a')).not.toHaveAttribute('href');
    expect(within(tabs).getByText('Terminarz').closest('a')).toHaveAttribute('title', 'W pucharze terminarzem jest Drabinka');
    expect(within(tabs).getByText('Drabinka').closest('a')).toHaveAttribute('href', `/tournaments/${TOURNAMENT.id}/bracket`);
  });

  it('w lidze karta Terminarz jest czynna', async () => {
    server.use(tournamentStages([LEAGUE_STAGE]));
    renderBracket();

    const tabs = await screen.findByRole('navigation', { name: 'Sekcje turnieju' });
    await waitFor(() =>
      expect(within(tabs).getByText('Terminarz').closest('a')).toHaveAttribute('href', `/tournaments/${TOURNAMENT.id}/schedule`),
    );
    expect(within(tabs).getByText('Terminarz').closest('a')).not.toHaveAttribute('aria-disabled');
  });
});

/** Drużyna z `TEAMS` w kształcie slotu meczu. */
function ref(teamId: number) {
  const { name, logoUrl } = TEAMS.find((candidate) => candidate.id === teamId)!;
  return { id: teamId, name, logoUrl };
}

const WON_2_1 = { status: 'finished', homeScore: 2, awayScore: 1 } as const;

/**
 * Ćwierćfinały rozegrane 2:1, więc półfinały mają już obie drużyny:
 * Lwy Mokotów – Sokoły Ursus i Orły Wola – Rysie Bielany.
 */
function semis(extra: Record<number, Partial<AdminMatch>> = {}): AdminMatch[] {
  const base: Record<number, Partial<AdminMatch>> = {
    102: WON_2_1,
    104: WON_2_1,
    201: { awayTeam: ref(4) },
    202: { awayTeam: ref(3) },
  };
  const ids = new Set([...Object.keys(base), ...Object.keys(extra)].map(Number));
  return bracket(Object.fromEntries([...ids].map((id) => [id, { ...base[id], ...extra[id] }])));
}

const MATCH_PATCH_URL = `${API}/matches/:match`;

/** Zapis meczu: zapisuje ciała i oddaje mecz z nałożonymi zmianami albo podaną odpowiedź. */
function serveSave(state: { matches: AdminMatch[] }, respond?: () => Response) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(MATCH_PATCH_URL, async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      if (respond) return respond();
      const saved = state.matches.find((candidate) => candidate.id === Number(params.match))!;
      return HttpResponse.json({ data: { ...saved, ...body } });
    }),
  );
  return bodies;
}

function validationError(field: string, message: string) {
  return () => HttpResponse.json({ message, errors: { [field]: [message] } }, { status: 422 });
}

async function openRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog');
}

async function setScore(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, home: string, away: string) {
  const [homeInput, awayInput] = within(dialog).getAllByLabelText(/^Wynik /);
  await user.clear(homeInput!);
  await user.type(homeInput!, home);
  await user.clear(awayInput!);
  await user.type(awayInput!, away);
}

describe('Drabinka — okno meczu (#228)', () => {
  it('klik w wiersz otwiera okno meczu z etykietą pozycji i terminem, a pusty slot ma podpis źródła', async () => {
    serveMatches(bracket({ 201: { kickoffAt: '2026-10-10T12:00:00+00:00' } }));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Zwycięzca: Ćwierćfinał 2');

    expect(dialog).toHaveAccessibleName('Lwy Mokotów – Zwycięzca: Ćwierćfinał 2');
    expect(dialog).toHaveAccessibleDescription(/^Półfinał 1, sob\., 10 paź, \d\d:00$/);
  });

  it('pola karnych pojawiają się dopiero przy remisie i „Zakończony”', async () => {
    serveMatches(semis());
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Trwa' }));
    await setScore(user, dialog, '1', '1');
    expect(within(dialog).queryByLabelText('Karne Lwy Mokotów')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    expect(within(dialog).getByLabelText('Karne Lwy Mokotów')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Karne Sokoły Ursus')).toBeInTheDocument();

    await setScore(user, dialog, '2', '1');
    expect(within(dialog).queryByLabelText('Karne Lwy Mokotów')).not.toBeInTheDocument();
  });

  it('w koszykówce pól karnych nie ma nigdy', async () => {
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}`, () =>
        HttpResponse.json({ data: { ...TOURNAMENT, sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } } }),
      ),
    );
    serveMatches(semis());
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await setScore(user, dialog, '50', '50');

    expect(within(dialog).queryByLabelText(/^Karne /)).not.toBeInTheDocument();
  });

  it('ukrycie pól karnych wysyła null w obu karnych', async () => {
    const state = serveMatches(
      semis({ 201: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 3 } }),
    );
    const bodies = serveSave(state);
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(within(dialog).getByLabelText('Karne Lwy Mokotów')).toHaveValue(4);
    expect(within(dialog).getByLabelText('Karne Sokoły Ursus')).toHaveValue(3);

    await setScore(user, dialog, '2', '1');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'finished', homeScore: 2, awayScore: 1, homePenalties: null, awayPenalties: null });
  });

  it('422 pod homePenalties siada pod polami karnych', async () => {
    const state = serveMatches(semis());
    const message = 'Remis w meczu pucharowym rozstrzygają karne. Wpisz je.';
    const bodies = serveSave(state, validationError('homePenalties', message));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await setScore(user, dialog, '1', '1');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    const error = await within(dialog).findByText(message);
    expect(bodies[0]).toMatchObject({ homePenalties: null, awayPenalties: null });
    expect(within(dialog).getByLabelText('Karne Lwy Mokotów')).toHaveAttribute('aria-describedby', error.id);
    expect(within(dialog).getByLabelText('Wynik Lwy Mokotów')).not.toHaveAttribute('aria-describedby');
  });

  it('błąd karnych z 422 znika przy pierwszej poprawce karnych, nie przy kolejnym zapisie', async () => {
    const state = serveMatches(semis());
    const message = 'Remis w meczu pucharowym rozstrzygają karne. Wpisz je.';
    serveSave(state, validationError('homePenalties', message));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await setScore(user, dialog, '1', '1');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await within(dialog).findByText(message);

    await user.type(within(dialog).getByLabelText('Karne Lwy Mokotów'), '4');

    expect(within(dialog).queryByText(message)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Karne Lwy Mokotów')).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).getByLabelText('Karne Lwy Mokotów')).not.toHaveAttribute('aria-describedby');
  });

  it('błąd wyniku z 422 znika przy zmianie wyniku albo stanu', async () => {
    const state = serveMatches(semis());
    const message = 'Ten sport nie zna remisu, więc mecz zakończony musi mieć zwycięzcę.';
    serveSave(state, validationError('homeScore', message));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await setScore(user, dialog, '2', '1');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await within(dialog).findByText(message);

    await user.type(within(dialog).getByLabelText('Wynik Sokoły Ursus'), '0');
    expect(within(dialog).queryByText(message)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Wynik Lwy Mokotów')).not.toHaveAttribute('aria-describedby');

    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await within(dialog).findByText(message);
    await user.click(within(dialog).getByRole('radio', { name: 'Trwa' }));
    expect(within(dialog).queryByText(message)).not.toBeInTheDocument();
  });

  it('notka przed zapisem: awans do finału i mecz o 3. miejsce', async () => {
    serveMatches(semis());
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(within(dialog).queryByText(/awansują/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Zakończony' }));
    await setScore(user, dialog, '2', '0');

    expect(within(dialog).getByText('Lwy Mokotów awansują do finału.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sokoły Ursus zagrają w meczu o 3. miejsce.')).toBeInTheDocument();
  });

  it('notka przed zapisem: podmiana w meczu zależnym', async () => {
    serveMatches(semis());
    const { user } = renderBracket('?round=1');

    const dialog = await openRow(user, 'Ćwierćfinał 4: Rysie Bielany – Żubry Praga');
    await setScore(user, dialog, '1', '2');

    expect(within(dialog).getByText('W półfinale 2 Żubry Praga zastąpią Rysie Bielany.')).toBeInTheDocument();
  });

  it('notka przed zapisem: zniknięcie z meczów zależnych po powrocie do „Trwa”', async () => {
    serveMatches(
      semis({
        201: { status: 'finished', homeScore: 2, awayScore: 0 },
        301: { homeTeam: ref(1) },
        302: { homeTeam: ref(4) },
      }),
    );
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await user.click(within(dialog).getByRole('radio', { name: 'Trwa' }));

    expect(within(dialog).getByText('Lwy Mokotów znikną z finału.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sokoły Ursus znikną z meczu o 3. miejsce.')).toBeInTheDocument();
  });

  it('przy rozpoczętym meczu zależnym stoi ostrzeżenie o blokadzie, a 422 pod homeScore siada pod wynikiem', async () => {
    const blocked =
      'Zwycięzca zagrał już dalej: Finał (Lwy Mokotów – Orły Wola). Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.';
    const state = serveMatches(
      semis({
        201: { status: 'finished', homeScore: 2, awayScore: 0 },
        202: { status: 'finished', homeScore: 1, awayScore: 0 },
        301: { homeTeam: ref(1), awayTeam: ref(2), status: 'live', homeScore: 0, awayScore: 0 },
        302: { homeTeam: ref(4), awayTeam: ref(3) },
      }),
    );
    serveSave(state, validationError('homeScore', blocked));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await setScore(user, dialog, '0', '2');

    expect(within(dialog).getByRole('alert')).toHaveTextContent(blocked);
    expect(within(dialog).queryByText(/zastąpią/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zapisz' })).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(within(dialog).getByLabelText('Wynik Lwy Mokotów')).toHaveAttribute('aria-describedby'));
    const describedBy = within(dialog).getByLabelText('Wynik Lwy Mokotów').getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)).toHaveTextContent(blocked);
  });

  it('mecz bez obu drużyn ma niedostępny wynik, stan i zdarzenia, a termin wysyła się normalnie', async () => {
    const state = serveMatches(bracket());
    const bodies = serveSave(state);
    const { user } = renderBracket('?round=3');

    const dialog = await openRow(user, 'Finał: Zwycięzca: Półfinał 1 – Zwycięzca: Półfinał 2');

    expect(
      within(dialog).getByText('Mecz czeka na rywali z poprzedniej rundy. Do tego czasu ustawisz mu tylko termin i obiekt.'),
    ).toBeInTheDocument();
    for (const input of within(dialog).getAllByLabelText(/^Wynik /)) expect(input).toBeDisabled();
    for (const radio of within(dialog).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(within(dialog).queryByRole('region', { name: 'Zdarzenia' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Rozpocznij mecz/ })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Termin'), { target: { value: '2026-10-11T12:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      kickoffAt: new Date('2026-10-11T12:00').toISOString(),
    });
  });
});
