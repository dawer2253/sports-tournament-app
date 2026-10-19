import type { Match } from '@tournament/api-client';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import { SLUG, asPublic, cup, cupMatches, publicApi, renderAt, tournament } from '../test/public-api';

/** Drabinka pucharu na stronie publicznej (#234, #293, DoD „Vitest (`apps/public`)”). */

const tabs = () => within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Nagłówki kolumn okna. W jsdom kontener nie ma szerokości, więc okno ma
 * jedną kolumnę, jak na telefonie.
 */
function headings() {
  return [...document.querySelectorAll('[data-slot="bracket-round-head"] [data-slot="bracket-round-name"]')].map(
    (heading) => heading.textContent,
  );
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

  it('liga pod /drabinka daje pusty stan z odnośnikiem do Tabeli i nie pyta o mecze fazy', async () => {
    const requests = publicApi();
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('heading', { name: 'Ten turniej nie ma drabinki' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Przejdź do tabeli' });
    expect(link).toHaveAttribute('href', `/t/${SLUG}/tabela`);
    expect(requests.stageMatches).toEqual([]);

    await user.click(link);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/tabela`);
  });
});

describe('okno rund', () => {
  it('bez ?od= zaczyna się od rundy z pierwszym niezakończonym meczem', async () => {
    const requests = publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 2, finished: 1 } }) });
    renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał']));
    expect(requests.stageMatches).toContain('2');
  });

  it('zakończenie rundy w czasie oglądania nie przesuwa okna, a wyliczony start trafia do ?od=', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 2, finished: 3 } }) });
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał']));
    // `replace`: ten sam wpis historii, więc „wstecz” nie wraca na adres bez ?od=.
    await waitFor(() => expect(router.state.location.search).toBe('?od=2'));
    expect(router.state.historyAction).toBe('REPLACE');

    // Organizator kończy ostatni ćwierćfinał: z samej reguły okno poszłoby na półfinał.
    expect(within(await tile('Ćwierćfinał 4')).queryByText('7')).not.toBeInTheDocument();
    const refreshed = publicApi({
      data: cup(),
      stageMatches: cupMatches(
        { teams: 16, progress: { round: 3, finished: 0 } },
        { 2004: { status: 'finished', homeScore: 7, awayScore: 0, homePenalties: null, awayPenalties: null } },
      ),
    });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    await waitFor(() => expect(refreshed.stageMatches).toEqual(['2']));
    // Dane w oknie się odświeżyły: ostatni ćwierćfinał ma wynik.
    await waitFor(async () => expect(within(await tile('Ćwierćfinał 4')).getByText('7')).toBeInTheDocument());

    expect(headings()).toEqual(['Ćwierćfinał']);
    expect(router.state.location.search).toBe('?od=2');
  });

  it.each(['', '?od=4', '?od=9'])('po finale kończy się na finale (%s)', async (query) => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: 'done' }) });
    renderAt(`/t/${SLUG}/drabinka${query}`);

    await waitFor(() => expect(headings()).toEqual(['Finał']));
    expect(screen.getByRole('button', { name: 'Następna runda' })).toBeDisabled();
  });

  it('strzałka „›” przesuwa okno o rundę i zapisuje ?od=', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16 }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['1/8 finału']));
    await user.click(screen.getByRole('button', { name: 'Następna runda' }));

    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał']));
    expect(router.state.location.search).toBe('?od=2');
  });

  it('pigułka rundy przesuwa okno na swoją rundę i ma aria-current, gdy runda jest w oknie', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16 }) });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    const pills = within(await screen.findByRole('group', { name: 'Rundy' }));
    expect(pills.getByRole('button', { name: '1/8 finału' })).toHaveAttribute('aria-current', 'true');
    await user.click(pills.getByRole('button', { name: 'Półfinał' }));

    await waitFor(() => expect(headings()).toEqual(['Półfinał']));
    expect(pills.getByRole('button', { name: 'Półfinał' })).toHaveAttribute('aria-current', 'true');
    expect(pills.getByRole('button', { name: '1/8 finału' })).not.toHaveAttribute('aria-current');
    expect(router.state.location.search).toBe('?od=3');
  });

  it('gest w bok przesuwa okno o rundę, a ruch głównie pionowy go nie rusza', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16 }) });
    const { router } = renderAt(`/t/${SLUG}/drabinka`);

    await waitFor(() => expect(headings()).toEqual(['1/8 finału']));
    const tree = document.querySelector<HTMLElement>('[data-slot="bracket-tree-body"]')!;
    expect(tree.style.touchAction).toBe('pan-y');
    const swipe = (dx: number, dy: number) => {
      fireEvent.touchStart(tree, { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(tree, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
    };

    await waitFor(() => expect(router.state.location.search).toBe('?od=1'));
    swipe(30, 200);
    expect(headings()).toEqual(['1/8 finału']);
    expect(router.state.location.search).toBe('?od=1');

    swipe(-80, 10);
    await waitFor(() => expect(headings()).toEqual(['Ćwierćfinał']));
    expect(router.state.location.search).toBe('?od=2');
  });
});

describe('kafel meczu', () => {
  it('mecz trwający 2:1 nikogo nie przygasza, finał czeka na źródła, a pigułka rundy mówi „trwa mecz”', async () => {
    publicApi({
      data: cup(),
      stageMatches: cupMatches({ teams: 4 }, { 1001: { status: 'live', homeScore: 2, awayScore: 1 } }),
    });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/drabinka`);

    const live = await tile('Półfinał 1');
    expect(within(live).getByText('Na żywo')).toBeInTheDocument();
    expect(live.querySelectorAll('[data-slot="bracket-tile-team"][data-dim]')).toHaveLength(0);
    expect(within(screen.getByRole('group', { name: 'Rundy' })).getByRole('button', { name: 'Półfinał, trwa mecz' })).toBeInTheDocument();

    // Awans dopiero przy `finished` (#216): w finale dalej stoją źródła slotów.
    await user.click(screen.getByRole('button', { name: 'Następna runda' }));
    expect(await screen.findByRole('link', { name: 'Finał: Zwycięzca: Półfinał 1 – Zwycięzca: Półfinał 2' })).toBeInTheDocument();
  });

  it('remis 1:1 po karnych 3:4 przygasza gospodarza, nie gościa, a karne stoją przy nazwach', async () => {
    const matches = cupMatches({ teams: 4 }, { 1001: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 } });
    publicApi({ data: cup(), stageMatches: matches });
    renderAt(`/t/${SLUG}/drabinka`);

    const semi = await tile('Półfinał 1');
    const [home, away] = semi.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-team"]');
    const { homeTeam, awayTeam } = byId(matches, 1001);
    expect(home).toHaveTextContent(homeTeam!.name);
    expect(home).toHaveAttribute('data-dim');
    expect(within(home!).getByText('(3)')).toBeInTheDocument();
    expect(away).toHaveTextContent(awayTeam!.name);
    expect(away).not.toHaveAttribute('data-dim');
    expect(within(away!).getByText('(4)')).toBeInTheDocument();
  });

  it('herb z homeTeam.logoUrl odpowiedzi trafia do kafla', async () => {
    const logoUrl = 'https://example.test/herb.png';
    const matches = cupMatches({ teams: 4 });
    publicApi({
      data: cup(),
      stageMatches: matches.map((match) => (match.id === 1001 ? { ...match, homeTeam: { ...match.homeTeam!, logoUrl } } : match)),
    });
    renderAt(`/t/${SLUG}/drabinka`);

    const semi = await tile('Półfinał 1');
    const [home, away] = semi.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-team"]');
    expect(home!.querySelector('img')).toHaveAttribute('src', logoUrl);
    expect(away!.querySelector('img')).toBeNull();
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
  it('w rundzie finału mistrz stoi nad finałem, a mecz o 3. miejsce pod nim', async () => {
    const matches = cupMatches({ teams: 4, progress: 'done' });
    publicApi({ data: cup(), stageMatches: matches });
    renderAt(`/t/${SLUG}/drabinka`);

    const champion = await screen.findByRole('status', { name: 'Mistrz' });
    const final = byId(matches, 2001);
    const winner =
      final.homeScore! > final.awayScore! || (final.homeScore === final.awayScore && final.homePenalties! > final.awayPenalties!)
        ? final.homeTeam
        : final.awayTeam;
    expect(champion).toHaveTextContent(winner!.name);
    const finalTile = screen.getByRole('link', { name: /^Finał:/ });
    const third = screen.getByRole('link', { name: /^Mecz o 3\. miejsce:/ });
    expect(champion.compareDocumentPosition(finalTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(finalTile.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('wolny los to kafel z przerywanym obrysem i nazwą drużyny', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 6 }) });
    renderAt(`/t/${SLUG}/drabinka`);

    const bye = await screen.findByRole('group', { name: 'Wolny los: Wilki Bemowo' });
    expect(bye).toHaveClass('border-dashed');
    expect(bye).toHaveTextContent('Wolny los');
    expect(bye).toHaveTextContent('Wilki Bemowo');
  });

  it('nagłówek ekranu pucharu w trakcie: drużyny w grze', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: { round: 2, finished: 2 } }) });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('heading', { name: 'Drabinka' })).toBeInTheDocument();
    expect(screen.getByText('Puchar')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="fact"]')).toHaveTextContent('6 z 16 drużyn w grze');
  });

  it('nagłówek ekranu po finale: puchar rozstrzygnięty', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 16, progress: 'done' }) });
    renderAt(`/t/${SLUG}/drabinka`);
    await screen.findByRole('status', { name: 'Mistrz' });
    expect(document.querySelector('[data-slot="fact"]')).toHaveTextContent('16 drużyn, puchar rozstrzygnięty');
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

  it('przy pierwszym wczytaniu stoi szkielet drabinki, a po danych znika', async () => {
    publicApi({ data: cup(), stageMatches: cupMatches({ teams: 4 }) });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('status', { name: 'Wczytywanie drabinki' })).toBeInTheDocument();
    await tile('Półfinał 1');
    expect(screen.queryByRole('status', { name: 'Wczytywanie drabinki' })).not.toBeInTheDocument();
  });

  it('puchar bez wygenerowanej drabinki ma pusty stan z odnośnikiem do Przeglądu', async () => {
    publicApi({ data: cup(), stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('heading', { name: 'Drabinka jeszcze nie jest ułożona' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' })).toHaveAttribute('href', `/t/${SLUG}`);
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
