import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminMatch, MatchEvent, Sport, StandingTable, StatLeaderboard, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { currentTournaments } from '../test/current-tournaments';
import { API_URL as API, server } from '../test/server';
import { tournamentStages } from '../test/tournament-stages';

// jsdom nie rysuje, więc render PNG podmieniamy: ekran dostaje gotowy plik.
const exportMock = vi.hoisted(() => ({
  render: vi.fn(async (_node: HTMLElement, name: string) => new File(['png'], name, { type: 'image/png' })),
  canShare: vi.fn(() => false),
  download: vi.fn(),
}));
vi.mock('../lib/graphic-export', () => ({
  renderGraphicFile: exportMock.render,
  canSharePng: exportMock.canShare,
  downloadFile: exportMock.download,
}));

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+00:00' },
};

const SPORTS: Sport[] = [
  {
    id: 1,
    code: 'football',
    name: 'Piłka nożna',
    config: {
      allowsDraw: true,
      runningClock: true,
      defaultMatchDuration: 60,
      defaultPeriods: { count: 2, minutes: 45 },
      defaultSetFormat: null,
      defaultPoints: { win: 3, draw: 1, loss: 0 },
      eventTypes: [
        { code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals' },
        { code: 'own_goal', label: 'Bramka samobójcza', hasPlayer: true, value: 1, stat: null },
      ],
      defaultTiebreakers: ['points'],
      availableTiebreakers: ['points'],
      tiebreakerLabels: { points: 'Punkty w tabeli' },
      availableStats: ['goals'],
      statLabels: { goals: 'Bramki' },
    },
  },
];

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'draft',
  sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  matchDuration: 60,
  periods: { count: 2, minutes: 45 },
  setFormat: null,
  teamsCount: 3,
  registration: { open: false, deadline: null, pendingCount: 0 },
  createdAt: '2026-09-01T10:00:00+00:00',
  updatedAt: '2026-09-01T10:00:00+00:00',
};

const WILKI = { id: 1, name: 'Wilki Bemowo', logoUrl: null };
const SOKOLY = { id: 2, name: 'Sokoły Ursus', logoUrl: null };
const ORLY = { id: 3, name: 'Orły Bielany', logoUrl: null };

function match(id: number, order: number, home: typeof WILKI, away: typeof WILKI, rest: Partial<AdminMatch> = {}): AdminMatch {
  return {
    id,
    stageId: 11,
    groupId: null,
    round: { id: order, name: `Kolejka ${order}`, order },
    matchNumber: 1,
    homeTeam: home,
    awayTeam: away,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    sets: null,
    status: 'scheduled',
    kickoffAt: null,
    venue: { id: 1, name: 'Boisko Bemowo' },
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    livePeriod: null,
    periodStartedAt: null,
    onBreak: false,
    collisions: [],
    ...rest,
  };
}

const done = (homeScore: number, awayScore: number, kickoffAt: string): Partial<AdminMatch> => ({
  status: 'finished',
  homeScore,
  awayScore,
  kickoffAt,
});

/**
 * Kolejka 1 zakończona, w kolejce 2 jeden mecz zakończony i jeden zaległy
 * zaplanowany, kolejka 3 przed nami. Teraz to 1 października 2026.
 */
const MATCHES: AdminMatch[] = [
  match(1, 1, WILKI, SOKOLY, done(2, 1, '2026-09-06T10:00:00+00:00')),
  match(2, 2, SOKOLY, ORLY, done(1, 3, '2026-09-13T10:00:00+00:00')),
  match(3, 2, ORLY, WILKI, { kickoffAt: '2026-09-14T10:00:00+00:00' }),
  match(4, 3, WILKI, ORLY, { kickoffAt: '2026-10-04T10:00:00+00:00' }),
  match(5, 3, SOKOLY, WILKI, { kickoffAt: '2026-10-11T10:00:00+00:00' }),
];

function table(groupName: string | null = null): StandingTable {
  const row = (position: number, team: typeof WILKI, points: number) => ({
    position,
    team,
    played: 2,
    won: 1,
    drawn: 0,
    lost: 1,
    scoreFor: 3,
    scoreAgainst: 3,
    scoreDifference: 0,
    rallyPointsFor: null,
    rallyPointsAgainst: null,
    points,
    form: [],
  });
  return {
    stageId: 11,
    stageName: 'Faza zasadnicza',
    groupId: groupName ? 1 : null,
    groupName,
    scoreLabel: 'Bramki',
    rallyPointsLabel: null,
    allowsDraw: true,
    tiebreakers: [],
    rows: [row(1, ORLY, 3), row(2, WILKI, 3), row(3, SOKOLY, 0)],
  };
}

const LEADERBOARD: StatLeaderboard = {
  stat: 'goals',
  label: 'Bramki',
  rows: [{ position: 1, player: { id: 1, name: 'Marek Nowak' }, team: WILKI, value: 2 }],
};

const EVENTS: MatchEvent[] = [
  { id: 1, team: ORLY, player: { id: 7, name: 'Rafał Duda' }, type: 'goal', typeLabel: 'Bramka', minute: 12, addedTime: null },
  { id: 2, team: SOKOLY, player: { id: 4, name: 'Tomasz Lis' }, type: 'own_goal', typeLabel: 'Bramka samobójcza', minute: 40, addedTime: null },
];

function api({
  matches = MATCHES,
  tables = [table()],
  leaderboard = LEADERBOARD,
}: { matches?: AdminMatch[]; tables?: StandingTable[]; leaderboard?: StatLeaderboard } = {}) {
  server.use(
    http.get(`${API}/tournaments/:id`, () => HttpResponse.json({ data: TOURNAMENT })),
    http.get(`${API}/tournaments/:id/matches`, () =>
      HttpResponse.json({ data: matches, meta: { currentPage: 1, lastPage: 1, perPage: 200, total: matches.length } }),
    ),
    http.get(`${API}/tournaments/:id/standings`, () => HttpResponse.json({ data: tables })),
    http.get(`${API}/tournaments/:id/leaderboard`, () => HttpResponse.json({ data: leaderboard })),
    http.get(`${API}/matches/:id/events`, () => HttpResponse.json({ data: EVENTS })),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T12:00:00+00:00') });
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    currentTournaments(),
    tournamentStages(),
    http.get(`${API}/sports`, () => HttpResponse.json({ data: SPORTS })),
  );
  api();
  exportMock.render.mockClear();
  exportMock.canShare.mockReturnValue(false);
  exportMock.download.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderGraphics(search = '') {
  const router = createMemoryRouter(routes, { initialEntries: [`/tournaments/7/graphics${search}`] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  await screen.findByRole('group', { name: 'Rodzaj grafiki' });
  return { router, user: userEvent.setup() };
}

const graphic = () => screen.getByRole('img', { name: /^Grafika:/ });
const matchSelect = () => screen.getByRole('combobox', { name: 'Mecz' });

describe('grafiki: wybór', () => {
  it('domyślnie zapowiada najbliższy mecz od teraz, a nie zaległy, i zapisuje wybór w adresie', async () => {
    const { router } = await renderGraphics();

    expect(screen.getByRole('radio', { name: 'Zapowiedź meczu' })).toBeChecked();
    expect(matchSelect()).toHaveTextContent('Wilki Bemowo – Orły Bielany');
    expect(graphic()).toHaveTextContent('Zapowiedź · Kolejka 3');
    await waitFor(() => expect(router.state.location.search).toBe('?kind=matchPreview&match=4&format=4%3A5'));
  });

  it('wynik domyślnie pokazuje ostatni zakończony mecz ze strzelcami, samobój po stronie rywala', async () => {
    const { user } = await renderGraphics();

    await user.click(screen.getByRole('radio', { name: 'Wynik meczu' }));

    expect(matchSelect()).toHaveTextContent('Sokoły Ursus – Orły Bielany');
    expect(graphic()).toHaveTextContent('1–3');
    await waitFor(() => expect(graphic()).toHaveTextContent('Rafał Duda 12′, Tomasz Lis 40′ (sam.)'));
  });

  it('błędny rodzaj, mecz i format w adresie wracają do domyślnych', async () => {
    const { router } = await renderGraphics('?kind=coś&match=999&format=1:1');

    expect(screen.getByRole('radio', { name: 'Zapowiedź meczu' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^4:5/ })).toBeChecked();
    expect(matchSelect()).toHaveTextContent('Wilki Bemowo – Orły Bielany');
    await waitFor(() => expect(router.state.location.search).toBe('?kind=matchPreview&match=4&format=4%3A5'));
  });

  it('mecz z adresu zostaje, gdy pasuje do rodzaju', async () => {
    await renderGraphics('?kind=matchResult&match=1&format=9:16');

    expect(matchSelect()).toHaveTextContent('Wilki Bemowo – Sokoły Ursus');
    expect(graphic()).toHaveAttribute('data-format', '9:16');
  });
});

describe('grafiki: tabela', () => {
  it('ma podpis po ostatniej pełnej kolejce i uprzedza o meczach z dalszej', async () => {
    await renderGraphics('?kind=standings');

    expect(graphic()).toHaveTextContent('Po kolejce 1');
    expect(screen.getByText('Tabela obejmuje już 1 mecz kolejki 2, a grafika ma podpis „po kolejce 1”.')).toBeInTheDocument();
  });

  it('bez pełnej kolejki zostaje aktywna, bez podpisu i z samym ostrzeżeniem', async () => {
    api({ matches: [MATCHES[1]!, MATCHES[2]!] });
    await renderGraphics('?kind=standings');

    expect(screen.getByRole('radio', { name: 'Tabela' })).toBeChecked();
    expect(graphic()).not.toHaveTextContent('Po kolejce');
    expect(screen.getByText(/Żadna kolejka nie jest jeszcze zakończona w całości/)).toBeInTheDocument();
  });

  it('jest nieaktywna z wyjaśnieniem, gdy turniej ma kilka tabel grup', async () => {
    api({ tables: [table('Grupa A'), table('Grupa B')] });
    await renderGraphics('?kind=standings');

    const standings = screen.getByRole('radio', { name: 'Tabela' });
    expect(standings).toBeDisabled();
    expect(standings).toHaveAccessibleDescription('Turniej ma kilka tabel grup, a grafika pokazuje jedną tabelę.');
    expect(screen.getByRole('radio', { name: 'Zapowiedź meczu' })).toBeChecked();
  });
});

describe('grafiki: rodzaje bez danych', () => {
  it('przed pierwszym meczem tylko zapowiedź jest aktywna, a reszta mówi dlaczego', async () => {
    api({ matches: [MATCHES[3]!], leaderboard: { ...LEADERBOARD, rows: [] } });
    await renderGraphics();

    expect(screen.getByRole('radio', { name: 'Zapowiedź meczu' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Wynik meczu' })).toHaveAccessibleDescription('Brak zakończonego meczu.');
    expect(screen.getByRole('radio', { name: 'Tabela' })).toHaveAccessibleDescription('Tabela nie ma jeszcze zakończonego meczu.');
    expect(screen.getByRole('radio', { name: 'Klasyfikacja' })).toHaveAccessibleDescription('Klasyfikacja „Bramki” jest jeszcze pusta.');
    for (const name of ['Wynik meczu', 'Tabela', 'Klasyfikacja']) expect(screen.getByRole('radio', { name })).toBeDisabled();
  });

  it('bez meczu do zapowiedzenia zapowiedź jest nieaktywna, a domyślny jest pierwszy aktywny rodzaj', async () => {
    api({ matches: MATCHES.filter((candidate) => candidate.status === 'finished') });
    await renderGraphics();

    expect(screen.getByRole('radio', { name: 'Zapowiedź meczu' })).toHaveAccessibleDescription(
      'Brak meczu z terminem i znanymi drużynami, który można zapowiedzieć.',
    );
    expect(screen.getByRole('radio', { name: 'Wynik meczu' })).toBeChecked();
  });
});

describe('grafiki: plik', () => {
  it('„Pobierz PNG” czeka na plik, a potem pobiera PNG o nazwie z turnieju, rodzaju i formatu', async () => {
    api();
    const { user } = await renderGraphics();

    const download = screen.getByRole('button', { name: 'Pobierz PNG' });
    await waitFor(() => expect(download).toBeEnabled());
    await user.click(download);

    expect(exportMock.download).toHaveBeenCalledTimes(1);
    const file = exportMock.download.mock.calls[0]![0] as File;
    expect(file.name).toBe('grafika-liga-osiedlowa-2026-zapowiedz-4x5.png');
    expect(file.type).toBe('image/png');
  });

  it('bez Web Share z plikiem nie ma „Udostępnij”', async () => {
    api();
    await renderGraphics();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pobierz PNG' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Udostępnij' })).not.toBeInTheDocument();
  });

  it('„Udostępnij” otwiera arkusz z plikiem, a anulowanie arkusza nie daje komunikatu', async () => {
    api();
    exportMock.canShare.mockReturnValue(true);
    const share = vi.fn().mockRejectedValue(new DOMException('Anulowano', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { user } = await renderGraphics();

    const button = screen.getByRole('button', { name: 'Udostępnij' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)], title: 'Liga Osiedlowa 2026' });
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('błąd udostępnienia zachęca do pobrania PNG', async () => {
    api();
    exportMock.canShare.mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new Error('NotAllowed')), configurable: true });
    const { user } = await renderGraphics();

    const button = screen.getByRole('button', { name: 'Udostępnij' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText('Nie udało się udostępnić grafiki. Pobierz PNG i dodaj go ręcznie.')).toBeInTheDocument();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('błąd renderu zachęca do „Pobierz PNG”, a klik renderuje jeszcze raz i pobiera plik', async () => {
    api();
    exportMock.render.mockRejectedValueOnce(new Error('canvas'));
    const { user } = await renderGraphics();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się przygotować pliku PNG. Kliknij „Pobierz PNG”, żeby spróbować jeszcze raz.',
    );
    const download = screen.getByRole('button', { name: 'Pobierz PNG' });
    expect(download).toBeEnabled();
    await user.click(download);

    await waitFor(() => expect(exportMock.download).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('zmiana formatu renderuje plik od nowa i zmienia nazwę', async () => {
    api();
    const { user } = await renderGraphics();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pobierz PNG' })).toBeEnabled());

    await user.click(screen.getByRole('radio', { name: /^9:16/ }));
    await waitFor(() => expect(exportMock.render.mock.calls.at(-1)![1]).toBe('grafika-liga-osiedlowa-2026-zapowiedz-9x16.png'));
    expect(within(graphic().parentElement!).getByRole('img', { name: /^Grafika:/ })).toHaveAttribute('data-format', '9:16');
  });
});
