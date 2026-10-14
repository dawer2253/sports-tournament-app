import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SLUG, leaderRow, leaderboard, publicApi, renderAt, tournament } from '../test/public-api';

const BASKETBALL = tournament({
  name: 'Liga Koszykówki 2026',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false },
  stats: [
    { code: 'points', label: 'Punkty' },
    { code: 'fouls', label: 'Faule' },
  ],
});

/** Treść każdego wiersza ciała tabeli, komórka po komórce, w kolejności z DOM-u. */
function bodyRows() {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map((tr) => within(tr).getAllByRole('cell').map((cell) => cell.textContent));
}

describe('Statystyki', () => {
  it('zakładka „Statystyki” stoi za Wynikami i prowadzi pod /statystyki', async () => {
    publicApi();
    renderAt(`/t/${SLUG}/statystyki`);

    const nav = within(await screen.findByRole('navigation', { name: 'Sekcje turnieju' }));
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Przegląd',
      'Tabela',
      'Terminarz',
      'Wyniki',
      'Statystyki',
    ]);
    expect(nav.getByRole('link', { name: 'Statystyki' })).toHaveAttribute('href', `/t/${SLUG}/statystyki`);
    expect(nav.getByRole('link', { name: 'Statystyki' })).toHaveAttribute('aria-current', 'page');
  });

  it('bez ?stat ekran pyta bez parametru, a wybrana jest pierwsza statystyka turnieju', async () => {
    const requests = publicApi({ data: BASKETBALL, leaderboards: () => leaderboard({ stat: 'points', label: 'Punkty' }) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('tab', { name: 'Punkty' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Punkty', 'Faule']);
    expect(requests.leaderboard).toEqual([null]);
  });

  it('klik w statystykę wysyła ?stat= i zmienia adres', async () => {
    const requests = publicApi();
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/statystyki`);

    await user.click(await screen.findByRole('tab', { name: 'Żółte kartki' }));

    await waitFor(() => expect(requests.leaderboard).toContain('yellowCards'));
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/statystyki`);
    expect(router.state.location.search).toBe('?stat=yellowCards');
    expect(screen.getByRole('tab', { name: 'Żółte kartki' })).toHaveAttribute('aria-selected', 'true');
  });

  it('powrót do pierwszej statystyki zdejmuje parametr, więc domyślna klasyfikacja ma jeden adres', async () => {
    const requests = publicApi();
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/statystyki?stat=redCards`);

    await user.click(await screen.findByRole('tab', { name: 'Bramki' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(requests.leaderboard).toEqual(['redCards', null]));
  });

  it('wejście z ?stat=fouls od razu pyta o fouls, bez żądania o domyślną', async () => {
    const requests = publicApi({ data: BASKETBALL, leaderboards: () => leaderboard({ stat: 'fouls', label: 'Faule' }) });
    renderAt(`/t/${SLUG}/statystyki?stat=fouls`);

    expect(await screen.findByRole('tab', { name: 'Faule' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByRole('heading', { name: 'Faule' });
    expect(requests.leaderboard).toEqual(['fouls']);
  });

  it('kod spoza stats w adresie pyta bez parametru i wybiera pierwszą statystykę', async () => {
    // `goals` to kod piłki, a turniej jest koszykarski: API dałoby 422.
    const requests = publicApi({ data: BASKETBALL, leaderboards: () => leaderboard({ stat: 'points', label: 'Punkty' }) });
    renderAt(`/t/${SLUG}/statystyki?stat=goals`);

    expect(await screen.findByRole('tab', { name: 'Punkty' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByRole('heading', { name: 'Punkty' });
    expect(requests.leaderboard).toEqual([null]);
  });

  it('nagłówek ekranu i kolumny wartości idą za label odpowiedzi, nie za sportem turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a klasyfikacja mówi
    // „Punkty”. Zgodna para przeszłaby też widokowi, który bierze etykietę
    // z zakładki albo ze sportu, a ADR-0006 mówi, że niesie ją odpowiedź.
    publicApi({ leaderboards: () => leaderboard({ label: 'Punkty', rows: [leaderRow(1)] }) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('heading', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
  });

  it('wiersze wychodzą w kolejności i z pozycjami z API, także dzielonymi', async () => {
    publicApi({
      leaderboards: () =>
        leaderboard({
          rows: [
            leaderRow(1, { position: 1, value: 4 }),
            leaderRow(2, { position: 2, value: 2 }),
            leaderRow(3, { position: 3, value: 1 }),
            leaderRow(5, { position: 3, value: 1 }),
            leaderRow(4, { position: 3, value: 1 }),
          ],
        }),
    });
    renderAt(`/t/${SLUG}/statystyki`);

    await screen.findByRole('table');
    expect(bodyRows()).toEqual([
      ['1', expect.stringMatching(/Zawodnik 1.*Drużyna 1/), '4'],
      ['2', expect.stringMatching(/Zawodnik 2.*Drużyna 2/), '2'],
      ['3', expect.stringMatching(/Zawodnik 3.*Drużyna 3/), '1'],
      ['3', expect.stringMatching(/Zawodnik 5.*Drużyna 5/), '1'],
      ['3', expect.stringMatching(/Zawodnik 4.*Drużyna 4/), '1'],
    ]);
  });

  it('przed pierwszym meczem zakończonym ekran mówi, kiedy klasyfikacja ruszy', async () => {
    publicApi();
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByText('Klasyfikacja ruszy po pierwszym zakończonym meczu')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
