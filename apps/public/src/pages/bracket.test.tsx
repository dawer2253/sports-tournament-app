import type { Match } from '@tournament/api-client';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import { SLUG, asPublic, cup, cupMatches, publicApi, renderAt, tournament } from '../test/public-api';

/** Drabinka pucharu na stronie publicznej (#234, DoD „Vitest (`apps/public`)”). */

const tabs = () => within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Nagłówki kolumn okna. W jsdom kontener nie ma szerokości, więc okno ma
 * dwie kolumny, jak na telefonie.
 */
function headings() {
  return [...document.querySelectorAll('[data-slot="bracket-column-heading"] p:first-child')].map((heading) => heading.textContent);
}

function byId(matches: Match[], id: number): Match {
  return matches.find((match) => match.id === id)!;
}

/** Kafel meczu w drzewie po początku nazwy: „Półfinał 1: …”. */
async function tile(label: string) {
  return screen.findByRole('link', { name: new RegExp(`^${label.replace('.', '\\.')}:`) });
}

/** Wiersze listy meczów (Terminarz, Wyniki) w kolejności z DOM-u. */
function rows() {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="match-row"]')];
}

describe('zakładki', () => {
  it('puchar ma Przegląd, Drabinkę, Terminarz, Wyniki i Statystyki', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 4 }) });
    renderAt(`/t/${SLUG}/drabinka`);

    await screen.findByRole('group', { name: 'Rundy' });
    expect(tabs().getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Przegląd',
      'Drabinka',
      'Terminarz',
      'Wyniki',
      'Statystyki',
    ]);
    expect(tabs().getByRole('link', { name: 'Drabinka' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getByRole('link', { name: 'Drabinka' })).toHaveAttribute('href', `/t/${SLUG}/drabinka`);
  });

  it('liga zostaje przy swoich zakładkach i nie pyta o mecze fazy', async () => {
    const requests = publicApi();
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Tabela (skrót)' });
    expect(tabs().getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Przegląd',
      'Tabela',
      'Terminarz',
      'Wyniki',
      'Statystyki',
    ]);
    expect(requests.stageMatches).toEqual([]);
  });

  it('puchar pod /tabela daje pusty stan z odnośnikiem do drabinki i nie pyta o tabelę', async () => {
    const requests = publicApi({ data: cup(), stageMatches: cupMatches({ teams: 4 }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/tabela`);

    const link = await screen.findByRole('link', { name: 'Przejdź do drabinki' });
    expect(screen.getByText('Puchar nie ma tabeli')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', `/t/${SLUG}/drabinka`);
    expect(requests.standings).toBe(0);

    await user.click(link);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/drabinka`);
  });

  it('liga pod /drabinka daje pusty stan z odnośnikiem do tabeli', async () => {
    publicApi();
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByText('Ten turniej nie ma drabinki')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do tabeli' })).toHaveAttribute('href', `/t/${SLUG}/tabela`);
  });
});

describe('okno rund', () => {
  it('bez ?od= zaczyna się od rundy z pierwszym niezakończonym meczem', async () => {
    const requests = publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 2, finished: 1 } }) });
    renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał', 'Półfinał']));
    expect(requests.stageMatches).toContain('2');
  });

  it('zakończenie rundy w czasie oglądania nie przesuwa okna, a wyliczony start trafia do ?od=', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 2, finished: 3 } }) });
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał', 'Półfinał']));
    // `replace`: ten sam wpis historii, więc „wstecz” nie wraca na adres bez ?od=.
    await waitFor(() => expect(router.state.location.search).toBe('?od=2'));
    expect(router.state.historyAction).toBe('REPLACE');

    // Organizator kończy ostatni ćwierćfinał: z samej reguły okno poszłoby na półfinał i finał.
    expect((await tile('Półfinał 2')).getAttribute('aria-label')).toContain('Do ustalenia');
    const refreshed = publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 3, finished: 0 } }) });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    await waitFor(() => expect(refreshed.stageMatches).toEqual(['2']));
    // Dane w oknie się odświeżyły: zwycięzca ostatniego ćwierćfinału stoi już w półfinale.
    await waitFor(async () => expect((await tile('Półfinał 2')).getAttribute('aria-label')).not.toContain('Do ustalenia'));

    expect(headings()).toEqual(['Ćwierćfinał', 'Półfinał']);
    expect(router.state.location.search).toBe('?od=2');
  });

  it.each(['', '?od=4', '?od=9'])('po finale kończy się na finale (%s)', async (query) => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: 'done' }) });
    renderAt(`/t/${SLUG}/drabinka${query}`);

    await waitFor(() => expect(headings()).toEqual(['Półfinał', 'Finał']));
  });

  it('strzałka „›” przesuwa okno o rundę i zapisuje ?od=', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16 }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['1/8 finału', 'Ćwierćfinał']));
    await user.click(screen.getByRole('button', { name: 'Następna runda' }));

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał', 'Półfinał']));
    expect(router.state.location.search).toBe('?od=2');
  });

  it('gest w bok przesuwa okno o rundę, a ruch głównie pionowy go nie rusza', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16 }) });
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['1/8 finału', 'Ćwierćfinał']));
    const tree = document.querySelector('[data-slot="bracket-column"]')!.closest('[style*="touch-action"]')!;
    const swipe = (dx: number, dy: number) => {
      fireEvent.touchStart(tree, { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(tree, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
    };

    await waitFor(() => expect(router.state.location.search).toBe('?od=1'));
    swipe(30, 200);
    expect(headings()).toEqual(['1/8 finału', 'Ćwierćfinał']);
    expect(router.state.location.search).toBe('?od=1');

    swipe(-80, 10);
    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał', 'Półfinał']));
    expect(router.state.location.search).toBe('?od=2');
  });
});

describe('kafel meczu', () => {
  it('mecz live 2:1: nikt nie jest pogrubiony, mecz następny czeka na rywala, a pigułka rundy ma kropkę', async () => {
    publicApi({
      data: cup(),
      stageMatches: cupMatches({ teams: 4 }, { 1001: { status: 'live', homeScore: 2, awayScore: 1 } }),
    });
    renderAt(`/t/${SLUG}/drabinka`);

    const live = await tile('Półfinał 1');
    for (const name of live.querySelectorAll('[data-slot="bracket-tile-team"]')) {
      expect(name).not.toHaveClass('font-semibold');
    }
    // Awans dopiero przy `finished` (#216): w finale dalej nikogo nie ma.
    expect(screen.getByRole('link', { name: 'Finał: Do ustalenia – Do ustalenia' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Rundy' })).getByRole('button', { name: 'Półfinał, trwa mecz' })).toBeInTheDocument();
  });

  it('remis 1:1 po karnych 3:4 pogrubia gościa i jego karne, a gospodarz jest szary', async () => {
    const matches = cupMatches({ teams: 4 }, { 1001: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 } });
    publicApi({ data: cup(), stageMatches: matches });
    renderAt(`/t/${SLUG}/drabinka`);

    const semi = within(await tile('Półfinał 1'));
    const { homeTeam, awayTeam } = byId(matches, 1001);
    expect(semi.getByText(homeTeam!.name)).toHaveClass('text-muted-foreground');
    expect(semi.getByText(awayTeam!.name)).toHaveClass('font-semibold');
    expect(semi.getByText('(4)')).toHaveClass('font-bold');
    expect(semi.getByText('(3)')).not.toHaveClass('font-bold');
  });

  it('prowadzi na stronę meczu, a klik z Ctrl zostaje przeglądarce', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 4 }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    const semi = await tile('Półfinał 1');
    expect(semi).toHaveAttribute('href', `/t/${SLUG}/mecze/1001`);

    // `fireEvent` oddaje `false`, gdy ktoś wywołał `preventDefault()`.
    expect(fireEvent.click(semi, { ctrlKey: true })).toBe(true);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/drabinka`);

    await user.click(semi);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/mecze/1001`);
  });
});

describe('drzewo', () => {
  it('pod finałem stoją mistrz i mecz o 3. miejsce z podpisem', async () => {
    const matches = cupMatches({ teams: 4, progress: 'done' });
    publicApi({ data: cup(), stageMatches: matches });
    renderAt(`/t/${SLUG}/drabinka`);

    const champion = (await screen.findByText('Zwycięzca pucharu')).closest('[data-slot="bracket-champion"]')!;
    const final = byId(matches, 2001);
    const winner = final.homeScore! > final.awayScore! || (final.homePenalties ?? 0) > (final.awayPenalties ?? 0) ? final.homeTeam : final.awayTeam;
    expect(champion).toHaveTextContent(winner!.name);
    expect(screen.getByText('Mecz o 3. miejsce')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Mecz o 3\. miejsce:/ })).toHaveLength(1);
  });

  it('wolny los to przerywany kafel z nazwą drużyny', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 6 }) });
    renderAt(`/t/${SLUG}/drabinka`);

    const bye = await screen.findByRole('group', { name: 'Wolny los: Wilki Bemowo' });
    expect(bye).toHaveClass('border-dashed');
    expect(bye).toHaveTextContent('Wilki Bemowowolny los');
  });

  it('odpytuje mecze fazy co POLL_INTERVAL_MS, jak pozostałe zakładki', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requests = publicApi({ data: cup(), stageMatches: cupMatches({ teams: 4 }) });
    renderAt(`/t/${SLUG}/drabinka`);
    await tile('Półfinał 1');
    await waitFor(() => expect(requests.stageMatches).toEqual(['2']));

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await waitFor(() => expect(requests.stageMatches).toEqual(['2', '2']));
  });

  it('puchar bez wygenerowanej drabinki ma pusty stan', async () => {
    publicApi({ data: cup(), stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByText('Drabinki jeszcze nie ma')).toBeInTheDocument();
  });
});

describe('Przegląd pucharu', () => {
  it('ma kartę „Drabinka” zamiast skrótu tabeli: bieżąca runda, postęp i drużyny w grze', async () => {
    const matches = cupMatches({ teams: 8, progress: { round: 1, finished: 3 } });
    const requests = publicApi({
      data: cup(),
      stageMatches: matches,
      fixtures: matches.filter((match) => match.status !== 'finished').map(asPublic),
      results: matches.filter((match) => match.status === 'finished').map(asPublic),
    });
    renderAt(`/t/${SLUG}`);

    const card = await screen.findByRole('region', { name: 'Drabinka' });
    expect(await within(card).findByText('W grze 5 z 8 drużyn')).toBeInTheDocument();
    const current = card.querySelector('li[aria-current="step"]');
    expect(current).toHaveTextContent('Ćwierćfinał');
    expect(current).toHaveTextContent('3/4');
    expect(within(card).getByRole('link', { name: 'Zobacz drabinkę' })).toHaveAttribute('href', `/t/${SLUG}/drabinka`);
    expect(screen.queryByRole('region', { name: 'Tabela (skrót)' })).not.toBeInTheDocument();
    expect(requests.standings).toBe(0);
  });

  it('po finale rozstrzygniętym karnymi pokazuje mistrza i wynik finału z karnymi', async () => {
    const matches = cupMatches(
      { teams: 8, progress: 'done' },
      { 3001: { homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 2 } },
    );
    publicApi({ data: cup(), stageMatches: matches, results: matches.map(asPublic) });
    renderAt(`/t/${SLUG}`);

    const card = await screen.findByRole('region', { name: 'Drabinka' });
    const final = byId(matches, 3001);
    expect(await within(card).findByRole('status')).toHaveTextContent(`${final.homeTeam!.name}Zwycięzca pucharu`);
    const finalTile = within(within(card).getByRole('link', { name: /^Finał:/ }));
    expect(finalTile.getByText('(4)')).toHaveClass('font-bold');
    expect(finalTile.getByText('(2)')).not.toHaveClass('font-bold');
  });

  it('puchar bez wygenerowanej drabinki ma w karcie pusty stan', async () => {
    publicApi({ data: cup(), stageMatches: [] });
    renderAt(`/t/${SLUG}`);

    const card = await screen.findByRole('region', { name: 'Drabinka' });
    expect(within(card).getByText('Drabinka pojawi się tu, gdy organizator ją ułoży.')).toBeInTheDocument();
  });

  it('kafel „Na żywo” meczu o 3. miejsce ma etykietę „Mecz o 3. miejsce”, a nie „Finał”', async () => {
    const matches = cupMatches({ teams: 4, progress: { round: 2, finished: 0, live: 1 } });
    publicApi({ data: cup(), stageMatches: matches, fixtures: matches.filter((match) => match.round.order === 2).map(asPublic) });
    renderAt(`/t/${SLUG}`);

    const live = await screen.findByRole('region', { name: 'Na żywo' });
    await within(live).findByText('Mecz o 3. miejsce');
    expect(within(live).queryByText('Finał')).not.toBeInTheDocument();
  });
});

describe('Terminarz i Wyniki pucharu', () => {
  it('po obu półfinałach wiersz „Mecz o 3. miejsce” stoi przed finałem', async () => {
    const matches = cupMatches({ teams: 8, progress: { round: 3, finished: 0 } });
    // Półfinały są już tylko w Wynikach, więc z samego Terminarza etykiety nie da się policzyć.
    publicApi({ data: cup(), stageMatches: matches, fixtures: [byId(matches, 3002), byId(matches, 3001)].map(asPublic) });
    renderAt(`/t/${SLUG}/terminarz`);

    await waitFor(() => expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Mecz o 3. miejsce'),
      expect.stringContaining('Finał'),
    ]));
    expect(rows()[1]).not.toHaveTextContent('Mecz o 3. miejsce');
  });

  it('pusty slot finału ma podpis „Zwycięzca: Półfinał 1”', async () => {
    const matches = cupMatches({ teams: 8, progress: { round: 2, finished: 0 } });
    publicApi({
      data: cup(),
      stageMatches: matches,
      fixtures: matches.filter((match) => match.status !== 'finished').map(asPublic),
    });
    renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByText('Zwycięzca: Półfinał 1')).toHaveClass('italic');
    expect(screen.getByText('Przegrany: Półfinał 2')).toBeInTheDocument();
  });

  it('w Wynikach remis z karnymi pokazuje karne obu drużyn, pogrubione u zwycięzcy', async () => {
    const matches = cupMatches(
      { teams: 4, progress: { round: 1, finished: 1 } },
      { 1001: { homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 3 } },
    );
    publicApi({ data: cup(), stageMatches: matches, results: [asPublic(byId(matches, 1001))] });
    renderAt(`/t/${SLUG}/wyniki`);

    await waitFor(() => expect(rows()).toHaveLength(1));
    const row = within(rows()[0]!);
    expect(await row.findByText('Półfinał 1')).toBeInTheDocument();
    expect(row.getByText('(4)')).toHaveClass('font-bold');
    expect(row.getByText('(3)')).not.toHaveClass('font-bold');
  });

  it('liga nie dostaje etykiet pozycji ani miejsca na karne', async () => {
    publicApi({ data: tournament() });
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByText('Brak rozegranych meczów')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="penalties"]')).toBeNull();
  });
});
