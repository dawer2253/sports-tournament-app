import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Sport, StandingRow, StandingTable, Tournament } from '@tournament/api-client';
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
    },
  },
  {
    id: 2,
    code: 'basketball',
    name: 'Koszykówka',
    config: {
      allowsDraw: false,
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
    },
  },
];

const TOURNAMENT: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'head_to_head', 'score_diff'],
  teamsCount: 3,
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
  return [
    { stageId: 1, stageName: 'Faza zasadnicza', groupId: null, groupName: null, scoreLabel: 'Bramki', rows },
  ];
}

beforeEach(() => {
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
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
  return { previews, patches };
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
  return { router, user: userEvent.setup() };
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

  it('w koszykówce nagłówek zdobyczy to „Punkty”, a kolumny R nie ma', async () => {
    standingsApi({
      tournament: { ...TOURNAMENT, sport: { id: 2, code: 'basketball', name: 'Koszykówka' } },
      standings: (tiebreakers) => tables(tiebreakers).map((table) => ({ ...table, scoreLabel: 'Punkty' })),
    });
    await renderStandings();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '#', 'Drużyna', 'M', 'W', 'P', 'Punkty', '+/−', 'Pkt',
    ]);
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
