import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import {
  SLUG,
  asPublic,
  cup,
  cupMatches,
  detail,
  finished,
  match,
  matchEvent,
  publicApi,
  renderAt,
  scorer,
  tournament,
} from '../test/public-api';

/** Relacja meczu: sekcja pod tablicą z nagłówkiem „Przebieg meczu” albo „Relacja na żywo”. */
function relation(name: 'Przebieg meczu' | 'Relacja na żywo') {
  return within(screen.getByRole('region', { name }));
}

/** Kolejne wiersze relacji jako tekst, w kolejności z DOM-u. */
function relationRows(name: 'Przebieg meczu' | 'Relacja na żywo') {
  return relation(name)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

/**
 * Odnośnik powrotu nad tablicą. Zakładki shella mają te same nazwy
 * („Terminarz”, „Wyniki”), więc powrót to odnośnik spoza nawigacji.
 */
async function backLink(name: 'Terminarz' | 'Wyniki') {
  await screen.findByRole('region', { name: /^Mecz: / });
  return screen.getAllByRole('link', { name }).find((link) => !link.closest('nav'))!;
}

/** Tablica meczu: sekcja z nazwą „Mecz: gospodarz – gość”. */
function band(id: number) {
  return within(screen.getByRole('region', { name: `Mecz: Gospodarz ${id} – Gość ${id}` }));
}

/** Wpisy listy strzelców drużyny na tablicy, w kolejności z DOM-u; pusta, gdy listy nie ma. */
function scorersOf(team: string) {
  const list = screen.queryByRole('list', { name: `Strzelcy: ${team}` });
  return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : [];
}

afterEach(() => {
  vi.useRealTimers();
});

describe('wejście na stronę meczu', () => {
  it('wiersz Wyników jest odnośnikiem z href, a klik prowadzi na stronę meczu', async () => {
    publicApi({ results: [finished(7, 1)], matches: [detail(7)] });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/wyniki`);

    const row = await screen.findByRole('link', { name: 'Gospodarz 7 – Gość 7' });
    expect(row).toHaveAttribute('href', `/t/${SLUG}/mecze/7`);

    await user.click(row);

    expect(router.state.location.pathname).toBe(`/t/${SLUG}/mecze/7`);
    expect(await screen.findByRole('region', { name: 'Mecz: Gospodarz 7 – Gość 7' })).toBeInTheDocument();
  });

  it('wiersz Terminarza prowadzi na stronę meczu, a shell nie podświetla żadnej zakładki', async () => {
    publicApi({ fixtures: [match(3, 1)], matches: [detail(3, { ...match(3, 1) })] });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/terminarz`);

    await user.click(await screen.findByRole('link', { name: 'Gospodarz 3 – Gość 3' }));

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 3 – Gość 3' });
    const tabs = within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));
    expect(tabs.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });
});

describe('powrót według stanu meczu', () => {
  it('mecz zaplanowany wraca do Terminarza i mówi, że się nie zaczął', async () => {
    publicApi({ matches: [detail(1, { ...match(1, 1) })] });
    renderAt(`/t/${SLUG}/mecze/1`);

    expect(await backLink('Terminarz')).toHaveAttribute('href', `/t/${SLUG}/terminarz`);
    expect(screen.getByRole('heading', { name: 'Mecz jeszcze się nie zaczął' })).toBeInTheDocument();
    expect(band(1).queryByLabelText(/^Wynik/)).not.toBeInTheDocument();
  });

  it('mecz trwający wraca do Terminarza, bo tam stoi, dopóki się nie skończy (#306)', async () => {
    publicApi({ matches: [detail(1, { status: 'live' })] });
    renderAt(`/t/${SLUG}/mecze/1`);

    expect(await backLink('Terminarz')).toHaveAttribute('href', `/t/${SLUG}/terminarz`);
  });

  it('mecz zakończony wraca do Wyników', async () => {
    publicApi({ matches: [detail(1, { status: 'finished' })] });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/mecze/1`);

    const back = await backLink('Wyniki');
    expect(back).toHaveAttribute('href', `/t/${SLUG}/wyniki`);

    await user.click(back);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/wyniki`);
  });

  it('mecz bez zdarzeń mówi, że ich nie wpisano', async () => {
    publicApi({ matches: [detail(1)] });
    renderAt(`/t/${SLUG}/mecze/1`);

    expect(await screen.findByText('Do tego meczu nie wpisano zdarzeń.')).toBeInTheDocument();
  });
});

describe('relacja', () => {
  it('na żywo najnowsze zdarzenie stoi pierwsze, a nagłówek to „Relacja na żywo”', async () => {
    publicApi({
      matches: [
        detail(1, {
          status: 'live',
          homeScore: 1,
          awayScore: 0,
          events: [
            matchEvent(1, 'home', 1, { minute: 12, period: 1, type: 'goal', typeLabel: 'Bramka', scoreAfter: { home: 1, away: 0 } }),
            matchEvent(1, 'away', 2, { minute: 30, period: 1 }),
            matchEvent(1, 'away', 3, { minute: 55, period: 2 }),
          ],
          periods: [
            { number: 1, label: '1. połowa', homeScore: 1, awayScore: 0 },
            { number: 2, label: '2. połowa', homeScore: 0, awayScore: 0 },
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('heading', { name: 'Relacja na żywo' });
    expect(relationRows('Relacja na żywo').map((row) => row?.slice(0, 3))).toEqual(['55′', '30′', '12′']);
    expect(
      relation('Relacja na żywo')
        .getAllByRole('button', { expanded: true })
        .map((button) => button.textContent?.slice(0, 9)),
    ).toEqual(['2. połowa', '1. połowa']);
  });

  it('scoreAfter: null — przy zdarzeniach nie ma bieżącego wyniku', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 3,
          awayScore: 1,
          events: [matchEvent(1, 'home', 1, { type: 'goal', typeLabel: 'Bramka', period: 1, scoreAfter: null })],
          periods: [{ number: 1, label: '1. połowa', homeScore: null, awayScore: null }],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('heading', { name: 'Przebieg meczu' });
    const section = relation('Przebieg meczu');
    expect(section.getByRole('listitem')).not.toHaveTextContent(/\d:\d/);
    expect(section.getByRole('button', { name: /1\. połowa/ })).not.toHaveTextContent(/\d:\d/);
  });

  it('zdarzenie bez minuty stoi na końcu, w grupie „Bez minuty”', async () => {
    publicApi({
      matches: [
        detail(1, {
          events: [
            matchEvent(1, 'home', 1, { minute: 20, period: 1 }),
            matchEvent(1, 'away', 2, { minute: 70, period: 2 }),
            matchEvent(1, 'home', 3, { minute: null, period: null, player: { id: 9, name: 'Bez Minuty' } }),
          ],
          periods: [
            { number: 1, label: '1. połowa', homeScore: 0, awayScore: 0 },
            { number: 2, label: '2. połowa', homeScore: 0, awayScore: 0 },
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('heading', { name: 'Przebieg meczu' });
    const groups = relation('Przebieg meczu').getAllByRole('button', { expanded: true });
    expect(groups.map((group) => group.textContent)).toEqual([
      expect.stringMatching(/^1\. połowa/),
      expect.stringMatching(/^2\. połowa/),
      expect.stringMatching(/^Bez minuty1 zdarzenie/),
    ]);
    expect(relationRows('Przebieg meczu').at(-1)).toContain('Bez Minuty');
  });

  it('turniej bez podziału ma relację bez nagłówków części', async () => {
    publicApi({
      matches: [
        detail(1, {
          events: [matchEvent(1, 'home', 1, { minute: 20 }), matchEvent(1, 'away', 2, { minute: null })],
          periods: [],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('heading', { name: 'Przebieg meczu' });
    expect(relation('Przebieg meczu').queryByRole('button')).not.toBeInTheDocument();
    expect(relation('Przebieg meczu').queryByText('Bez minuty')).not.toBeInTheDocument();
    expect(relationRows('Przebieg meczu')).toHaveLength(2);
  });
});

describe('tablica meczu', () => {
  it('herb z homeTeam.logoUrl odpowiedzi trafia na tablicę', async () => {
    const logoUrl = 'https://example.test/herb-gospodarza.png';
    publicApi({ matches: [detail(1, { homeTeam: { id: 1, name: 'Gospodarz 1', logoUrl } })] });
    renderAt(`/t/${SLUG}/mecze/1`);

    const region = await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(region.querySelectorAll('img')).toHaveLength(1);
    expect(region.querySelector('img')).toHaveAttribute('src', logoUrl);
  });

  it('samobój stoi wśród strzelców po stronie przeciwnika, z „(sam.)”', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 1,
          awayScore: 1,
          scorers: [scorer(1, 'home', 4, { minutes: [{ minute: 10, addedTime: null }] }), scorer(1, 'home', 5, { minutes: [{ minute: 60, addedTime: null }], ownGoal: true })],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    const home = band(1).getByRole('list', { name: 'Strzelcy: Gospodarz 1' });
    const away = band(1).getByRole('list', { name: 'Strzelcy: Gość 1' });
    expect(within(away).getByRole('listitem')).toHaveTextContent("Zawodnik 5 60′ (sam.)");
    expect(within(home).getByRole('listitem')).toHaveTextContent("Zawodnik 4 10′");
  });

  it('w koszu stoją wszyscy zawodnicy z punktami, nie trzech jak w wierszu meczu', async () => {
    const scorers = [1, 2, 3, 4, 5].map((id) => scorer(1, 'home', id, { value: 10 + id, minutes: [] }));
    publicApi({
      data: tournament({ sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } }),
      matches: [detail(1, { homeScore: 65, awayScore: 0, scorers })],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    const home = within(band(1).getByRole('list', { name: 'Strzelcy: Gospodarz 1' }));
    // Format sumy: malejąco po wartości, wszyscy.
    expect(home.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Zawodnik 5 15',
      'Zawodnik 4 14',
      'Zawodnik 3 13',
      'Zawodnik 2 12',
      'Zawodnik 1 11',
    ]);
  });
});

describe('strzelcy na tablicy (reguły z wierszy meczu, #208)', () => {
  it('samobój stoi po stronie przeciwnika drużyny strzelca, z dopiskiem „(sam.)”', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 1,
          awayScore: 1,
          scorers: [
            scorer(1, 'away', 7, { player: { id: 7, name: 'Jan Lis' }, minutes: [{ minute: 30, addedTime: null }], ownGoal: true }),
            scorer(1, 'away', 8, { player: { id: 8, name: 'Adam Zieliński' }, minutes: [{ minute: 70, addedTime: null }] }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(["Jan Lis 30′ (sam.)"]);
    expect(scorersOf('Gość 1')).toEqual(["Adam Zieliński 70′"]);
  });

  it('doliczony czas stoi w relacji i u strzelców jako „45+3′”', async () => {
    publicApi({
      matches: [
        detail(1, {
          status: 'live',
          homeScore: 1,
          awayScore: 0,
          scorers: [scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [{ minute: 45, addedTime: 3 }] })],
          events: [matchEvent(1, 'home', 1, { minute: 45, addedTime: 3, period: 1, type: 'goal', typeLabel: 'Bramka', scoreAfter: { home: 1, away: 0 } })],
          periods: [{ number: 1, label: '1. połowa', homeScore: 1, awayScore: 0 }],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(['Marek Nowak 45+3′']);
    expect(relationRows('Relacja na żywo').map((row) => row?.slice(0, 5))).toEqual(['45+3′']);
  });

  it('wiersz z kompletem minut pokazuje minuty, a bramka bez minuty przełącza wiersz na sumę', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 2,
          awayScore: 2,
          scorers: [
            scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, value: 2, minutes: [{ minute: 23, addedTime: null }, { minute: 67, addedTime: null }] }),
            scorer(1, 'away', 2, { player: { id: 2, name: 'Rafał Duda' }, value: 2, minutes: [{ minute: 23, addedTime: null }] }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(["Marek Nowak 23′ 67′"]);
    expect(scorersOf('Gość 1')).toEqual(['Rafał Duda 2']);
  });

  it('format sumy stoi za minutami, malejąco po value i bez limitu; minuty w kolejności z API', async () => {
    const sum = (id: number, name: string, value: number) => scorer(1, 'home', id, { player: { id, name }, value, minutes: [] });
    const goal = (id: number, minute: number) => scorer(1, 'home', id, { player: { id, name: `Strzelec ${id}` }, minutes: [{ minute: minute, addedTime: null }] });
    publicApi({
      matches: [
        detail(1, {
          homeScore: 92,
          awayScore: 0,
          // Kolejność z API: minuty nie po kolei, sumy po id zawodnika.
          scorers: [goal(11, 40), sum(1, 'Igor Kowal', 12), goal(12, 5), sum(2, 'Kacper Lipa', 28), sum(3, 'Oskar Dąb', 31), sum(4, 'Bruno Klon', 19)],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gospodarz 1')).toEqual([
      "Strzelec 11 40′",
      "Strzelec 12 5′",
      'Oskar Dąb 31',
      'Kacper Lipa 28',
      'Bruno Klon 19',
      'Igor Kowal 12',
    ]);
  });

  it('na tablicy są tylko zdobycze: bez kartek, a drużyna bez strzelców nie ma listy', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 1,
          awayScore: 0,
          scorers: [scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [{ minute: 23, addedTime: null }] })],
          events: [
            matchEvent(1, 'home', 1, { minute: 23, type: 'goal', typeLabel: 'Bramka', player: { id: 1, name: 'Marek Nowak' }, scoreAfter: { home: 1, away: 0 } }),
            matchEvent(1, 'away', 2, { minute: 50, player: { id: 2, name: 'Kartkowicz' } }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(["Marek Nowak 23′"]);
    expect(screen.queryByRole('list', { name: 'Strzelcy: Gość 1' })).not.toBeInTheDocument();
    expect(band(1).queryByText(/Kartkowicz/)).not.toBeInTheDocument();
  });

  it('mecz trwający ma strzelców na tablicy', async () => {
    publicApi({
      matches: [
        detail(1, {
          status: 'live',
          homeScore: 0,
          awayScore: 1,
          scorers: [scorer(1, 'away', 4, { player: { id: 4, name: 'Tomasz Lis' }, minutes: [{ minute: 12, addedTime: null }] })],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gość 1')).toEqual(["Tomasz Lis 12′"]);
  });

  it('mecz zaplanowany nie ma żadnej listy strzelców', async () => {
    publicApi({
      matches: [detail(2, { ...match(2, 1), scorers: [scorer(2, 'away', 4, { player: { id: 4, name: 'Tomasz Lis' }, minutes: [{ minute: 12, addedTime: null }] })] })],
    });
    renderAt(`/t/${SLUG}/mecze/2`);
    await screen.findByRole('region', { name: 'Mecz: Gospodarz 2 – Gość 2' });
    expect(screen.queryByRole('list', { name: /^Strzelcy/ })).not.toBeInTheDocument();
  });
});

describe('wczytywanie', () => {
  it('przy pierwszym wczytaniu stoi szkielet meczu, a po danych znika', async () => {
    publicApi({ matches: [detail(1)] });
    renderAt(`/t/${SLUG}/mecze/1`);

    expect(await screen.findByRole('status', { name: 'Wczytywanie meczu' })).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(screen.queryByRole('status', { name: 'Wczytywanie meczu' })).not.toBeInTheDocument();
  });
});

describe('brak meczu i odpytywanie', () => {
  it('404 daje „Nie ma takiego meczu” w shellu turnieju', async () => {
    publicApi({ matches: [] });
    renderAt(`/t/${SLUG}/mecze/404`);

    expect(await screen.findByText('Nie ma takiego meczu')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).toBeInTheDocument();
  });

  it('adres bez liczby to też „Nie ma takiego meczu”', async () => {
    publicApi({ matches: [] });
    renderAt(`/t/${SLUG}/mecze/abc`);

    expect(await screen.findByText('Nie ma takiego meczu')).toBeInTheDocument();
  });

  it('strona meczu odpytuje API co POLL_INTERVAL_MS', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requests = publicApi({ matches: [detail(1)] });
    renderAt(`/t/${SLUG}/mecze/1`);
    await screen.findByText('Do tego meczu nie wpisano zdarzeń.');
    await waitFor(() => expect(requests.match).toBe(1));

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await waitFor(() => expect(requests.match).toBe(2));
  });
});

describe('mecz pucharowy (#234)', () => {
  /** Puchar czterech drużyn: półfinał 1 rozstrzygnięty karnymi, półfinał 2 bez nich, mecz o 3. miejsce przed nami. */
  const matches = cupMatches(
    { teams: 4, progress: { round: 1, finished: 2 } },
    { 1001: { homeScore: 2, awayScore: 2, homePenalties: 4, awayPenalties: 3 }, 1002: { homeScore: 1, awayScore: 0 } },
  );
  const page = (id: number) => ({ ...asPublic(matches.find((match) => match.id === id)!), events: [], periods: [] });

  it('rozstrzygnięty karnymi ma je w pasie przy wyniku, pogrubione u zwycięzcy', async () => {
    publicApi({ data: cup(), stageMatches: matches, matches: [page(1001)] });
    renderAt(`/t/${SLUG}/mecze/1001`);

    const band = within(await screen.findByRole('region', { name: /^Mecz: / }));
    expect(await band.findByText('Półfinał 1')).toBeInTheDocument();
    expect(band.getByLabelText('Wynik 2 : 2, karne 4 : 3')).toBeInTheDocument();
    expect(band.getByText('(4)')).toHaveClass('font-bold');
    expect(band.getByText('(3)')).not.toHaveClass('font-bold');
  });

  it('bez karnych nie ma nawiasów', async () => {
    publicApi({ data: cup(), stageMatches: matches, matches: [page(1002)] });
    renderAt(`/t/${SLUG}/mecze/1002`);

    const region = await screen.findByRole('region', { name: /^Mecz: / });
    expect(await within(region).findByText('Półfinał 2')).toBeInTheDocument();
    expect(region).not.toHaveTextContent('(');
  });

  it('mecz o 3. miejsce ma w pasie „Mecz o 3. miejsce”, a nie „Finał”', async () => {
    publicApi({ data: cup(), stageMatches: matches, matches: [page(2002)] });
    renderAt(`/t/${SLUG}/mecze/2002`);

    const band = within(await screen.findByRole('region', { name: /^Mecz: / }));
    expect(await band.findByText('Mecz o 3. miejsce')).toBeInTheDocument();
    expect(band.queryByText('Finał')).not.toBeInTheDocument();
  });

  it('mecz ligi zostaje przy nazwie kolejki i nie pyta o mecze fazy', async () => {
    const requests = publicApi({ matches: [detail(1)] });
    renderAt(`/t/${SLUG}/mecze/1`);

    await screen.findByRole('region', { name: 'Mecz: Gospodarz 1 – Gość 1' });
    expect(band(1).getByText('Kolejka 1')).toBeInTheDocument();
    expect(requests.stageMatches).toEqual([]);
  });
});

describe('strona meczu: sport z setami (#301)', () => {
  it('pod tablicą stoją sety po kolei, a wynik to sety wygrane', async () => {
    publicApi({
      matches: [
        detail(1, {
          homeScore: 3,
          awayScore: 1,
          sets: [
            { home: 25, away: 20 },
            { home: 23, away: 25 },
            { home: 25, away: 18 },
            { home: 25, away: 22 },
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/mecze/1`);

    const list = await screen.findByRole('list', { name: 'Sety' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1. set 25:20',
      '2. set 23:25',
      '3. set 25:18',
      '4. set 25:22',
    ]);
    expect(screen.getByLabelText('Wynik 3 : 1')).toBeInTheDocument();
  });
});
