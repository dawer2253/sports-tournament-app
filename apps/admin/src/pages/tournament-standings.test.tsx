import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Group, Sport, Stage, StandingRow, StandingTable, TiebreakerCode, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';
import { currentTournaments } from '../test/current-tournaments';
import { tournamentStages } from '../test/tournament-stages';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+00:00' },
};

/**
 * Sporty jak w przykładzie `GET /sports`, z kluczami `tiebreakerLabels`
 * w kolejności z MySQL-a (najpierw krótsze): lista ma iść za
 * `availableTiebreakers` i za turniejem, a nie za kluczami mapy.
 */
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
      defaultPoints: { win: 3, draw: 1, loss: 0 },
      eventTypes: [],
      defaultTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for'],
      availableTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for', 'wins'],
      tiebreakerLabels: {
        wins: 'Zwycięstwa',
        points: 'Punkty w tabeli',
        score_for: 'Bramki zdobyte',
        score_diff: 'Różnica bramek',
        head_to_head: 'Bezpośredni mecz',
      },
      availableStats: [],
      statLabels: {},
    },
  },
  {
    id: 2,
    code: 'basketball',
    name: 'Koszykówka',
    config: {
      allowsDraw: false,
      runningClock: false,
      defaultMatchDuration: 40,
      defaultPeriods: { count: 4, minutes: 10 },
      defaultPoints: { win: 2, draw: 0, loss: 1 },
      eventTypes: [],
      defaultTiebreakers: ['points', 'head_to_head', 'score_diff'],
      availableTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for', 'wins'],
      tiebreakerLabels: {
        wins: 'Zwycięstwa',
        points: 'Punkty w tabeli',
        score_for: 'Zdobyte punkty',
        score_diff: 'Różnica punktów',
        head_to_head: 'Bezpośredni mecz',
      },
      availableStats: [],
      statLabels: {},
    },
  },
];

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'head_to_head', 'score_diff'],
  matchDuration: 60,
  periods: { count: 2, minutes: 45 },
  teamsCount: 3,
  registration: { open: false, deadline: null, pendingCount: 0 },
  createdAt: '2026-09-01T10:00:00+00:00',
  updatedAt: '2026-09-01T10:00:00+00:00',
};

function row(position: number, id: number, name: string, points: number, scoreDifference: number): StandingRow {
  return {
    position,
    team: { id, name, logoUrl: null },
    played: 2,
    won: points >= 3 ? 1 : 0,
    drawn: points % 3,
    lost: points >= 3 ? 1 : 2 - (points % 3),
    scoreFor: 3 + scoreDifference,
    scoreAgainst: 3,
    scoreDifference,
    points,
    form: [],
  };
}

/**
 * Tabela według zapisanej listy: Wilki i Sokoły mają po 4 punkty, a mecz
 * bezpośredni wygrały Wilki. Lista, w której `score_diff` stoi przed
 * `head_to_head`, odwraca tę parę — tak jak zrobiłby to backend.
 */
function tables(tiebreakers: string[]): StandingTable[] {
  const diffFirst = tiebreakers.indexOf('score_diff') !== -1
    && (tiebreakers.indexOf('head_to_head') === -1 || tiebreakers.indexOf('score_diff') < tiebreakers.indexOf('head_to_head'));
  const rows = diffFirst
    ? [row(1, 2, 'Sokoły Ursus', 4, 3), row(2, 1, 'Wilki Bemowo', 4, 1), row(3, 3, 'Orły Bielany', 1, -4)]
    : [row(1, 1, 'Wilki Bemowo', 4, 1), row(2, 2, 'Sokoły Ursus', 4, 3), row(3, 3, 'Orły Bielany', 1, -4)];
  const labels = SPORTS[0]!.config.tiebreakerLabels;
  return [
    {
      stageId: 1,
      stageName: 'Faza zasadnicza',
      groupId: null,
      groupName: null,
      scoreLabel: 'Bramki',
      allowsDraw: true,
      // Jak backend: lista, według której ułożono tabelę, z etykietami sportu.
      tiebreakers: tiebreakers.map((code) => ({ code: code as TiebreakerCode, label: labels[code] ?? code })),
      rows,
    },
  ];
}

beforeEach(() => {
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    currentTournaments(),
    tournamentStages(),
    http.get(`${API}/sports`, () => HttpResponse.json({ data: SPORTS })),
  );
});

/**
 * Turniej i tabele po stronie „serwera”. `previews` to wartości parametru
 * `tiebreakers` z kolejnych żądań podglądu, `patches` — ciała `PATCH`.
 */
function standingsApi({
  tournament = TOURNAMENT,
  standings = tables,
  patch,
}: {
  tournament?: Tournament;
  standings?: (tiebreakers: string[]) => StandingTable[];
  patch?: () => Response;
} = {}) {
  let current = tournament;
  const previews: (string | null)[] = [];
  const patches: unknown[] = [];
  server.use(
    http.get(`${API}/tournaments/:id`, () => HttpResponse.json({ data: current })),
    http.get(`${API}/tournaments/:id/standings`, ({ request }) => {
      const param = new URL(request.url).searchParams.get('tiebreakers');
      previews.push(param);
      return HttpResponse.json({ data: standings(param ? param.split(',') : current.tiebreakers) });
    }),
    http.patch(`${API}/tournaments/:id`, async ({ request }) => {
      const body = (await request.json()) as Partial<Tournament>;
      patches.push(body);
      if (patch) return patch();
      current = { ...current, ...body };
      return HttpResponse.json({ data: current });
    }),
  );
  // Zmiana turnieju „z zewnątrz”, np. w drugiej karcie; panel zobaczy ją po odświeżeniu.
  const setTournament = (next: Tournament) => {
    current = next;
  };
  return { previews, patches, setTournament };
}

async function renderStandings() {
  const router = createMemoryRouter(routes, { initialEntries: ['/tournaments/7/standings'] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  await screen.findByRole('region', { name: 'Rozstrzyganie remisów' });
  await screen.findByRole('table');
  return { router, queryClient, user: userEvent.setup() };
}

const usedCriteria = () =>
  within(screen.getByRole('list', { name: 'Używane kryteria' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const teamOrder = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((tableRow) => within(tableRow).getAllByRole('cell')[1]!.textContent);

describe('tabela: odczyt', () => {
  it('pokazuje tabelę z nagłówkiem fazy, kolumnami piłki i zdaniem z kolejnością kryteriów', async () => {
    standingsApi();
    await renderStandings();

    expect(screen.getByRole('heading', { name: 'Faza zasadnicza' })).toBeInTheDocument();
    expect(screen.getByText('3 drużyny')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '#', 'Drużyna', 'M', 'W', 'R', 'P', 'Bramki', '+/−', 'Pkt',
    ]);
    expect(teamOrder()).toEqual(['WBWilki Bemowo', 'SUSokoły Ursus', 'OBOrły Bielany']);
    expect(
      screen.getByText(
        'Kolejność: punkty w tabeli → bezpośredni mecz → różnica bramek → nazwa drużyny (alfabetycznie).',
      ),
    ).toBeInTheDocument();
  });

  it('zdanie pod tabelą idzie za tiebreakers odpowiedzi, nie za etykietami sportu', async () => {
    // Etykiety rozjechane z `tiebreakerLabels` sportu celowo: przejdzie tylko
    // widok, który czyta listę z tabeli.
    standingsApi({
      standings: (tiebreakers) =>
        tables(tiebreakers).map((table) => ({
          ...table,
          tiebreakers: table.tiebreakers.map((item) => ({ ...item, label: `Z odpowiedzi ${item.code}` })),
        })),
    });
    await renderStandings();

    expect(
      screen.getByText(
        'Kolejność: z odpowiedzi points → z odpowiedzi head_to_head → z odpowiedzi score_diff → nazwa drużyny (alfabetycznie).',
      ),
    ).toBeInTheDocument();
  });

  it('w koszykówce nagłówek zdobyczy to „Punkty”, a kolumny R nie ma', async () => {
    standingsApi({
      tournament: { ...TOURNAMENT, sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } },
      standings: (tiebreakers) => tables(tiebreakers).map((table) => ({ ...table, scoreLabel: 'Punkty', allowsDraw: false })),
    });
    await renderStandings();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '#', 'Drużyna', 'M', 'W', 'P', 'Punkty', '+/−', 'Pkt',
    ]);
  });

  // Kolumnę R niesie odpowiedź tabeli, a nie `GET /sports`: tabela staje
  // od razu, choć konfiguracja sportu jeszcze nie przyszła.
  it('kolumna R idzie za allowsDraw tabeli i nie czeka na konfigurację sportu', async () => {
    standingsApi({
      // Para rozjechana celowo: turniej piłkarski, a tabela bez remisów.
      standings: (tiebreakers) => tables(tiebreakers).map((table) => ({ ...table, allowsDraw: false })),
    });
    server.use(http.get(`${API}/sports`, () => new Promise<never>(() => {})));
    const router = createMemoryRouter(routes, { initialEntries: ['/tournaments/7/standings'] });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('columnheader', { name: 'Pkt' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Wczytywanie kryteriów' })).toBeInTheDocument();
  });

  it('turniej bez drużyn ma pusty stan z odnośnikiem do Drużyn', async () => {
    standingsApi({ standings: (tiebreakers) => tables(tiebreakers).map((table) => ({ ...table, rows: [] })) });
    const router = createMemoryRouter(routes, { initialEntries: ['/tournaments/7/standings'] });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Turniej nie ma jeszcze drużyn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do drużyn' })).toHaveAttribute('href', '/tournaments/7/teams');
  });
});

describe('tabela: edycja kryteriów', () => {
  it('kryteria idą w kolejności turnieju, a nieużywane w kolejności sportu', async () => {
    standingsApi();
    await renderStandings();

    expect(usedCriteria()).toEqual([
      '1Punkty w tabeli zawsze pierwsze',
      '2Bezpośredni mecz',
      '3Różnica bramek',
    ]);
    const unused = within(screen.getByRole('region', { name: 'Nieużywane' })).getAllByRole('listitem');
    expect(unused.map((item) => item.textContent)).toEqual(['Bramki zdobyte', 'Zwycięstwa']);
  });

  it('points nie da się przesunąć ani wyłączyć', async () => {
    standingsApi();
    await renderStandings();

    expect(screen.queryByRole('button', { name: /„Punkty w tabeli”/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /„Punkty w tabeli”/ })).not.toBeInTheDocument();
    // Pierwsze ruchome kryterium nie wejdzie nad `points`.
    expect(screen.getByRole('button', { name: 'Przesuń „Bezpośredni mecz” wyżej' })).toBeDisabled();
  });

  it('↑ i ↓ zmieniają szkic, a żądanie podglądu niesie nową listę', async () => {
    const { previews } = standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));
    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Różnica bramek', '3Bezpośredni mecz']);
    await waitFor(() => expect(previews).toContain('points,score_diff,head_to_head'));

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” niżej' }));
    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Bezpośredni mecz', '3Różnica bramek']);
  });

  it('podgląd podświetla drużyny, które zmieniają miejsce, i mówi o tym w stopce', async () => {
    standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));

    expect(await screen.findByText('Podgląd: 2 drużyny zmieniają miejsce.')).toBeInTheDocument();
    expect(teamOrder()).toEqual(['SUSokoły Ursus', 'WBWilki Bemowo', 'OBOrły Bielany']);
    expect(screen.getByRole('row', { name: /Sokoły Ursus/ })).toHaveTextContent('1, wcześniej 2.');
    expect(screen.getByRole('row', { name: /Orły Bielany/ })).not.toHaveTextContent('wcześniej');
    expect(
      screen.getByText(
        'Kolejność: punkty w tabeli → różnica bramek → bezpośredni mecz → nazwa drużyny (alfabetycznie).',
      ),
    ).toBeInTheDocument();
  });

  it('szkic bez skutku w tabeli mówi, że kolejność się nie zmienia', async () => {
    standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('switch', { name: 'Używaj kryterium „Zwycięstwa”' }));

    expect(await screen.findByText('Podgląd: kolejność w tabeli bez zmian.')).toBeInTheDocument();
  });

  it('wyłączenie przenosi kryterium do „Nieużywane”, a włączenie dokłada je na koniec', async () => {
    standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('switch', { name: 'Używaj kryterium „Bezpośredni mecz”' }));
    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Różnica bramek']);
    const unused = within(screen.getByRole('region', { name: 'Nieużywane' }));
    expect(unused.getByText('Bezpośredni mecz')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Używaj kryterium „Bezpośredni mecz”' }));
    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Różnica bramek', '3Bezpośredni mecz']);
  });
});

describe('tabela: zapis kolejności', () => {
  it('bez zmian nie ma „Zapisz kolejność” ani „Odrzuć”', async () => {
    standingsApi();
    await renderStandings();

    expect(screen.queryByRole('button', { name: 'Zapisz kolejność' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Odrzuć' })).not.toBeInTheDocument();
  });

  it('„Zapisz kolejność” wysyła PATCH z samym tiebreakers, daje toast i odświeża tabelę', async () => {
    const { patches, previews } = standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));
    await user.click(await screen.findByRole('button', { name: 'Zapisz kolejność' }));

    expect(await screen.findByText('Zapisano kolejność kryteriów.')).toBeInTheDocument();
    expect(patches).toEqual([{ tiebreakers: ['points', 'score_diff', 'head_to_head'] }]);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Zapisz kolejność' })).not.toBeInTheDocument());
    // Tabela bez parametru, już według zapisanej listy, a bez strzałek podglądu.
    expect(previews.at(-1)).toBeNull();
    expect(teamOrder()).toEqual(['SUSokoły Ursus', 'WBWilki Bemowo', 'OBOrły Bielany']);
    expect(screen.getByRole('table')).not.toHaveTextContent('wcześniej');
  });

  it('„Odrzuć” wraca do zapisanej listy i niczego nie wysyła', async () => {
    const { patches } = standingsApi();
    const { user } = await renderStandings();

    await user.click(screen.getByRole('switch', { name: 'Używaj kryterium „Bezpośredni mecz”' }));
    await user.click(await screen.findByRole('button', { name: 'Odrzuć' }));

    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Bezpośredni mecz', '3Różnica bramek']);
    expect(teamOrder()).toEqual(['WBWilki Bemowo', 'SUSokoły Ursus', 'OBOrły Bielany']);
    expect(patches).toEqual([]);
  });

  // Po „Odrzuć” nie ma szkicu, a nie szkic równy liście sprzed chwili: lista
  // zmieniona gdzie indziej przychodzi wtedy wprost, bez fałszywego „Zapisz”.
  it('po „Odrzuć” edytor idzie za listą turnieju odświeżoną z zewnątrz', async () => {
    const { setTournament } = standingsApi();
    const { user, queryClient } = await renderStandings();

    await user.click(screen.getByRole('switch', { name: 'Używaj kryterium „Bezpośredni mecz”' }));
    await user.click(await screen.findByRole('button', { name: 'Odrzuć' }));

    setTournament({ ...TOURNAMENT, tiebreakers: ['points', 'wins'] });
    await queryClient.invalidateQueries({ queryKey: ['tournament', 7] });

    await waitFor(() => expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Zwycięstwa']));
    expect(screen.queryByRole('button', { name: 'Zapisz kolejność' })).not.toBeInTheDocument();
  });

  it('422 pokazuje komunikat w karcie, a szkic zostaje', async () => {
    standingsApi({
      patch: () =>
        HttpResponse.json(
          {
            message: 'To kryterium nie jest dostępne w sporcie tego turnieju.',
            errors: { 'tiebreakers.2': ['To kryterium nie jest dostępne w sporcie tego turnieju.'] },
          },
          { status: 422 },
        ),
    });
    const { user } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));
    await user.click(await screen.findByRole('button', { name: 'Zapisz kolejność' }));

    const card = screen.getByRole('region', { name: 'Rozstrzyganie remisów' });
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      'To kryterium nie jest dostępne w sporcie tego turnieju.',
    );
    expect(usedCriteria()).toEqual(['1Punkty w tabeli zawsze pierwsze', '2Różnica bramek', '3Bezpośredni mecz']);
    expect(screen.getByRole('button', { name: 'Zapisz kolejność' })).toBeEnabled();
  });

  it('5xx daje komunikat ogólny w karcie', async () => {
    standingsApi({ patch: () => HttpResponse.json({ message: 'Wystąpił błąd serwera.' }, { status: 500 }) });
    const { user } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));
    await user.click(await screen.findByRole('button', { name: 'Zapisz kolejność' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać kolejności. Spróbuj ponownie.');
  });

  it('niezapisany szkic i klik w „Drużyny” pytają o niezapisane zmiany', async () => {
    standingsApi();
    const { user, router } = await renderStandings();

    await user.click(screen.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }));
    await user.click(
      within(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', { name: 'Drużyny' }),
    );

    expect(await screen.findByRole('dialog', { name: 'Masz niezapisane zmiany' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tournaments/7/standings');
  });
});

describe('tabele grup', () => {
  const GROUP_A: Group = { id: 31, name: 'Grupa A', order: 1, qualifiers: 2 };
  const GROUP_B: Group = { id: 32, name: 'Grupa B', order: 2, qualifiers: 1 };

  function groupStage(groups: Group[]): Stage {
    return { id: 21, type: 'group', name: 'Faza grupowa', order: 1, groups };
  }

  /**
   * Tabela grupy jak z backendu. W Grupie A miejsca 2 i 3 mają po 4 punkty,
   * więc przy dwóch wychodzących linia przecina remis.
   */
  function groupTable(group: Group, rows: StandingRow[]): StandingTable {
    return { ...tables(TOURNAMENT.tiebreakers)[0]!, stageId: 21, stageName: 'Faza grupowa', groupId: group.id, groupName: group.name, rows };
  }

  const groupARows = [
    row(1, 1, 'Wilki Bemowo', 6, 4),
    row(2, 2, 'Sokoły Ursus', 4, 1),
    row(3, 3, 'Orły Bielany', 4, 0),
    row(4, 4, 'Lwy Targówek', 0, -5),
  ];
  const groupBRows = [row(1, 5, 'Żubry Wola', 3, 2), row(2, 6, 'Rysie Mokotów', 0, -2)];

  /** Serwer z fazą grupową: `PATCH /groups/{group}` zmienia `qualifiers` w fazach. */
  function groupsApi({ groups = [GROUP_A, GROUP_B], patch }: { groups?: Group[]; patch?: () => Response } = {}) {
    let current = groups;
    const patches: unknown[] = [];
    let standingsRequests = 0;
    standingsApi({
      standings: () => {
        standingsRequests += 1;
        return current.map((group) => groupTable(group, group.id === GROUP_A.id ? groupARows : groupBRows));
      },
    });
    server.use(
      http.get(`${API}/tournaments/:id/stages`, () => HttpResponse.json({ data: [groupStage(current)] })),
      http.patch(`${API}/groups/:id`, async ({ request, params }) => {
        const body = (await request.json()) as { qualifiers: number };
        patches.push({ group: Number(params.id), ...body });
        if (patch) return patch();
        current = current.map((group) => (group.id === Number(params.id) ? { ...group, ...body } : group));
        return HttpResponse.json({ data: current.find((group) => group.id === Number(params.id)) });
      }),
    );
    return { patches, standingsRequests: () => standingsRequests };
  }

  const groupSection = (name: string) => screen.getByRole('region', { name: `Faza grupowa · ${name}` });
  const bodyRows = (section: HTMLElement) => within(section).getAllByRole('row').slice(1);

  /** Jak `renderStandings`, ale tabel jest kilka, więc czeka na sterowanie. */
  async function renderGroups() {
    const router = createMemoryRouter(routes, { initialEntries: ['/tournaments/7/standings'] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>,
    );
    // Linia wyjścia czeka na liczbę wychodzących z faz.
    await screen.findByRole('combobox', { name: 'Ile drużyn wychodzi z grupy Grupa A' });
    return { user: userEvent.setup() };
  }

  it('rysuje jedną tabelę na grupę, w kolejności grup, z nagłówkiem grupy', async () => {
    groupsApi();
    await renderGroups();

    expect(screen.getAllByRole('heading', { name: /^Faza grupowa/ }).map((heading) => heading.textContent)).toEqual([
      'Faza grupowa · Grupa A',
      'Faza grupowa · Grupa B',
    ]);
    expect(within(groupSection('Grupa B')).getByText('Żubry Wola')).toBeInTheDocument();
    expect(within(groupSection('Grupa A')).queryByText('Żubry Wola')).not.toBeInTheDocument();
  });

  it('rysuje linię pod ostatnim wychodzącym i plakietkę remisu na linii przy równych punktach', async () => {
    groupsApi();
    await renderGroups();

    const rows = bodyRows(groupSection('Grupa A'));
    expect(rows.map((tableRow) => tableRow.textContent?.includes('wychodzi z grupy'))).toEqual([true, true, false, false]);
    expect(rows.filter((tableRow) => tableRow.classList.contains('border-dashed'))).toEqual([rows[1]]);
    expect(rows.map((tableRow) => within(tableRow).queryByText('remis na linii') !== null)).toEqual([false, true, true, false]);
    expect(within(groupSection('Grupa A')).getByText('wychodzą')).toBeInTheDocument();

    // W Grupie B (wychodzi jedna, 3 do 0 punktów) remisu na linii nie ma.
    expect(within(groupSection('Grupa B')).queryByText('remis na linii')).not.toBeInTheDocument();
    expect(
      within(groupSection('Grupa A')).getByText(
        /Z grupy wychodzą 2 drużyny — miejsca nad przerywaną linią\. Remis na linii rozstrzyga organizer/,
      ),
    ).toBeInTheDocument();
    expect(within(groupSection('Grupa B')).getByText(/Z grupy wychodzi 1 drużyna —/)).toBeInTheDocument();
  });

  it('zmiana liczby wychodzących wysyła PATCH, odświeża tabele i przenosi linię', async () => {
    const { patches, standingsRequests } = groupsApi();
    const { user } = await renderGroups();
    const before = standingsRequests();

    await user.click(screen.getByRole('combobox', { name: 'Ile drużyn wychodzi z grupy Grupa A' }));
    await user.click(await screen.findByRole('option', { name: '3' }));

    await waitFor(() => {
      const rows = bodyRows(groupSection('Grupa A'));
      expect(rows.filter((tableRow) => tableRow.classList.contains('border-dashed'))).toEqual([rows[2]]);
    });
    expect(patches).toEqual([{ group: GROUP_A.id, qualifiers: 3 }]);
    expect(standingsRequests()).toBeGreaterThan(before);
    // Linia stoi teraz między 4 a 0 punktów — remisu na linii już nie ma.
    expect(within(groupSection('Grupa A')).queryByText('remis na linii')).not.toBeInTheDocument();
  });

  it('422 pod qualifiers siada przy sterowaniu i niczego nie zmienia', async () => {
    const message = 'Z grup muszą wyjść co najmniej dwie drużyny.';
    groupsApi({
      patch: () => HttpResponse.json({ message, errors: { qualifiers: [message] } }, { status: 422 }),
    });
    const { user } = await renderGroups();

    await user.click(screen.getByRole('combobox', { name: 'Ile drużyn wychodzi z grupy Grupa A' }));
    await user.click(await screen.findByRole('option', { name: '1' }));

    expect(await within(groupSection('Grupa A')).findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('combobox', { name: 'Ile drużyn wychodzi z grupy Grupa A' })).toHaveTextContent('2');
    const rows = bodyRows(groupSection('Grupa A'));
    expect(rows.filter((tableRow) => tableRow.classList.contains('border-dashed'))).toEqual([rows[1]]);
  });

  it('w turnieju z jedną grupą tabela jest jedna', async () => {
    groupsApi({ groups: [GROUP_A] });
    await renderGroups();

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Faza grupowa · Grupa A' })).toBeInTheDocument();
  });

  it('tabela ligi nie ma linii wyjścia ani sterowania', async () => {
    standingsApi();
    await renderStandings();

    expect(screen.queryByRole('combobox', { name: /Ile drużyn wychodzi/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/wychodzi z grupy/)).not.toBeInTheDocument();
    expect(screen.getByText('3 drużyny')).toBeInTheDocument();
  });
});
