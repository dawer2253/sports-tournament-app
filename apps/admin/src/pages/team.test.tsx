import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  KOWAL,
  NOWAK,
  SOKOLY,
  WILKI,
  renderPanel,
  serveTeams,
  validationError,
} from '../test/teams-api';

const LIST = '/tournaments/7/teams';
const SQUAD = `${LIST}/${WILKI.id}`;

async function renderSquad(path = SQUAD) {
  const rendered = renderPanel(path);
  await screen.findByRole('heading', { name: 'Wilki Bemowo' });
  return rendered;
}

describe('ekran składu', () => {
  it('pokazuje drużynę, jej skład i link „Drużyny” do listy, w karcie „Drużyny”', async () => {
    serveTeams();
    const { router, user } = await renderSquad();

    expect(await screen.findByRole('cell', { name: 'Marek Nowak' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Piotr Kowal' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', {
        name: 'Drużyny',
      }),
    ).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Drużyny', current: false }));
    expect(router.state.location.pathname).toBe(LIST);
  });

  it.each([
    ['403', { 'GET /teams/3': () => HttpResponse.json({ message: 'Cudza.' }, { status: 403 }) }],
    ['404', { 'GET /teams/3': () => HttpResponse.json({ message: 'Brak.' }, { status: 404 }) }],
    [
      'drużyna z innego turnieju',
      { 'GET /teams/3': () => HttpResponse.json({ data: { ...WILKI, tournamentId: 8 } }) },
    ],
  ])('%s daje „Nie ma takiej drużyny” z linkiem do listy', async (_, override) => {
    serveTeams({ override });
    const { router, user } = renderPanel(SQUAD);

    expect(await screen.findByText('Nie ma takiej drużyny')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Wilki Bemowo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń drużynę' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Wróć do listy drużyn' }));
    expect(router.state.location.pathname).toBe(LIST);
  });

  it('`teamId=abc` daje „Nie ma takiej drużyny” bez pytania API', async () => {
    const { requests } = serveTeams();
    renderPanel(`${LIST}/abc`);

    expect(await screen.findByText('Nie ma takiej drużyny')).toBeInTheDocument();
    expect(Object.keys(requests).filter((key) => key.includes('/teams/'))).toEqual([]);
  });

  it('inny błąd drużyny daje komunikat i ponowienie', async () => {
    let calls = 0;
    serveTeams({
      override: {
        'GET /teams/3': () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 })
            : undefined;
        },
      },
    });
    const { user } = renderPanel(SQUAD);

    expect(await screen.findByText('Nie udało się wczytać drużyny')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('heading', { name: 'Wilki Bemowo' })).toBeInTheDocument();
  });

  it('404 składu przy wczytanej drużynie też daje „Nie ma takiej drużyny”', async () => {
    // Drużynę usunięto między dwoma równoległymi żądaniami: ponowienie w tabeli
    // niczego by nie dało.
    serveTeams({
      override: {
        'GET /teams/3/players': () => HttpResponse.json({ message: 'Brak.' }, { status: 404 }),
      },
    });
    renderPanel(SQUAD);

    expect(await screen.findByText('Nie ma takiej drużyny')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  });

  it('pusty skład ma „Dodaj zawodnika” tylko w pustym stanie', async () => {
    serveTeams();
    renderPanel(`${LIST}/${SOKOLY.id}`);

    expect(await screen.findByText('Brak zawodników')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dodaj zawodnika' })).toHaveLength(1);
  });
});

describe('usunięcie drużyny', () => {
  it('przy zawodnikach mówi o kaskadzie', async () => {
    // „Serwer” liczy `playersCount` ze składu, jak backend.
    const players = Array.from({ length: 12 }, (_, index) => ({
      ...NOWAK,
      id: 200 + index,
      number: index + 1,
    }));
    serveTeams({ players });
    const { user } = await renderSquad();
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));

    expect(await screen.findByRole('alertdialog')).toHaveAccessibleDescription(
      'Usunie też 12 zawodników.',
    );
  });

  it('bez zawodników nie ma zdania o kaskadzie', async () => {
    serveTeams();
    const { user } = renderPanel(`${LIST}/${SOKOLY.id}`);
    await screen.findByRole('heading', { name: 'Sokoły Ursus' });
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Usunąć drużynę „Sokoły Ursus”?');
    expect(dialog).not.toHaveTextContent('Usunie też');
  });

  it('sukces wraca na listę z toastem i odświeża listę oraz turniej', async () => {
    const { requests } = serveTeams();
    const { router, user, invalidateQueries } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(await screen.findByText('Usunięto drużynę „Wilki Bemowo”.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Sokoły Ursus' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Wilki Bemowo' })).not.toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'teams'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7] });
    await waitFor(() => expect(requests['GET /tournaments/7']).toBe(2));
    // Usuniętej drużyny nikt już nie dopytuje.
    expect(requests['GET /teams/3']).toBe(1);
  });

  it('„Wstecz” po usunięciu nie pokazuje usuniętej drużyny z cache’u', async () => {
    let teamRequests = 0;
    serveTeams({
      override: {
        // Odświeżenie po powrocie odpowiada z opóźnieniem: bez niego `404`
        // przyszłoby, zanim test zdąży zobaczyć drużynę z cache'u.
        'GET /teams/3': async () => {
          teamRequests += 1;
          if (teamRequests > 1) await delay(300);
          return undefined;
        },
      },
    });
    const { router, user } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));
    await screen.findByRole('link', { name: 'Sokoły Ursus' });

    await router.navigate(-1);

    // Drużyna z cache'u mignęłaby z aktywnym „Usuń drużynę”, zanim odświeżenie
    // dostanie `404`.
    await expect(
      screen.findByRole('heading', { name: 'Wilki Bemowo' }, { timeout: 200 }),
    ).rejects.toThrow();
    expect(await screen.findByText('Nie ma takiej drużyny')).toBeInTheDocument();
  });

  it('`404` też wraca na listę, z toastem, że drużyny już nie było', async () => {
    serveTeams({
      override: {
        'DELETE /teams/3': () => HttpResponse.json({ message: 'Brak.' }, { status: 404 }),
      },
    });
    const { router, user } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));
    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(await screen.findByText('Drużyna została już usunięta.')).toBeInTheDocument();
  });

  it('`422` z guarda daje tryb zablokowany', async () => {
    const reason = 'Nie można usunąć: drużyna „Wilki Bemowo” ma rozegrane mecze.';
    serveTeams({ override: { 'DELETE /teams/3': () => validationError({ id: [reason] }) } });
    const { router, user } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Usuń drużynę' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Usuń drużynę' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(reason);
    expect(within(dialog).queryByRole('button', { name: 'Usuń drużynę' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(SQUAD);
  });
});

describe('zmiana nazwy drużyny', () => {
  it('po sukcesie unieważnia drużynę i listę drużyn', async () => {
    const { bodies } = serveTeams();
    const { user, invalidateQueries } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Zmień nazwę' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zmień nazwę drużyny' });
    const field = within(dialog).getByLabelText('Nazwa drużyny');
    expect(field).toHaveValue('Wilki Bemowo');
    await user.clear(field);
    await user.type(field, 'Wilki Bemowo II');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await screen.findByRole('heading', { name: 'Wilki Bemowo II' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Zapisano drużynę „Wilki Bemowo II”.')).toBeInTheDocument();
    expect(bodies['PATCH /teams/3']).toEqual([{ name: 'Wilki Bemowo II' }]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team', 3] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'teams'] });
  });

  it('`404` zamyka okno z ostrzeżeniem i pokazuje, że drużyny już nie ma', async () => {
    const { state } = serveTeams({
      override: {
        'PATCH /teams/3': () => {
          state.teams = state.teams.filter((team) => team.id !== WILKI.id);
          return HttpResponse.json({ message: 'Brak.' }, { status: 404 });
        },
      },
    });
    const { user } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Zmień nazwę' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zmień nazwę drużyny' });
    await user.type(within(dialog).getByLabelText('Nazwa drużyny'), ' II');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await screen.findByText('Tej drużyny już nie ma.')).toBeInTheDocument();
    expect(await screen.findByText('Nie ma takiej drużyny')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('duplikat daje `422` pod `name`, przy polu', async () => {
    const message = 'W tym turnieju jest już drużyna o tej nazwie.';
    serveTeams({ override: { 'PATCH /teams/3': () => validationError({ name: [message] }) } });
    const { user } = await renderSquad();

    await user.click(screen.getByRole('button', { name: 'Zmień nazwę' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zmień nazwę drużyny' });
    await user.clear(within(dialog).getByLabelText('Nazwa drużyny'));
    await user.type(within(dialog).getByLabelText('Nazwa drużyny'), 'Sokoły Ursus');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Nazwa drużyny')).toHaveAccessibleDescription(message),
    );
  });
});

describe('zawodnicy', () => {
  async function openPlayerDialog(user: ReturnType<typeof renderPanel>['user']) {
    await user.click(await screen.findByRole('button', { name: 'Dodaj zawodnika' }));
    return screen.findByRole('dialog', { name: 'Nowy zawodnik' });
  }

  it('puste numer i pozycja idą jako `null`, a po dodaniu lista drużyn jest pobierana od nowa', async () => {
    const { bodies } = serveTeams();
    const { user, invalidateQueries } = await renderSquad();

    const dialog = await openPlayerDialog(user);
    await user.type(within(dialog).getByLabelText('Imię i nazwisko'), 'Jan Wrona');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByRole('cell', { name: 'Jan Wrona' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Dodano zawodnika „Jan Wrona”.')).toBeInTheDocument();
    expect(bodies['POST /teams/3/players']).toEqual([
      { name: 'Jan Wrona', number: null, position: null },
    ]);
    // `playersCount` zmienia się w drużynie i na liście drużyn.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team', 3] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'teams'] });
  });

  it('`422` pod `number` siada przy polu', async () => {
    const message = 'W tej drużynie jest już zawodnik z tym numerem.';
    serveTeams({
      override: { 'POST /teams/3/players': () => validationError({ number: [message] }) },
    });
    const { user } = await renderSquad();

    const dialog = await openPlayerDialog(user);
    await user.type(within(dialog).getByLabelText('Imię i nazwisko'), 'Jan Wrona');
    await user.type(within(dialog).getByLabelText('Numer'), '9');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Numer')).toHaveAccessibleDescription(message),
    );
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('`422` pod `players` (limit) trafia nad formularz', async () => {
    const message = 'Drużyna może mieć najwyżej 50 zawodników.';
    serveTeams({
      override: { 'POST /teams/3/players': () => validationError({ players: [message] }) },
    });
    const { user } = await renderSquad();

    const dialog = await openPlayerDialog(user);
    await user.type(within(dialog).getByLabelText('Imię i nazwisko'), 'Jan Wrona');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
  });

  it('numer spoza 0–999 zatrzymuje `zod`, bez żądania', async () => {
    const { bodies } = serveTeams();
    const { user } = await renderSquad();

    const dialog = await openPlayerDialog(user);
    await user.type(within(dialog).getByLabelText('Imię i nazwisko'), 'Jan Wrona');
    await user.type(within(dialog).getByLabelText('Numer'), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(within(dialog).getByLabelText('Numer')).toHaveAccessibleDescription(
      'Numer to liczba całkowita od 0 do 999.',
    );
    expect(bodies['POST /teams/3/players']).toBeUndefined();
  });

  it('ołówek otwiera okno z danymi zawodnika i zapisuje zmianę', async () => {
    const { bodies } = serveTeams();
    const { user } = await renderSquad();

    await user.click(await screen.findByRole('button', { name: 'Edytuj zawodnika Marek Nowak' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edytuj zawodnika' });
    expect(within(dialog).getByLabelText('Numer')).toHaveValue('9');
    expect(within(dialog).getByLabelText('Pozycja')).toHaveValue('napastnik');
    await user.clear(within(dialog).getByLabelText('Numer'));
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await screen.findByText('Zapisano zawodnika „Marek Nowak”.')).toBeInTheDocument();
    expect(bodies[`PATCH /players/${NOWAK.id}`]).toEqual([
      { name: 'Marek Nowak', number: null, position: 'napastnik' },
    ]);
  });

  it('kosz usuwa zawodnika po potwierdzeniu', async () => {
    serveTeams();
    const { user, invalidateQueries } = await renderSquad();

    await user.click(await screen.findByRole('button', { name: 'Usuń zawodnika Piotr Kowal' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Usuń zawodnika' }));

    expect(await screen.findByText('Usunięto zawodnika „Piotr Kowal”.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: KOWAL.name })).not.toBeInTheDocument(),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['players', 3] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team', 3] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'teams'] });
  });
});
