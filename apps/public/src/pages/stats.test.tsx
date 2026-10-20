import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LEADERBOARD_ERROR, SLUG, leaderRow, leaderboard, publicApi, renderAt, tournament } from '../test/public-api';

const BASKETBALL = tournament({
  name: 'Liga Koszykówki 2026',
  sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false },
  stats: [
    { code: 'points', label: 'Punkty' },
    { code: 'fouls', label: 'Faule' },
  ],
});

/** Klasyfikacje koszykówki: punkty (domyślna, bez parametru) i faule, każda z innym zawodnikiem. */
const basketballBoards = (stat: string | null) =>
  stat === 'fouls'
    ? leaderboard({ stat: 'fouls', label: 'Faule', rows: [leaderRow(7, { value: 5 })] })
    : leaderboard({ stat: 'points', label: 'Punkty', rows: [leaderRow(1, { value: 40 })] });

/** Treść każdego wiersza ciała klasyfikacji, komórka po komórce, w kolejności z DOM-u. */
function bodyRows() {
  const [, ...rows] = within(screen.getByRole('table')).getAllByRole('row');
  return rows.map((tr) => within(tr).getAllByRole('cell').map((cell) => cell.textContent));
}

/** Żądania o klasyfikację bez kolejności: zapytania statystyk idą równolegle. */
const sorted = (requests: (string | null)[]) => [...requests].sort((a, b) => String(a).localeCompare(String(b)));

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

  it('piłka bez ?stat pobiera każdą statystykę dokładnie raz, pierwszą bez parametru', async () => {
    const requests = publicApi({ leaderboards: (stat) => leaderboard({ stat: stat ?? 'goals', rows: [leaderRow(1)] }) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByRole('table');
    await waitFor(() => expect(sorted(requests.leaderboard)).toEqual(sorted([null, 'yellowCards', 'redCards'])));
  });

  it('wejście z ?stat=fouls w koszu pyta o fouls i o domyślną bez parametru, po razie', async () => {
    const requests = publicApi({ data: BASKETBALL, leaderboards: basketballBoards });
    renderAt(`/t/${SLUG}/statystyki?stat=fouls`);

    expect(await screen.findByRole('tab', { name: 'Faule' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Punkty', 'Faule']);
    await screen.findByRole('columnheader', { name: 'Faule' });
    await waitFor(() => expect(sorted(requests.leaderboard)).toEqual(sorted(['fouls', null])));
  });

  it('kod spoza statystyk turnieju (?stat=goals w koszu) nie trafia do żadnego żądania', async () => {
    // `goals` to kod piłki, a turniej jest koszykarski: API dałoby 422.
    const requests = publicApi({ data: BASKETBALL, leaderboards: basketballBoards });
    renderAt(`/t/${SLUG}/statystyki?stat=goals`);

    expect(await screen.findByRole('tab', { name: 'Punkty' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByRole('columnheader', { name: 'Punkty' });
    await waitFor(() => expect(sorted(requests.leaderboard)).toEqual(sorted([null, 'fouls'])));
    expect(requests.leaderboard).not.toContain('goals');
  });

  it('klik w zakładkę ustawia ?stat=, powrót do pierwszej zdejmuje parametr, a żadna zmiana nie dokłada żądania', async () => {
    const requests = publicApi({ leaderboards: (stat) => leaderboard({ stat: stat ?? 'goals', rows: [leaderRow(1)] }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/statystyki`);

    await screen.findByRole('table');
    await waitFor(() => expect(requests.leaderboard).toHaveLength(3));
    const onEntry = [...requests.leaderboard];

    await user.click(screen.getByRole('tab', { name: 'Żółte kartki' }));
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/statystyki`);
    expect(router.state.location.search).toBe('?stat=yellowCards');
    expect(screen.getByRole('tab', { name: 'Żółte kartki' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Bramki' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true');

    // „Cała klasyfikacja” w bocznej kolumnie to ten sam wybór co zakładka.
    const red = screen.getByRole('region', { name: 'Czerwone kartki' });
    await user.click(within(red).getByRole('link', { name: 'Cała klasyfikacja' }));
    expect(router.state.location.search).toBe('?stat=redCards');
    expect(screen.getByRole('tab', { name: 'Czerwone kartki' })).toHaveAttribute('aria-selected', 'true');

    expect(requests.leaderboard).toEqual(onEntry);
  });

  it('kolumna wartości idzie za label odpowiedzi, nie za zakładką ani sportem turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a klasyfikacja mówi
    // „Punkty”. Zgodna para przeszłaby też widokowi, który bierze etykietę
    // z zakładki albo ze sportu, a ADR-0006 mówi, że niesie ją odpowiedź.
    publicApi({ leaderboards: () => leaderboard({ label: 'Punkty', rows: [leaderRow(1)] }) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true');
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

  it('boczna kolumna pokazuje wiersze z odpowiedzi swojej statystyki: faule obok punktów w koszu', async () => {
    publicApi({ data: BASKETBALL, leaderboards: basketballBoards });
    renderAt(`/t/${SLUG}/statystyki`);

    const fouls = await screen.findByRole('region', { name: 'Faule' });
    await waitFor(() => expect(within(fouls).getAllByRole('listitem').map((row) => row.textContent)).toEqual([expect.stringMatching(/Zawodnik 7.*5/)]));
    expect(bodyRows()).toEqual([['1', expect.stringMatching(/Zawodnik 1/), '40']]);
    expect(screen.queryByRole('region', { name: 'Punkty' })).not.toBeInTheDocument();
  });

  it('błąd 500 klasyfikacji w bocznej kolumnie zostawia główną klasyfikację widoczną', async () => {
    publicApi({ data: BASKETBALL, leaderboards: (stat) => (stat === 'fouls' ? LEADERBOARD_ERROR : basketballBoards(stat)) });
    renderAt(`/t/${SLUG}/statystyki`);

    const fouls = await screen.findByRole('region', { name: 'Faule' });
    expect(await within(fouls).findByRole('alert')).toHaveTextContent('Serwer odpowiedział błędem');
    expect(within(fouls).getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
    expect(bodyRows()).toEqual([['1', expect.stringMatching(/Zawodnik 1/), '40']]);
  });

  it('błąd głównej klasyfikacji daje stan błędu z ponowieniem', async () => {
    publicApi({ data: BASKETBALL, leaderboards: (stat) => (stat === null ? LEADERBOARD_ERROR : basketballBoards(stat)) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer odpowiedział błędem');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('przed pierwszym meczem zakończonym ekran mówi, kiedy klasyfikacja ruszy, bez tabeli i bocznej kolumny', async () => {
    publicApi();
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByText('Klasyfikacja ruszy po pierwszym zakończonym meczu')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Pozostałe statystyki' })).not.toBeInTheDocument();
  });

  it('turniej bez statystyk mówi to wprost i o nic nie pyta', async () => {
    const requests = publicApi({ data: tournament({ stats: [] }) });
    renderAt(`/t/${SLUG}/statystyki`);

    expect(await screen.findByRole('heading', { name: 'Ten turniej nie ma statystyk' })).toBeInTheDocument();
    expect(requests.leaderboard).toEqual([]);
  });
});
