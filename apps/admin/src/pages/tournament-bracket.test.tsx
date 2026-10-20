import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMatch, BracketSeed, Sport, Stage, StandingTable, Team, Tournament } from '@tournament/api-client';
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
  setFormat: null,
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
    sets: null,
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

/**
 * Ta sama drabinka z innego rozstawienia: `seeding[0]` to seed 1, więc
 * drużyna `t` z `bracket()` przechodzi w `seeding[t - 1]`. Bez meczu
 * o 3. miejsce półfinały nie mają krawędzi przegranego.
 */
function reseeded(seeding: number[], { thirdPlace }: { thirdPlace: boolean }): AdminMatch[] {
  const reseed = (side: AdminMatch['homeTeam']) => {
    if (!side) return null;
    const { id, name, logoUrl } = TEAMS.find((candidate) => candidate.id === seeding[side.id - 1])!;
    return { id, name, logoUrl };
  };
  return bracket()
    .filter((candidate) => thirdPlace || candidate.id !== 302)
    .map((candidate) => ({
      ...candidate,
      homeTeam: reseed(candidate.homeTeam),
      awayTeam: reseed(candidate.awayTeam),
      loserToMatchId: thirdPlace ? candidate.loserToMatchId : null,
    }));
}

/** Sporty z kontraktu, okrojone do tego, czego używa okno meczu: remisy i typy zdarzeń. */
function sport(id: number, code: Sport['code'], name: string, allowsDraw: boolean): Sport {
  return {
    id,
    code,
    name,
    config: {
      allowsDraw,
      runningClock: code === 'football',
      defaultPoints: { win: 3, draw: 1, loss: 0 },
      defaultMatchDuration: 60,
      defaultPeriods: { count: 2, minutes: 45 },
      defaultSetFormat: null,
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
 * kończy się niewidocznym „zablokowana” dla czytnika ekranu. Wybór podmiany
 * w obrębie grupy (#260) niesie ukryty natywny `<select>` z opcjami Radixa,
 * więc jego tekst wypada.
 */
function seeding(dialog: HTMLElement) {
  const list = within(dialog).getByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => {
      const visible = item.cloneNode(true) as HTMLElement;
      visible.querySelectorAll('select').forEach((select) => select.remove());
      return visible.textContent ?? '';
    });
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

  it('„Wygeneruj ponownie” startuje od obecnego rozstawienia i braku meczu o 3. miejsce, a nowa drużyna dochodzi na koniec', async () => {
    // Seedy 1 i 2 (Sokoły, Lwy) z wolnym losem, ćwierćfinały Orły–Wilki i Żubry–Rysie: nie po kolejności z listy drużyn.
    const state = serveMatches(reseeded([4, 1, 6, 2, 5, 3], { thirdPlace: false }));
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () =>
        HttpResponse.json({ data: [...TEAMS, team(7, 'Kruki Żoliborz')] }),
      ),
    );
    const bodies = serveGenerate(state);
    const { user } = renderBracket();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji drabinki' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' }));
    const dialog = screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj ponownie' });
    expect(seeding(dialog)).toEqual([
      '1Sokoły Ursus',
      '2Lwy Mokotów',
      '3Żubry Praga',
      '4Orły Wola',
      '5Wilki Bemowo',
      '6Rysie Bielany',
      '7Kruki Żoliborz',
    ]);
    const toggle = within(dialog).getByRole('switch', { name: /Mecz o 3\. miejsce/ });
    expect(toggle).toBeEnabled();
    expect(toggle).not.toBeChecked();

    await user.click(within(dialog).getByRole('button', { name: 'Zastąp drabinkę' }));
    await waitFor(() => expect(bodies).toEqual([{ teamIds: [4, 1, 6, 2, 5, 3, 7], thirdPlaceMatch: false }]));
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
    expect(within(dialog).getByRole('switch', { name: /Mecz o 3\. miejsce/ })).toBeChecked();

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

  it('blokada zmiany zwycięzcy na samych karnych znika spod wyniku przy poprawce karnych', async () => {
    const blocked =
      'Zwycięzca zagrał już dalej: Finał (Lwy Mokotów – Orły Wola). Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.';
    const state = serveMatches(
      semis({
        201: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 3 },
        202: { status: 'finished', homeScore: 1, awayScore: 0 },
        301: { homeTeam: ref(1), awayTeam: ref(2), status: 'live', homeScore: 0, awayScore: 0 },
        302: { homeTeam: ref(4), awayTeam: ref(3) },
      }),
    );
    // Backend sadza blokadę pod `homeScore` także wtedy, gdy zwycięzcę zmieniły same karne.
    serveSave(state, validationError('homeScore', blocked));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    const homePenalties = within(dialog).getByLabelText('Karne Lwy Mokotów');
    await user.clear(homePenalties);
    await user.type(homePenalties, '2');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(within(dialog).getByLabelText('Wynik Lwy Mokotów')).toHaveAttribute('aria-describedby'));

    await user.clear(homePenalties);
    await user.type(homePenalties, '5');

    expect(within(dialog).getByLabelText('Wynik Lwy Mokotów')).not.toHaveAttribute('aria-describedby');
    expect(within(dialog).queryByText(blocked)).not.toBeInTheDocument();
  });

  it('„Rozpocznij mecz” zdejmuje błąd wyniku z poprzedniego zapisu', async () => {
    const state = serveMatches(semis());
    const message = 'Mecz zaplanowany nie ma wyniku. Wyczyść pola albo zmień stan.';
    let calls = 0;
    server.use(
      http.patch(MATCH_PATCH_URL, async ({ request, params }) => {
        calls += 1;
        if (calls === 1) return validationError('homeScore', message)();
        const body = (await request.json()) as Record<string, unknown>;
        const saved = state.matches.find((candidate) => candidate.id === Number(params.match))!;
        return HttpResponse.json({ data: { ...saved, ...body } });
      }),
    );
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    await setScore(user, dialog, '1', '0');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await within(dialog).findByText(message);

    await user.click(within(dialog).getByRole('button', { name: 'Rozpocznij mecz' }));

    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Trwa' })).toBeChecked());
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

// --- część meczu (#297) ------------------------------------------------------

/** Półfinał 1 trwający w części `livePeriod`, która biegnie. */
function liveSemi(livePeriod: number): AdminMatch[] {
  return semis({
    201: { status: 'live', homeScore: 1, awayScore: 1, livePeriod, periodStartedAt: '2026-10-10T12:00:00+00:00', onBreak: false },
  });
}

describe('Drabinka — część meczu (#297)', () => {
  it('po ostatniej części meczu pucharowego przycisk „Dogrywka / karne” zaczyna część count + 1', async () => {
    const state = serveMatches(liveSemi(2));
    const bodies = serveSave(state);
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(within(dialog).queryByRole('button', { name: 'Przerwa' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Dogrywka / karne' }));

    await waitFor(() => expect(bodies).toEqual([{ livePeriod: 3, periodRunning: true }]));
  });

  it('w koszykówce (bez karnych) przycisk po ostatniej części to sama „Dogrywka”', async () => {
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}`, () =>
        HttpResponse.json({
          data: { ...TOURNAMENT, periods: { count: 4, minutes: 10 }, sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } },
        }),
      ),
    );
    serveMatches(liveSemi(4));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(await within(dialog).findByRole('button', { name: 'Dogrywka' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Dogrywka / karne' })).not.toBeInTheDocument();
  });

  it('w dogrywce przycisku części już nie ma', async () => {
    serveMatches(liveSemi(3));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(within(dialog).queryByRole('button', { name: /^(Przerwa|Start |Dogrywka)/ })).not.toBeInTheDocument();
  });
});

// --- Turniej grupy + playoff (#260) ------------------------------------------

const GROUP_A = { id: 3, name: 'Grupa A', order: 1, qualifiers: 2 };
const GROUP_B = { id: 4, name: 'Grupa B', order: 2, qualifiers: 2 };
const GROUP_STAGE: Stage = { id: 13, type: 'group', name: 'Faza grupowa', order: 1, groups: [GROUP_A, GROUP_B] };
const PLAYOFF_STAGE: Stage = { ...CUP_STAGE, order: 2 };

/** Te same drużyny w dwóch grupach po trzy: A — Lwy, Orły, Rysie; B — Sokoły, Wilki, Żubry. */
const GROUP_TEAMS = TEAMS.map((candidate) => ({ ...candidate, groupId: candidate.id <= 3 ? GROUP_A.id : GROUP_B.id }));

/** Tabela grupy z drużynami po id w kolejności miejsc. */
function groupTable(group: typeof GROUP_A, ids: number[]): StandingTable {
  return {
    stageId: GROUP_STAGE.id,
    stageName: GROUP_STAGE.name,
    groupId: group.id,
    groupName: group.name,
    scoreLabel: 'Bramki',
    rallyPointsLabel: null,
    allowsDraw: true,
    tiebreakers: [{ code: 'points', label: 'Punkty w tabeli' }],
    rows: ids.map((id, index) => {
      const { name, logoUrl } = TEAMS.find((candidate) => candidate.id === id)!;
      return {
        position: index + 1,
        team: { id, name, logoUrl },
        played: 2,
        won: 0,
        drawn: 0,
        lost: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        rallyPointsFor: null,
        rallyPointsAgainst: null,
        points: 6 - 3 * index,
        form: [],
      };
    }),
  };
}

/** Grupa A: Orły, Lwy, Rysie; grupa B: Wilki, Sokoły, Żubry. */
const GROUP_TABLES = [groupTable(GROUP_A, [2, 1, 3]), groupTable(GROUP_B, [5, 4, 6])];

/** Propozycja z backendu dla 2 × 2: 1A, 1B, 2A, 2B. */
const PROPOSAL: BracketSeed[] = [
  { teamId: 2, groupId: GROUP_A.id, position: 1 },
  { teamId: 5, groupId: GROUP_B.id, position: 1 },
  { teamId: 1, groupId: GROUP_A.id, position: 2 },
  { teamId: 4, groupId: GROUP_B.id, position: 2 },
];

const PLAYOFF_ROUNDS = { 1: { id: 20, name: 'Półfinał', order: 1 }, 2: { id: 21, name: 'Finał', order: 2 } } as const;

/** Drabinka na cztery z podanych seedów (po id): półfinały 1–4 i 2–3, finał pusty. */
function playoffBracket([s1, s2, s3, s4]: number[], overrides: Partial<AdminMatch> = {}): AdminMatch[] {
  return [
    match(401, 1, 1, s1!, s4!, { round: PLAYOFF_ROUNDS[1], winnerToMatchId: 403, advancesToSlot: 'home', ...overrides }),
    match(402, 1, 2, s2!, s3!, { round: PLAYOFF_ROUNDS[1], winnerToMatchId: 403, advancesToSlot: 'away' }),
    match(403, 2, 1, null, null, { round: PLAYOFF_ROUNDS[2] }),
  ];
}

/** Mecz fazy grupowej w podanym statusie; do licznika nierozegranych. */
function groupMatch(id: number, status: AdminMatch['status']): AdminMatch {
  return match(id, 1, id, 1, 2, {
    stageId: GROUP_STAGE.id,
    groupId: GROUP_A.id,
    status,
    ...(status === 'scheduled' ? {} : { homeScore: 1, awayScore: 0 }),
  });
}

/**
 * Turniej grupy + playoff po stronie „serwera”: fazy, drużyny z grupami,
 * mecze każdej fazy po `stageId`, tabele i propozycja. Zapis drabinki
 * podmienia `state.bracket`.
 */
function servePlayoff({
  bracket: initial = [],
  groupMatches = [groupMatch(501, 'finished'), groupMatch(502, 'finished')],
  stage = GROUP_STAGE,
  proposal = () => HttpResponse.json({ data: PROPOSAL }),
}: {
  bracket?: AdminMatch[];
  groupMatches?: AdminMatch[];
  stage?: Stage;
  proposal?: () => Response;
} = {}) {
  const state = { bracket: [...initial], proposalCalls: 0 };
  const page = (data: AdminMatch[]) =>
    HttpResponse.json({ data, meta: { currentPage: 1, lastPage: 1, perPage: 200, total: data.length } });
  server.use(
    tournamentStages([stage, PLAYOFF_STAGE]),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => HttpResponse.json({ data: GROUP_TEAMS })),
    http.get(MATCHES_URL, ({ request }) =>
      page(new URL(request.url).searchParams.get('stageId') === String(GROUP_STAGE.id) ? groupMatches : state.bracket),
    ),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/standings`, () => HttpResponse.json({ data: GROUP_TABLES })),
    http.get(`${BRACKET_URL}/seeding`, () => {
      state.proposalCalls += 1;
      return proposal();
    }),
  );
  return state;
}

/** Ciała generowania drabinki playoffu; sukces stawia drabinkę z wysłanych seedów. */
function servePlayoffGenerate(state: { bracket: AdminMatch[] }, respond?: () => Response) {
  const bodies: { teamIds: number[]; thirdPlaceMatch: boolean }[] = [];
  server.use(
    http.post(BRACKET_URL, async ({ request }) => {
      const body = (await request.json()) as { teamIds: number[]; thirdPlaceMatch: boolean };
      bodies.push(body);
      if (respond) return respond();
      state.bracket = playoffBracket(body.teamIds);
      return HttpResponse.json({ data: { roundsCount: 2, matchesCount: 3 } }, { status: 201 });
    }),
  );
  return bodies;
}

function previewRows(dialog: HTMLElement) {
  const list = within(dialog).getByRole('list', { name: 'Podgląd 1. rundy' });
  return within(list).getAllByRole('listitem').map((item) => item.textContent);
}

/** Okno playoffu czeka na świeżą propozycję, zanim pokaże listę. */
async function openPlayoffGenerate(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await openGenerate(user);
  await within(dialog).findByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' });
  return screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj' });
}

/** Notka o rozjeździe drabinki z tabelami jako cały wiersz statusu. */
async function divergenceNotice() {
  return (await screen.findByText(/Drabinka różni się od tabel grup/)).closest<HTMLElement>('[role="status"]')!;
}

describe('Drabinka — playoff z grup (#260)', () => {
  it('pusty stan mówi o liczbie wychodzących i ostrzega przed nierozegranymi meczami grup', async () => {
    servePlayoff({ groupMatches: [groupMatch(501, 'finished'), groupMatch(502, 'scheduled'), groupMatch(503, 'live')] });
    renderBracket();

    expect(
      await screen.findByText('Z grup wychodzą 4 drużyny: drabinka na 4. Rozstawienie startuje z tabel grup.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 mecze fazy grupowej nie są jeszcze rozegrane.');
    expect(screen.getByRole('button', { name: 'Rozstaw i wygeneruj' })).toBeEnabled();
  });

  it('bez składu grup odsyła do karty Grupy, a przycisk jest wyłączony', async () => {
    const state = servePlayoff({ stage: { ...GROUP_STAGE, groups: [] } });
    renderBracket();

    expect(
      await screen.findByText('Drabinka powstaje z wyjścia z grup. Najpierw ustal skład grup w zakładce Grupy.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rozstaw i wygeneruj' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Przejdź do grup' })).toHaveAttribute('href', `/tournaments/${TOURNAMENT.id}/groups`);
    expect(state.proposalCalls).toBe(0);
  });

  it('odmowa propozycji pod groups trafia do pustego stanu i wyłącza generowanie', async () => {
    const message = 'Grupa „Grupa B” ma mniej drużyn, niż z niej wychodzi.';
    servePlayoff({ proposal: () => HttpResponse.json({ message, errors: { groups: [message] } }, { status: 422 }) });
    renderBracket();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rozstaw i wygeneruj' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Przejdź do grup' })).toBeInTheDocument();
  });

  it('okno startuje z propozycji z backendu, z pochodzeniem i parami 1. rundy, bez losowania', async () => {
    servePlayoff();
    const { user } = renderBracket();

    const dialog = await openPlayoffGenerate(user);
    expect(seeding(dialog)).toEqual(['11AOrły Wola', '21BWilki Bemowo', '32ALwy Mokotów', '42BSokoły Ursus']);
    expect(previewRows(dialog)).toEqual(['11A Orły Wola–2B Sokoły Ursus', '21B Wilki Bemowo–2A Lwy Mokotów']);
    expect(within(dialog).queryByRole('combobox', { name: 'Zablokowane pozycje' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Wylosuj/ })).not.toBeInTheDocument();
  });

  it('podmienia drużynę wyłącznie w obrębie jej grupy i wysyła podmienioną listę', async () => {
    const state = servePlayoff();
    const bodies = servePlayoffGenerate(state);
    const { user } = renderBracket();

    const dialog = await openPlayoffGenerate(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Drużyna na pozycji 3' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Lwy Mokotów (2A)',
      'Rysie Bielany (3A)',
    ]);
    await user.click(screen.getByRole('option', { name: 'Rysie Bielany (3A)' }));

    expect(seeding(dialog)[2]).toBe('33ARysie Bielany');
    expect(previewRows(dialog)[1]).toBe('21B Wilki Bemowo–3A Rysie Bielany');
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    expect(await screen.findByText('Wygenerowano drabinkę: 2 rundy, 3 mecze')).toBeInTheDocument();
    expect(bodies).toEqual([{ teamIds: [2, 5, 3, 4], thirdPlaceMatch: true }]);
  });

  it.each([
    ['teamIds', 'Lista musi zawierać tyle drużyn z każdej grupy, ile z niej wychodzi.'],
    ['groups', 'Grupa „Grupa A” ma mniej drużyn, niż z niej wychodzi.'],
  ])('422 pod %s siada nad przyciskami okna', async (key, message) => {
    const state = servePlayoff();
    servePlayoffGenerate(state, () => HttpResponse.json({ message, errors: { [key]: [message] } }, { status: 422 }));
    const { user } = renderBracket();

    const dialog = await openPlayoffGenerate(user);
    await user.click(within(dialog).getByRole('button', { name: 'Wygeneruj' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj' })).toBeInTheDocument();
  });

  it('po wygenerowaniu z podmianą opisuje rozjazd z tabelami i nie mówi o drużynach spoza drabinki', async () => {
    servePlayoff({ bracket: playoffBracket([2, 5, 3, 4]) });
    renderBracket();

    const notice = await divergenceNotice();
    expect(notice).toHaveTextContent(
      'Drabinka różni się od tabel grup: Rysie Bielany (3. w grupie A) zamiast Lwy Mokotów (2. w grupie A).',
    );
    expect(within(notice).getByRole('button', { name: 'Wygeneruj ponownie' })).toBeEnabled();
    expect(screen.queryByText(/w turnieju, ale nie w drabince/)).not.toBeInTheDocument();
  });

  it('drabinka z czołówki tabel nie ma notki o rozjeździe', async () => {
    servePlayoff({ bracket: playoffBracket([2, 5, 1, 4]) });
    renderBracket();

    expect(await screen.findByRole('tab', { selected: true })).toHaveTextContent('Półfinał');
    expect(screen.queryByText(/Drabinka różni się od tabel grup/)).not.toBeInTheDocument();
  });

  it('„Wygeneruj ponownie” liczy propozycję od nowa z bieżących tabel, a nie z obecnej drabinki', async () => {
    const state = servePlayoff({ bracket: playoffBracket([2, 5, 3, 4]) });
    const { user } = renderBracket();

    await user.click(await screen.findByRole('button', { name: 'Więcej akcji drabinki' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' }));
    const dialog = screen.getByRole('dialog', { name: 'Rozstaw i wygeneruj ponownie' });

    await within(dialog).findByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' });
    expect(seeding(screen.getByRole('dialog'))).toEqual([
      '11AOrły Wola',
      '21BWilki Bemowo',
      '32ALwy Mokotów',
      '42BSokoły Ursus',
    ]);
    expect(state.proposalCalls).toBe(1);
  });

  it('po starcie playoffu „Wygeneruj ponownie” jest wyłączone w notce i w menu', async () => {
    servePlayoff({ bracket: playoffBracket([2, 5, 3, 4], { status: 'live', homeScore: 0, awayScore: 0 }) });
    const { user } = renderBracket();

    expect(within(await divergenceNotice()).getByRole('button', { name: 'Wygeneruj ponownie' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Więcej akcji drabinki' }));
    expect(await screen.findByRole('menuitem', { name: 'Wygeneruj ponownie' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Drabinka — playoff z grup, nieaktualne odczyty (#260)', () => {
  it('okno dociąga świeżą listę drużyn, zanim ułoży propozycję', async () => {
    servePlayoff();
    // Pierwszy odczyt (ekran) nie zna jeszcze Orłów z propozycji, kolejne już tak.
    let calls = 0;
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () => {
        calls += 1;
        return HttpResponse.json({ data: calls === 1 ? GROUP_TEAMS.filter((candidate) => candidate.id !== 2) : GROUP_TEAMS });
      }),
    );
    const { user } = renderBracket();

    const dialog = await openPlayoffGenerate(user);
    expect(seeding(dialog)).toEqual(['11AOrły Wola', '21BWilki Bemowo', '32ALwy Mokotów', '42BSokoły Ursus']);
    expect(calls).toBeGreaterThan(1);
  });

  it('gdy drużyny z propozycji nie ma także w świeżej liście, okno mówi o tym zamiast skracać listę', async () => {
    servePlayoff();
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}/teams`, () =>
        HttpResponse.json({ data: GROUP_TEAMS.filter((candidate) => candidate.id !== 2) }),
      ),
    );
    const { user } = renderBracket();

    const dialog = await openGenerate(user);
    expect(
      await within(dialog).findByText(
        'Drużyny albo grupy zmieniły się w trakcie wczytywania. Zamknij okno i otwórz je ponownie.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' })).not.toBeInTheDocument();
  });
});

describe('Drabinka — sport z setami (#301)', () => {
  it('w siatkówce po jedynej części nie ma przycisku „Dogrywka”', async () => {
    server.use(
      http.get(`${API}/tournaments/${TOURNAMENT.id}`, () =>
        HttpResponse.json({
          data: {
            ...TOURNAMENT,
            periods: { count: 1, minutes: null },
            setFormat: { setsToWin: 3, setPoints: 25, decidingSetPoints: 15, minLead: 2 },
            sport: { id: 3, code: 'volleyball', name: 'Siatkówka', allowsDraw: false },
          },
        }),
      ),
    );
    serveMatches(liveSemi(1));
    const { user } = renderBracket('?round=2');

    const dialog = await openRow(user, 'Półfinał 1: Lwy Mokotów – Sokoły Ursus');
    expect(await within(dialog).findByRole('button', { name: 'Dodaj set' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Dogrywka/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^Karne /)).not.toBeInTheDocument();
  });
});
