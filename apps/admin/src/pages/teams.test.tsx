import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { WILKI, renderPanel, serveTeams, validationError } from '../test/teams-api';

const LIST = '/tournaments/7/teams';

function table() {
  return within(screen.getByRole('table'));
}

async function openCreateDialog(user: ReturnType<typeof renderPanel>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Dodaj drużynę' }));
  return screen.findByRole('dialog', { name: 'Nowa drużyna' });
}

describe('lista drużyn', () => {
  it('pokazuje drużyny z liczbą zawodników, a nazwa prowadzi do składu', async () => {
    serveTeams();
    const { router, user } = renderPanel(LIST);

    const link = await screen.findByRole('link', { name: 'Wilki Bemowo' });
    expect(link).toHaveAttribute('href', `${LIST}/${WILKI.id}`);
    expect(table().getByRole('row', { name: /Wilki Bemowo/ })).toHaveTextContent('2');

    await user.click(link);

    expect(router.state.location.pathname).toBe(`${LIST}/${WILKI.id}`);
    expect(await screen.findByRole('heading', { name: 'Wilki Bemowo' })).toBeInTheDocument();
  });

  it('pusta lista ma „Dodaj drużynę” w pustym stanie, a nie w nagłówku', async () => {
    serveTeams({ teams: [], players: [] });
    const { user } = renderPanel(LIST);

    expect(await screen.findByText('Turniej nie ma jeszcze drużyn')).toBeInTheDocument();
    // Jeden przycisk: dwa „Dodaj drużynę” jeden pod drugim mówiłyby to samo.
    expect(screen.getAllByRole('button', { name: 'Dodaj drużynę' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Dodaj drużynę' }));
    expect(await screen.findByRole('dialog', { name: 'Nowa drużyna' })).toBeInTheDocument();
  });

  it('błąd pokazuje komunikat i ponowienie, które pyta API jeszcze raz', async () => {
    let calls = 0;
    const { requests } = serveTeams({
      override: {
        'GET /tournaments/7/teams': () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 })
            : undefined;
        },
      },
    });
    const { user } = renderPanel(LIST);

    expect(await screen.findByText('Nie udało się wczytać drużyn')).toBeInTheDocument();
    expect(screen.getByText('Serwer nie odpowiada.')).toBeInTheDocument();
    // Przy błędzie liczy się ponowienie, nie dodawanie kolejnej drużyny.
    expect(screen.queryByRole('button', { name: 'Dodaj drużynę' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('link', { name: 'Wilki Bemowo' })).toBeInTheDocument();
    expect(requests['GET /tournaments/7/teams']).toBe(2);
  });
});

describe('dodanie drużyny', () => {
  it('po sukcesie zostaje na liście z nową drużyną i toastem, a turniej się odświeża', async () => {
    const { requests, bodies } = serveTeams();
    const { router, user, invalidateQueries } = renderPanel(LIST);

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText('Nazwa drużyny'), '  Orły Bielany ');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(LIST);
    expect(screen.getByRole('link', { name: 'Orły Bielany' })).toBeInTheDocument();
    expect(await screen.findByText('Dodano drużynę „Orły Bielany”.')).toBeInTheDocument();
    expect(bodies['POST /tournaments/7/teams']).toEqual([{ name: 'Orły Bielany' }]);
    // `teamsCount` w turnieju: turniej pobrany drugi raz, bo trasa-rodzic go trzyma.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7] });
    await waitFor(() => expect(requests['GET /tournaments/7']).toBe(2));
  });

  it('`422` pod `name` siada przy polu', async () => {
    const message = 'W tym turnieju jest już drużyna o tej nazwie.';
    serveTeams({
      override: { 'POST /tournaments/7/teams': () => validationError({ name: [message] }) },
    });
    const { user } = renderPanel(LIST);

    const dialog = await openCreateDialog(user);
    const field = within(dialog).getByLabelText('Nazwa drużyny');
    await user.type(field, 'wilki bemowo');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    await waitFor(() => expect(field).toHaveAccessibleDescription(message));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('`422` pod `teams` (limit) trafia nad formularz', async () => {
    const message = 'Turniej może mieć najwyżej 128 drużyn.';
    serveTeams({
      override: { 'POST /tournaments/7/teams': () => validationError({ teams: [message] }) },
    });
    const { user } = renderPanel(LIST);

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText('Nazwa drużyny'), 'Orły Bielany');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByLabelText('Nazwa drużyny')).not.toHaveAttribute('aria-invalid');
  });

  it('pusta nazwa nie idzie do API', async () => {
    const { bodies } = serveTeams();
    const { user } = renderPanel(LIST);

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText('Nazwa drużyny'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(
      await within(dialog).findByText('Podaj nazwę drużyny.'),
    ).toBeInTheDocument();
    expect(bodies['POST /tournaments/7/teams']).toBeUndefined();
  });
});
