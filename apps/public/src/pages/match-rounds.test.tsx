import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import { API_URL as API, server } from '../test/server';
import { SLUG, finished, match, publicApi, renderAt, scorer, tournament } from '../test/public-api';

/** Nazwy pokazanych kolejek, w kolejności z DOM-u (kolejka to sekcja nazwana nagłówkiem). */
function shownRounds() {
  return screen.queryAllByRole('region').map((region) => region.getAttribute('aria-label') ?? within(region).getAllByRole('heading')[0]!.textContent);
}

/** Po jednym meczu w kolejkach `from`..`to` (włącznie), mecz o id równym numerowi kolejki. */
function matchPerRound(from: number, to: number, make: typeof match = match) {
  return Array.from({ length: to - from + 1 }, (_, index) => make(from + index, from + index));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Terminarz', () => {
  it('kolejki idą rosnąco jedną listą, z nagłówkiem i meczami każdej', async () => {
    // API daje mecze po terminie: przełożony mecz kolejki 2 gra po kolejce 3.
    publicApi({
      fixtures: [
        match(1, 3, { kickoffAt: '2026-10-04T10:00:00+00:00' }),
        match(2, 2, { kickoffAt: '2026-10-11T10:00:00+00:00' }),
        match(3, 4),
      ],
    });
    renderAt(`/t/${SLUG}/terminarz`);

    const round = within(await screen.findByRole('region', { name: 'Kolejka 2' }));
    expect(shownRounds()).toEqual(['Kolejka 2', 'Kolejka 3', 'Kolejka 4']);
    expect(round.getByRole('link', { name: 'Gospodarz 2 – Gość 2' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Kolejka 4' })).getByRole('link', { name: 'Gospodarz 3 – Gość 3' })).toBeInTheDocument();
    // Komplet na ekranie: nie ma czego doczytywać.
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
  });

  it('nie ma listy kolejek ani strzałek między kolejkami', async () => {
    publicApi({ fixtures: matchPerRound(1, 5) });
    renderAt(`/t/${SLUG}/terminarz`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(screen.queryByRole('navigation', { name: 'Kolejki' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Poprzednia kolejka' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Następna kolejka' })).not.toBeInTheDocument();
  });

  it('mecz trwający w kolejce dalszej niż trzecia widać bez klikania, ze znacznikiem „Na żywo”', async () => {
    // Kolejki 1–4 mają jeszcze mecze zaplanowane (np. przełożone), a mecz trwa w kolejce 5.
    publicApi({ fixtures: [...matchPerRound(1, 4), match(5, 5, { status: 'live', homeScore: 1, awayScore: 0 }), ...matchPerRound(6, 9)] });
    renderAt(`/t/${SLUG}/terminarz`);

    const live = within(await screen.findByRole('region', { name: 'Kolejka 5' }));
    expect(within(live.getByRole('link', { name: 'Gospodarz 5 – Gość 5' })).getByText('Na żywo')).toBeInTheDocument();
    // Pierwsza porcja sięga do kolejki meczu trwającego włącznie, a reszta czeka.
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3', 'Kolejka 4', 'Kolejka 5']);
    expect(screen.getAllByText('Na żywo')).toHaveLength(1);
    expect(screen.queryByText('Zaplanowany')).not.toBeInTheDocument();
    expect(screen.queryByText(/Kolizja/)).not.toBeInTheDocument();
  });

  it('mecz trwający w kolejce dalszej niż trzecia stoi w pierwszej porcji także obok wcześniejszego meczu trwającego', async () => {
    // Przełożony mecz kolejki 2 trwa równolegle z meczem kolejki 5.
    publicApi({
      fixtures: [match(1, 1), match(2, 2, { status: 'live' }), ...matchPerRound(3, 4), match(5, 5, { status: 'live' }), ...matchPerRound(6, 9)],
    });
    renderAt(`/t/${SLUG}/terminarz`);

    const live = within(await screen.findByRole('region', { name: 'Kolejka 5' }));
    expect(within(live.getByRole('link', { name: 'Gospodarz 5 – Gość 5' })).getByText('Na żywo')).toBeInTheDocument();
    expect(screen.getAllByText('Na żywo')).toHaveLength(2);
  });

  it('pierwsza porcja nie kurczy się, gdy mecz trwający w dalszej kolejce się zakończy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Kolejka 5 ma mecz trwający i zaplanowany: po końcu meczu zostaje w terminarzu.
    publicApi({ fixtures: [...matchPerRound(1, 4), match(5, 5, { status: 'live' }), match(15, 5), ...matchPerRound(6, 9)] });
    renderAt(`/t/${SLUG}/terminarz`);
    await screen.findByRole('region', { name: 'Kolejka 5' });

    server.use(
      http.get(`${API}/public/t/:slug/fixtures`, () => HttpResponse.json({ data: [...matchPerRound(1, 4), match(15, 5), ...matchPerRound(6, 9)] })),
    );
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await vi.waitFor(() => expect(screen.queryByText('Na żywo')).not.toBeInTheDocument());
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3', 'Kolejka 4', 'Kolejka 5']);
  });

  it('kolejka z meczem trwającym zostaje widoczna po „Pokaż więcej”', async () => {
    publicApi({ fixtures: [...matchPerRound(1, 4), match(5, 5, { status: 'live' }), ...matchPerRound(6, 9)] });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/terminarz`);

    await screen.findByRole('region', { name: 'Kolejka 5' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3', 'Kolejka 4', 'Kolejka 5', 'Kolejka 6', 'Kolejka 7', 'Kolejka 8']);
  });

  it('gdy kolejka, do której kibic doczytał, zniknie z danych, widać domyślne trzy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    publicApi({ fixtures: matchPerRound(1, 7) });
    renderAt(`/t/${SLUG}/terminarz`);
    await screen.findByRole('region', { name: 'Kolejka 1' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(screen.getByRole('region', { name: 'Kolejka 6' })).toBeInTheDocument();

    // Ostatni mecz kolejki 6 się zakończył i wypadł z terminarza.
    server.use(http.get(`${API}/public/t/:slug/fixtures`, () => HttpResponse.json({ data: [...matchPerRound(1, 5), match(7, 7)] })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Kolejka 6' })).not.toBeInTheDocument());
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3']);
    expect(screen.getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument();
  });

  it('postęp kolejki liczy się z całej kolejki, także z meczów, które są już w Wynikach', async () => {
    publicApi({ fixtures: [match(2, 1), match(3, 1), match(4, 1)], results: [finished(1, 1)] });
    renderAt(`/t/${SLUG}/terminarz`);

    const round = await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(round).toHaveTextContent('1 z 4 rozegrane');
    expect(round).not.toHaveTextContent('0 z 3');
  });

  it('wszystko rozegrane: Terminarz mówi o tym i prowadzi do Wyników', async () => {
    publicApi({ fixtures: [], results: [finished(1, 1)] });
    renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByRole('heading', { name: 'Wszystkie mecze rozegrane' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz wyniki' })).toHaveAttribute('href', `/t/${SLUG}/wyniki`);
  });

  it('bez terminarza obie zakładki mówią, że nie jest ułożony, i prowadzą do Przeglądu', async () => {
    publicApi({ fixtures: [], results: [] });
    const { router } = renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByRole('heading', { name: 'Terminarz jeszcze nie jest ułożony' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' })).toHaveAttribute('href', `/t/${SLUG}`);

    await act(() => router.navigate(`/t/${SLUG}/wyniki`));
    expect(await screen.findByRole('heading', { name: 'Terminarz jeszcze nie jest ułożony' })).toBeInTheDocument();
  });
});

describe('Terminarz i Wyniki: wiersz meczu', () => {
  it('herb z API stoi przy drużynie, a bez herbu stoi herb zastępczy, po obu stronach', async () => {
    publicApi({
      fixtures: [
        match(1, 1, {
          homeTeam: { id: 1, name: 'Gospodarz 1', logoUrl: 'https://cdn.example/herb-1.png' },
          awayTeam: { id: 2, name: 'Gość 1', logoUrl: 'https://cdn.example/herb-2.png' },
        }),
        match(2, 1),
      ],
    });
    renderAt(`/t/${SLUG}/terminarz`);

    const withLogo = await screen.findByRole('link', { name: 'Gospodarz 1 – Gość 1' });
    expect([...withLogo.querySelectorAll('[data-slot="crest"] img')].map((img) => img.getAttribute('src'))).toEqual([
      'https://cdn.example/herb-1.png',
      'https://cdn.example/herb-2.png',
    ]);
    const without = screen.getByRole('link', { name: 'Gospodarz 2 – Gość 2' });
    expect(without.querySelectorAll('[data-slot="crest"] img')).toHaveLength(0);
    expect(without.querySelectorAll('[data-slot="crest-fallback"]')).toHaveLength(2);
  });

  it('nie pokazuje strzelców z odpowiedzi ani w Wynikach, ani w Terminarzu', async () => {
    const scorers = [scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [23] })];
    publicApi({
      fixtures: [match(2, 2, { status: 'live', homeScore: 1, awayScore: 0, scorers: [scorer(2, 'home', 3, { player: { id: 3, name: 'Tomasz Lis' } })] })],
      results: [finished(1, 1, { scorers })],
    });
    const { router } = renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('link', { name: 'Gospodarz 1 – Gość 1' });
    expect(screen.queryByText(/Nowak/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Strzelcy/ })).not.toBeInTheDocument();

    await act(() => router.navigate(`/t/${SLUG}/terminarz`));
    await screen.findByRole('link', { name: 'Gospodarz 2 – Gość 2' });
    expect(screen.queryByText(/Lis/)).not.toBeInTheDocument();
  });

  it('wiersz prowadzi na stronę meczu, a klik z Ctrl zostaje przeglądarce', async () => {
    publicApi({ fixtures: [match(7, 1)] });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/terminarz`);

    const row = await screen.findByRole('link', { name: 'Gospodarz 7 – Gość 7' });
    expect(row).toHaveAttribute('href', `/t/${SLUG}/mecze/7`);
    // `fireEvent` oddaje `false`, gdy ktoś wywołał `preventDefault()`.
    expect(fireEvent.click(row, { ctrlKey: true })).toBe(true);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/terminarz`);

    await user.click(row);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/mecze/7`);
  });

  it.each([
    [1, '1 mecz przed nami', '1 mecz zakończony'],
    [3, '3 mecze przed nami', '3 mecze zakończone'],
    [5, '5 meczów przed nami', '5 meczów zakończonych'],
    [12, '12 meczów przed nami', '12 meczów zakończonych'],
    [22, '22 mecze przed nami', '22 mecze zakończone'],
  ])('fakt w nagłówku odmienia %i mecz(e/ów)', async (count, fixturesFact, resultsFact) => {
    const ids = Array.from({ length: count }, (_, index) => index + 1);
    publicApi({ fixtures: ids.map((id) => match(id, 1)), results: ids.map((id) => finished(100 + id, 1)) });
    const { router } = renderAt(`/t/${SLUG}/terminarz`);

    const fact = () => document.querySelector('[data-slot="page-head"] [data-slot="fact"]')?.textContent;
    await screen.findByRole('heading', { name: 'Terminarz' });
    expect(fact()).toBe(fixturesFact);

    await act(() => router.navigate(`/t/${SLUG}/wyniki`));
    await screen.findByRole('heading', { name: 'Wyniki' });
    expect(fact()).toBe(resultsFact);
  });

  it('przy pierwszym wczytaniu stoi szkielet listy, a po danych znika', async () => {
    publicApi({ fixtures: [match(1, 1)] });
    renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByRole('status', { name: 'Wczytywanie terminarza' })).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(screen.queryByRole('status', { name: 'Wczytywanie terminarza' })).not.toBeInTheDocument();
  });
});

describe('Wyniki', () => {
  it('kolejki idą od najnowszej, na start trzy, a „Pokaż więcej” dokłada po trzy aż do kompletu', async () => {
    publicApi({ results: matchPerRound(1, 7, finished).reverse() });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('region', { name: 'Kolejka 7' });
    for (const round of [7, 6, 5]) {
      const section = within(screen.getByRole('region', { name: `Kolejka ${round}` }));
      expect(section.getByRole('link', { name: `Gospodarz ${round} – Gość ${round}` })).toBeInTheDocument();
    }
    expect(shownRounds()).toEqual(['Kolejka 7', 'Kolejka 6', 'Kolejka 5']);
    expect(screen.queryByRole('region', { name: 'Kolejka 4' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Gospodarz 4/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(shownRounds()).toEqual(['Kolejka 7', 'Kolejka 6', 'Kolejka 5', 'Kolejka 4', 'Kolejka 3', 'Kolejka 2']);

    // Została jedna kolejka: porcja jest krótsza, a przycisk znika.
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(shownRounds()).toEqual(['Kolejka 7', 'Kolejka 6', 'Kolejka 5', 'Kolejka 4', 'Kolejka 3', 'Kolejka 2', 'Kolejka 1']);
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
  });

  it('po odświeżeniu z nową kolejką rozwinięte kolejki dalej są widoczne, a nowa stoi na górze', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    publicApi({ results: matchPerRound(1, 7, finished).reverse() });
    renderAt(`/t/${SLUG}/wyniki`);
    await screen.findByRole('region', { name: 'Kolejka 7' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(screen.getByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();

    server.use(http.get(`${API}/public/t/:slug/results`, () => HttpResponse.json({ data: matchPerRound(1, 8, finished).reverse() })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByRole('region', { name: 'Kolejka 8' })).toBeInTheDocument();
    // Najstarsza rozwinięta kolejka nie spadła pod „Pokaż więcej”.
    expect(screen.getByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();
    expect(shownRounds()[0]).toBe('Kolejka 8');
    expect(screen.queryByRole('region', { name: 'Kolejka 1' })).not.toBeInTheDocument();
  });

  it('po odświeżeniu z nową kolejką domyślne trzy zostają na ekranie, a nowa staje nad nimi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi({ results: matchPerRound(1, 7, finished).reverse() });
    renderAt(`/t/${SLUG}/wyniki`);
    await screen.findByRole('region', { name: 'Kolejka 7' });

    server.use(http.get(`${API}/public/t/:slug/results`, () => HttpResponse.json({ data: matchPerRound(1, 8, finished).reverse() })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await screen.findByRole('region', { name: 'Kolejka 8' });
    expect(shownRounds()).toEqual(['Kolejka 8', 'Kolejka 7', 'Kolejka 6', 'Kolejka 5']);
  });

  it('kolejka w Wynikach nie ma postępu', async () => {
    publicApi({ fixtures: [match(2, 1)], results: [finished(1, 1)] });
    renderAt(`/t/${SLUG}/wyniki`);

    const round = await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(round).not.toHaveTextContent(/rozegrane/);
  });

  it('bez wyników mówi, że ich jeszcze nie ma, i prowadzi do Terminarza', async () => {
    publicApi({ fixtures: [match(1, 1)], results: [] });
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByRole('heading', { name: 'Jeszcze nie ma wyników' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz terminarz' })).toHaveAttribute('href', `/t/${SLUG}/terminarz`);
  });
});

describe('Zegar meczu na żywo (#297)', () => {
  const NOW = Date.parse('2026-10-18T11:20:00Z');
  /** Mecz trwający w 2. części, zaczętej 5 min 40 s przed „teraz”. */
  const live = () =>
    match(1, 1, {
      status: 'live',
      homeScore: 1,
      awayScore: 0,
      livePeriod: 2,
      periodStartedAt: new Date(NOW - 340_000).toISOString(),
      onBreak: false,
    });
  const row = async () => within(await screen.findByRole('link', { name: 'Gospodarz 1 – Gość 1' }));

  it('liczy minutę z podziału meczu turnieju, a nie z 45 minut', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    publicApi({ data: tournament({ periods: { count: 2, minutes: 30 } }), fixtures: [live()] });
    renderAt(`/t/${SLUG}/terminarz`);

    // 2. połowa przy 2 × 30 startuje od 31′, więc po 5 pełnych minutach 36′ (przy 2 × 45 byłoby 51′).
    expect((await row()).getByText('36′')).toBeInTheDocument();
  });

  it('w sporcie bez biegnącego zegara pokazuje część zamiast minuty', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    publicApi({ data: tournament({ periods: { count: 4, minutes: 10 }, runningClock: false }), fixtures: [live()] });
    renderAt(`/t/${SLUG}/terminarz`);

    expect((await row()).getByText('2. kwarta')).toBeInTheDocument();
  });

  it('minuta idzie po 30 s timerem przeglądarki, bez żądań ponad zwykłe odpytywanie', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    const requests = publicApi({ fixtures: [live()] });
    renderAt(`/t/${SLUG}/terminarz`);
    // 2. połowa 2 × 45 po 5 pełnych minutach.
    expect((await row()).getByText('51′')).toBeInTheDocument();
    const before = { tournament: requests.tournament, fixtures: requests.fixtures };

    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect((await row()).getByText('52′')).toBeInTheDocument();
    const polls = Math.floor(30_000 / POLL_INTERVAL_MS);
    expect({ tournament: requests.tournament, fixtures: requests.fixtures }).toEqual({
      tournament: before.tournament + polls,
      fixtures: before.fixtures + polls,
    });
  });
});
