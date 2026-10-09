import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Sport, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, PUBLIC_URL, server } from '../test/server';

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+02:00' },
};

/**
 * Konfiguracja sportów jak w przykładzie `GET /sports`, z jedną różnicą:
 * `tiebreakerLabels` ma klucze w kolejności, w jakiej odda je MySQL (najpierw
 * krótsze). Lista tiebreaków ma iść za `tournament.tiebreakers`, a nie za
 * kluczami tej mapy — przy kolejności z przykładu test by tego nie odróżnił.
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

const FOOTBALL: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  // Punktacja inna niż domyślna, żeby „Przywróć domyślne" miało co zmienić.
  points: { win: 2, draw: 1, loss: 0 },
  tiebreakers: ['points', 'score_diff', 'head_to_head'],
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

const BASKETBALL: Tournament = {
  ...FOOTBALL,
  name: 'Puchar Zimowy',
  slug: 'puchar-zimowy',
  status: 'draft',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka' },
  points: { win: 2, draw: 0, loss: 1 },
  tiebreakers: ['points', 'head_to_head'],
};

beforeEach(() => {
  setToken('1|token');
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
    http.get(`${API}/sports`, () => HttpResponse.json({ data: SPORTS })),
  );
});

/**
 * Turniej po stronie „serwera": `GET` oddaje bieżący stan, a `PATCH` scala
 * ciało i zapisuje je w `bodies`, chyba że test poda własną odpowiedź.
 * Asercja „nie poszło żadne żądanie" to pusta lista `bodies`.
 */
function tournamentApi(initial: Tournament, patch?: (body: unknown) => Response | undefined) {
  let current = initial;
  const bodies: unknown[] = [];
  server.use(
    http.get(`${API}/tournaments/:id`, () => HttpResponse.json({ data: current })),
    http.patch(`${API}/tournaments/:id`, async ({ request }) => {
      const body = (await request.json()) as Partial<Tournament>;
      bodies.push(body);
      const custom = patch?.(body);
      if (custom) return custom;
      current = {
        ...current,
        ...body,
        branding: { ...current.branding, ...body.branding },
      };
      return HttpResponse.json({ data: current });
    }),
  );
  return bodies;
}

function validationError(errors: Record<string, string[]>) {
  const message = Object.values(errors)[0]![0]!;
  return HttpResponse.json({ message, errors }, { status: 422 });
}

async function renderSettings() {
  const router = createMemoryRouter(routes, { initialEntries: ['/tournaments/7/settings'] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  // Formularz stoi dopiero po wczytaniu turnieju i sportów.
  await screen.findByRole('button', { name: 'Zapisz zmiany' });
  return { router, queryClient, user: userEvent.setup() };
}

const nameField = () => screen.getByLabelText('Nazwa');
const slugField = () => screen.getByLabelText('Adres strony');
const pointsField = (label: 'Wygrana' | 'Remis' | 'Porażka') => screen.getByLabelText(label);
const saveButton = () => screen.getByRole('button', { name: 'Zapisz zmiany' });

async function retype(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, value: string) {
  await user.clear(field);
  await user.type(field, value);
}

describe('ustawienia turnieju: formularz', () => {
  it('pokazuje zapisane wartości, a „Zapisz zmiany" bez zmian jest nieaktywny', async () => {
    tournamentApi(FOOTBALL);
    await renderSettings();

    expect(nameField()).toHaveValue('Liga Osiedlowa 2026');
    expect(slugField()).toHaveValue('liga-osiedlowa-2026');
    expect(pointsField('Wygrana')).toHaveValue(2);
    expect(pointsField('Remis')).toHaveValue(1);
    expect(pointsField('Porażka')).toHaveValue(0);
    expect(saveButton()).toBeDisabled();
  });

  it('tiebreaki idą w kolejności turnieju, z etykietami sportu', async () => {
    tournamentApi(FOOTBALL);
    await renderSettings();

    const items = within(screen.getByRole('group', { name: /rozstrzygania remisów/ })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '1Punkty w tabeli',
      '2Różnica bramek',
      '3Bezpośredni mecz',
    ]);
  });

  it('zmiana samej nazwy wysyła { name }, odświeża nagłówek i resetuje formularz', async () => {
    const bodies = tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    await retype(user, nameField(), 'Liga Osiedlowa 2026/27');
    await user.click(saveButton());

    expect(await screen.findByText('Zapisano zmiany.')).toBeInTheDocument();
    expect(bodies).toEqual([{ name: 'Liga Osiedlowa 2026/27' }]);
    expect(screen.getByRole('heading', { name: 'Liga Osiedlowa 2026/27' })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('zmiana samej wygranej wysyła komplet points i nic poza nim', async () => {
    const bodies = tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    await retype(user, pointsField('Wygrana'), '4');
    await user.click(saveButton());

    await screen.findByText('Zapisano zmiany.');
    expect(bodies).toEqual([{ points: { win: 4, draw: 1, loss: 0 } }]);
  });

  it('koszykówka nie ma pola „Remis", a zapis punktacji wysyła draw: 0', async () => {
    const bodies = tournamentApi(BASKETBALL);
    const { user } = await renderSettings();

    expect(screen.queryByLabelText('Remis')).not.toBeInTheDocument();
    await retype(user, pointsField('Wygrana'), '3');
    await user.click(saveButton());

    await screen.findByText('Zapisano zmiany.');
    expect(bodies).toEqual([{ points: { win: 3, draw: 0, loss: 1 } }]);
  });

  it.each([
    ['win: 11', { Wygrana: '11' }, 'Najwyżej 10 punktów.'],
    ['loss równe win', { Porażka: '2' }, 'Porażka musi dawać mniej punktów niż wygrana.'],
    ['w piłce draw > win', { Remis: '3' }, 'Remis musi dawać nie mniej punktów niż porażka i nie więcej niż wygrana.'],
  ] as const)('%s zatrzymuje klient, bez żądania', async (_, changes, message) => {
    const bodies = tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    for (const [label, value] of Object.entries(changes)) {
      await retype(user, pointsField(label as 'Wygrana' | 'Remis' | 'Porażka'), value);
    }
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('„Przywróć domyślne dla sportu" ustawia defaultPoints i niczego nie wysyła przed „Zapisz zmiany"', async () => {
    const bodies = tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Przywróć domyślne dla sportu' }));

    expect(pointsField('Wygrana')).toHaveValue(3);
    expect(pointsField('Remis')).toHaveValue(1);
    expect(pointsField('Porażka')).toHaveValue(0);
    expect(bodies).toEqual([]);

    await user.click(saveButton());
    await screen.findByText('Zapisano zmiany.');
    expect(bodies).toEqual([{ points: { win: 3, draw: 1, loss: 0 } }]);
  });

  it('odświeżenie turnieju z zewnątrz podmienia tylko pola, których organizer nie ruszył', async () => {
    let current = FOOTBALL;
    server.use(http.get(`${API}/tournaments/:id`, () => HttpResponse.json({ data: current })));
    const { user, queryClient } = await renderSettings();

    await retype(user, slugField(), 'liga-2027');
    // Np. zmiana z drugiej karty przeglądarki, którą przyniósł refetch.
    current = { ...FOOTBALL, name: 'Nazwa z innej karty', slug: 'inny-slug' };
    await act(() => queryClient.invalidateQueries({ queryKey: ['tournament', 7] }));

    await waitFor(() => expect(nameField()).toHaveValue('Nazwa z innej karty'));
    expect(slugField()).toHaveValue('liga-2027');
  });

  it('422 pod slug i pod points.win siada przy polach', async () => {
    tournamentApi(FOOTBALL, () =>
      validationError({
        slug: ['Ten adres jest już zajęty.'],
        'points.win': ['Wygrana może mieć najwyżej 10 punktów.'],
      }),
    );
    const { user } = await renderSettings();

    await retype(user, slugField(), 'zajety-adres');
    await retype(user, pointsField('Wygrana'), '5');
    await user.click(saveButton());

    expect(await screen.findByText('Ten adres jest już zajęty.')).toBeInTheDocument();
    expect(slugField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Wygrana może mieć najwyżej 10 punktów.')).toBeInTheDocument();
    expect(pointsField('Wygrana')).toHaveAttribute('aria-invalid', 'true');
  });

  it('422 pod points (porządek) trafia do karty punktacji', async () => {
    tournamentApi(FOOTBALL, () => validationError({ points: ['Porażka musi dawać mniej niż wygrana.'] }));
    const { user } = await renderSettings();

    await retype(user, pointsField('Wygrana'), '5');
    await user.click(saveButton());

    expect(await screen.findByText('Porażka musi dawać mniej niż wygrana.')).toBeInTheDocument();
  });
});

describe('ustawienia turnieju: slug', () => {
  const ALERT = 'Dotychczasowy adres /t/liga-osiedlowa-2026 przestanie działać. Przekierowania nie będzie.';

  it('w turnieju active alert pojawia się po zmianie sluga i znika po powrocie', async () => {
    tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    expect(screen.queryByText(ALERT)).not.toBeInTheDocument();
    await retype(user, slugField(), 'liga-2027');
    expect(screen.getByText(ALERT)).toBeInTheDocument();

    await retype(user, slugField(), 'liga-osiedlowa-2026');
    expect(screen.queryByText(ALERT)).not.toBeInTheDocument();
  });

  it('w szkicu alertu nie ma, jest tylko podgląd adresu', async () => {
    tournamentApi({ ...FOOTBALL, status: 'draft' });
    const { user } = await renderSettings();

    await retype(user, slugField(), 'liga-2027');

    expect(screen.queryByText(/przestanie działać/)).not.toBeInTheDocument();
    expect(screen.getByText(`${PUBLIC_URL}/t/liga-2027`)).toBeInTheDocument();
  });
});

describe('ustawienia turnieju: status', () => {
  it('w szkicu jest tylko „Opublikuj", bez linku; publikacja wysyła samo { status } i zostawia wpisaną nazwę', async () => {
    const bodies = tournamentApi({ ...FOOTBALL, status: 'draft' });
    const { user } = await renderSettings();

    const card = within(screen.getByText('Status').closest('[data-slot="tournament-status-card"]') as HTMLElement);
    expect(card.getAllByRole('button').map((button) => button.textContent)).toEqual(['Opublikuj']);
    expect(screen.queryByRole('link', { name: /Otwórz stronę/ })).not.toBeInTheDocument();

    await retype(user, nameField(), 'Nowa nazwa');
    await user.click(card.getByRole('button', { name: 'Opublikuj' }));

    expect(await screen.findByText('Opublikowano turniej.')).toBeInTheDocument();
    expect(bodies).toEqual([{ status: 'active' }]);
    // Po odświeżeniu turnieju karta pokazuje nowy stan, a pole trzyma wpis organizera.
    expect(await card.findByRole('button', { name: 'Zakończ' })).toBeInTheDocument();
    expect(nameField()).toHaveValue('Nowa nazwa');
    expect(saveButton()).toBeEnabled();
  });

  it('„Cofnij do szkicu" otwiera okno, a 422 pod status zostawia je otwarte z komunikatem serwera', async () => {
    const message = 'Turniej ma zakończone mecze, więc nie wróci do szkicu.';
    const bodies = tournamentApi(FOOTBALL, () => validationError({ status: [message] }));
    const { user } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Cofnij do szkicu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cofnąć turniej do szkicu?' });
    expect(within(dialog).getByText('Strona /t/liga-osiedlowa-2026 przestanie być widoczna.')).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Cofnij do szkicu' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(bodies).toEqual([{ status: 'draft' }]);
    expect(screen.getByRole('dialog', { name: 'Cofnąć turniej do szkicu?' })).toBeInTheDocument();
  });

  it('link „Otwórz stronę" w turnieju active prowadzi pod VITE_PUBLIC_URL i zapisany slug', async () => {
    tournamentApi(FOOTBALL);
    const { user } = await renderSettings();

    // Wpisany, a niezapisany slug nie zmienia linku: tamten adres jeszcze nie istnieje.
    await retype(user, slugField(), 'liga-2027');

    expect(screen.getByRole('link', { name: /Otwórz stronę/ })).toHaveAttribute(
      'href',
      `${PUBLIC_URL}/t/liga-osiedlowa-2026`,
    );
  });
});

describe('ustawienia turnieju: niezapisane zmiany', () => {
  function teamsTab() {
    return within(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', {
      name: 'Drużyny',
    });
  }

  it('brudny formularz i klik w „Drużyny" pytają o niezapisane zmiany', async () => {
    tournamentApi(FOOTBALL);
    const { user, router } = await renderSettings();

    await retype(user, nameField(), 'Nowa nazwa');
    await user.click(teamsTab());

    const dialog = await screen.findByRole('dialog', { name: 'Masz niezapisane zmiany' });
    expect(router.state.location.pathname).toBe('/tournaments/7/settings');

    await user.click(within(dialog).getByRole('button', { name: 'Zostań' }));
    expect(router.state.location.pathname).toBe('/tournaments/7/settings');
    expect(nameField()).toHaveValue('Nowa nazwa');

    await user.click(teamsTab());
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Masz niezapisane zmiany' })).getByRole('button', {
        name: 'Wyjdź bez zapisywania',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/tournaments/7/teams'));
  });

  it('po zapisie przejście na „Drużyny" już nie pyta', async () => {
    tournamentApi(FOOTBALL);
    const { user, router } = await renderSettings();

    await retype(user, nameField(), 'Nowa nazwa');
    await user.click(saveButton());
    await screen.findByText('Zapisano zmiany.');
    await user.click(teamsTab());

    await waitFor(() => expect(router.state.location.pathname).toBe('/tournaments/7/teams'));
    expect(screen.queryByRole('dialog', { name: 'Masz niezapisane zmiany' })).not.toBeInTheDocument();
  });
});

describe('ustawienia turnieju: usuwanie', () => {
  /**
   * Lista turniejów po stronie „serwera": `DELETE` zdejmuje z niej turniej,
   * chyba że test poda własną odpowiedź. `GET /tournaments` oddaje to, co
   * zostało, więc „turnieju nie ma na liście" sprawdza odświeżenie listy.
   */
  function deleteApi(remove?: () => Response | undefined) {
    let tournaments = [FOOTBALL];
    const deletes: string[] = [];
    tournamentApi(FOOTBALL);
    server.use(
      http.get(`${API}/tournaments`, () =>
        HttpResponse.json({
          data: tournaments,
          meta: { currentPage: 1, lastPage: 1, perPage: 20, total: tournaments.length },
        }),
      ),
      http.delete(`${API}/tournaments/:id`, ({ params }) => {
        deletes.push(String(params.id));
        const custom = remove?.();
        if (custom) return custom;
        tournaments = tournaments.filter(({ id }) => String(id) !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return deletes;
  }

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Usuń turniej' }));
    return screen.findByRole('alertdialog', { name: 'Usunąć turniej „Liga Osiedlowa 2026”?' });
  }

  const confirmField = (dialog: HTMLElement) => within(dialog).getByLabelText(/aby potwierdzić/);
  const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Usuń turniej' });

  it('okno opisuje skutki, a „Usuń turniej" działa dopiero przy nazwie co do wielkości liter', async () => {
    const deletes = deleteApi();
    const { user } = await renderSettings();

    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent(/nie da się cofnąć/);
    expect(dialog).toHaveTextContent('/t/liga-osiedlowa-2026');
    expect(confirmButton(dialog)).toBeDisabled();

    await user.type(confirmField(dialog), 'liga osiedlowa 2026');
    expect(confirmButton(dialog)).toBeDisabled();

    // Spacje na brzegach nie przeszkadzają, wielkość liter tak.
    await retype(user, confirmField(dialog), '  Liga Osiedlowa 2026 ');
    expect(confirmButton(dialog)).toBeEnabled();
    expect(deletes).toEqual([]);
  });

  it('204 prowadzi na listę z toastem, turnieju na niej nie ma, a z cache znika', async () => {
    const deletes = deleteApi();
    const { user, router, queryClient } = await renderSettings();

    const dialog = await openDialog(user);
    await user.type(confirmField(dialog), 'Liga Osiedlowa 2026');
    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Usunięto turniej „Liga Osiedlowa 2026”.')).toBeInTheDocument();
    expect(deletes).toEqual(['7']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Nie masz jeszcze turniejów')).toBeInTheDocument();
    // Cofnięcie w przeglądarce ma zapytać API, a nie pokazać turniej z pamięci.
    expect(queryClient.getQueryData(['tournament', 7])).toBeUndefined();
  });

  it('niezapisane zmiany w formularzu nie zatrzymują wyjścia po usunięciu', async () => {
    deleteApi();
    const { user, router } = await renderSettings();

    await retype(user, nameField(), 'Nowa nazwa');
    const dialog = await openDialog(user);
    await user.type(confirmField(dialog), 'Liga Osiedlowa 2026');
    await user.click(confirmButton(dialog));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.queryByRole('dialog', { name: 'Masz niezapisane zmiany' })).not.toBeInTheDocument();
  });

  it('422 zostawia otwarte okno z message z odpowiedzi i bez przycisku usuwania', async () => {
    const message = 'Nie można usunąć: turniej „Liga Osiedlowa 2026” ma powiązane rozegrane mecze.';
    deleteApi(() => validationError({ id: [message] }));
    const { user, router } = await renderSettings();

    const dialog = await openDialog(user);
    await user.type(confirmField(dialog), 'Liga Osiedlowa 2026');
    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).queryByRole('button', { name: 'Usuń turniej' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zamknij' })).toBeEnabled();
    expect(router.state.location.pathname).toBe('/tournaments/7/settings');
  });

  it('404 prowadzi na listę z toastem „Turniej został już usunięty."', async () => {
    deleteApi(() => HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 }));
    const { user, router } = await renderSettings();

    const dialog = await openDialog(user);
    await user.type(confirmField(dialog), 'Liga Osiedlowa 2026');
    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Turniej został już usunięty.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('500 pokazuje ogólny komunikat, a „Usuń turniej" da się kliknąć ponownie', async () => {
    let fail = true;
    const deletes = deleteApi(() =>
      fail ? HttpResponse.json({ message: 'Wewnętrzny błąd serwera.' }, { status: 500 }) : undefined,
    );
    const { user, router } = await renderSettings();

    const dialog = await openDialog(user);
    await user.type(confirmField(dialog), 'Liga Osiedlowa 2026');
    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Nie udało się usunąć. Spróbuj ponownie.',
    );
    expect(confirmButton(dialog)).toBeEnabled();

    fail = false;
    await user.click(confirmButton(dialog));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(deletes).toEqual(['7', '7']);
  });
});
