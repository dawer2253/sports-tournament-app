import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import { API_URL as API, server } from '../test/server';
import { SLUG, finished, match, publicApi, renderAt } from '../test/public-api';

/** Nazwy pokazanych kolejek, w kolejności z DOM-u (sekcja kolejki to region nazwany nagłówkiem). */
function shownRounds() {
  return screen
    .getAllByRole('region')
    .map((region) => document.getElementById(region.getAttribute('aria-labelledby') ?? '')?.textContent)
    .filter((name) => name?.startsWith('Kolejka'));
}

/** Po jednym meczu w kolejkach `from`..`to` (włącznie), mecz o id równym numerowi kolejki. */
function rounds(from: number, to: number, make: typeof match = match) {
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
    publicApi({ fixtures: rounds(1, 5) });
    renderAt(`/t/${SLUG}/terminarz`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(screen.queryByRole('navigation', { name: 'Kolejki' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Poprzednia kolejka' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Następna kolejka' })).not.toBeInTheDocument();
  });

  it('mecz trwający w kolejce dalszej niż trzecia widać bez klikania, ze znacznikiem „Na żywo”', async () => {
    // Kolejki 1–4 mają jeszcze mecze zaplanowane (np. przełożone), a mecz trwa w kolejce 5.
    publicApi({ fixtures: [...rounds(1, 4), match(5, 5, { status: 'live', homeScore: 1, awayScore: 0 }), ...rounds(6, 9)] });
    renderAt(`/t/${SLUG}/terminarz`);

    const live = within(await screen.findByRole('region', { name: 'Kolejka 5' }));
    expect(within(live.getByRole('link', { name: 'Gospodarz 5 – Gość 5' })).getByText('Na żywo')).toBeInTheDocument();
    // Pierwsza porcja sięga do kolejki meczu trwającego włącznie, a reszta czeka.
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3', 'Kolejka 4', 'Kolejka 5']);
    expect(screen.getAllByText('Na żywo')).toHaveLength(1);
    expect(screen.queryByText('Zaplanowany')).not.toBeInTheDocument();
    expect(screen.queryByText(/Kolizja/)).not.toBeInTheDocument();
  });

  it('kolejka z meczem trwającym zostaje widoczna po „Pokaż więcej”', async () => {
    publicApi({ fixtures: [...rounds(1, 4), match(5, 5, { status: 'live' }), ...rounds(6, 9)] });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/terminarz`);

    await screen.findByRole('region', { name: 'Kolejka 5' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3', 'Kolejka 4', 'Kolejka 5', 'Kolejka 6', 'Kolejka 7', 'Kolejka 8']);
  });

  it('gdy kolejka, do której kibic doczytał, zniknie z danych, widać domyślne trzy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    publicApi({ fixtures: rounds(1, 7) });
    renderAt(`/t/${SLUG}/terminarz`);
    await screen.findByRole('region', { name: 'Kolejka 1' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(screen.getByRole('region', { name: 'Kolejka 6' })).toBeInTheDocument();

    // Ostatni mecz kolejki 6 się zakończył i wypadł z terminarza.
    server.use(http.get(`${API}/public/t/:slug/fixtures`, () => HttpResponse.json({ data: [...rounds(1, 5), match(7, 7)] })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Kolejka 6' })).not.toBeInTheDocument());
    expect(shownRounds()).toEqual(['Kolejka 1', 'Kolejka 2', 'Kolejka 3']);
    expect(screen.getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument();
  });

  it('bez meczów mówi o tym wprost', async () => {
    publicApi({ fixtures: [] });
    renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByText('Brak zaplanowanych meczów')).toBeInTheDocument();
  });
});

describe('Wyniki', () => {
  it('kolejki idą od najnowszej, na start trzy, a „Pokaż więcej” dokłada po trzy aż do kompletu', async () => {
    publicApi({ results: rounds(1, 7, finished).reverse() });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/wyniki`);

    const newest = within(await screen.findByRole('region', { name: 'Kolejka 7' }));
    expect(newest.getByRole('link', { name: 'Gospodarz 7 – Gość 7' })).toBeInTheDocument();
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
    publicApi({ results: rounds(1, 7, finished).reverse() });
    renderAt(`/t/${SLUG}/wyniki`);
    await screen.findByRole('region', { name: 'Kolejka 7' });
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(screen.getByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();

    server.use(http.get(`${API}/public/t/:slug/results`, () => HttpResponse.json({ data: rounds(1, 8, finished).reverse() })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByRole('region', { name: 'Kolejka 8' })).toBeInTheDocument();
    // Najstarsza rozwinięta kolejka nie spadła pod „Pokaż więcej”.
    expect(screen.getByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();
    expect(shownRounds()[0]).toBe('Kolejka 8');
    expect(screen.queryByRole('region', { name: 'Kolejka 1' })).not.toBeInTheDocument();
  });

  it('bez rozegranych meczów mówi o tym wprost', async () => {
    publicApi({ results: [] });
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByText('Brak rozegranych meczów')).toBeInTheDocument();
  });
});
