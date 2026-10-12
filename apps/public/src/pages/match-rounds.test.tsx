import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from '../lib/api';
import { API_URL as API, server } from '../test/server';
import { SLUG, finished, match, publicApi, renderAt } from '../test/public-api';

/** Lista kolejek w widoku od `lg` (pod `lg` stoi zwinięty przycisk). */
function roundList() {
  return within(screen.getAllByRole('navigation', { name: 'Kolejki' }).at(-1)!);
}

/** Nazwy kolejek z listy, w kolejności z DOM-u. */
function roundNames() {
  return roundList()
    .getAllByRole('button')
    .map((button) => button.textContent?.match(/^Kolejka \d+/)?.[0]);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Terminarz', () => {
  it('kolejki idą rosnąco, a na starcie wybrana jest pierwsza', async () => {
    // API daje mecze po terminie: przełożony mecz kolejki 2 gra po kolejce 3.
    publicApi({
      fixtures: [
        match(1, 3, { kickoffAt: '2026-10-04T10:00:00+00:00' }),
        match(2, 2, { kickoffAt: '2026-10-11T10:00:00+00:00' }),
        match(3, 4),
      ],
    });
    renderAt(`/t/${SLUG}/terminarz`);

    expect(await screen.findByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();
    expect(roundNames()).toEqual(['Kolejka 2', 'Kolejka 3', 'Kolejka 4']);
  });

  it('mecz trwający stoi w terminarzu ze znacznikiem „Na żywo”, zaplanowany bez plakietki', async () => {
    publicApi({ fixtures: [match(1, 1, { status: 'live', homeScore: 1, awayScore: 0 }), match(2, 1)] });
    renderAt(`/t/${SLUG}/terminarz`);

    const round = within(await screen.findByRole('region', { name: 'Kolejka 1' }));
    expect(within(round.getByRole('group', { name: 'Gospodarz 1 – Gość 1' })).getByText('Na żywo')).toBeInTheDocument();
    expect(round.queryByText('Zaplanowany')).not.toBeInTheDocument();
    expect(round.queryByText(/Kolizja/)).not.toBeInTheDocument();
  });

  it('wybór kolejki pokazuje jej mecze', async () => {
    publicApi({ fixtures: [match(1, 1), match(2, 2)] });
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/terminarz`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    await user.click(roundList().getByRole('button', { name: /Kolejka 2/ }));

    const round = within(screen.getByRole('region', { name: 'Kolejka 2' }));
    expect(round.getByRole('group', { name: 'Gospodarz 2 – Gość 2' })).toBeInTheDocument();
  });
});

describe('Wyniki', () => {
  it('kolejki idą od najnowszej, a na starcie wybrana jest najnowsza', async () => {
    publicApi({ results: [finished(1, 3), finished(2, 1), finished(3, 2)] });
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByRole('region', { name: 'Kolejka 3' })).toBeInTheDocument();
    expect(roundNames()).toEqual(['Kolejka 3', 'Kolejka 2', 'Kolejka 1']);
  });

  it('po odświeżeniu z nową kolejką ekran przechodzi na nią, gdy kibic niczego nie wybrał', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi({ results: [finished(1, 1)] });
    renderAt(`/t/${SLUG}/wyniki`);
    await screen.findByRole('region', { name: 'Kolejka 1' });

    server.use(http.get(`${API}/public/t/:slug/results`, () => HttpResponse.json({ data: [finished(2, 2), finished(1, 1)] })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();
  });

  it('kolejka wybrana przez kibica zostaje po odświeżeniu, a gdy zniknie, wybór wraca do pierwszej', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    publicApi({ fixtures: [match(1, 1), match(2, 2)] });
    renderAt(`/t/${SLUG}/terminarz`);
    await screen.findByRole('region', { name: 'Kolejka 1' });
    await user.click(roundList().getByRole('button', { name: /Kolejka 2/ }));

    // Nowa kolejka na początku listy nie zabiera wyboru kibica.
    server.use(http.get(`${API}/public/t/:slug/fixtures`, () => HttpResponse.json({ data: [match(3, 1), match(2, 2)] })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(screen.getByRole('region', { name: 'Kolejka 2' })).toBeInTheDocument();

    // Kolejka 2 wypadła z terminarza: wybór wraca do pierwszej z listy.
    server.use(http.get(`${API}/public/t/:slug/fixtures`, () => HttpResponse.json({ data: [match(3, 1)] })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(await screen.findByRole('region', { name: 'Kolejka 1' })).toBeInTheDocument();
  });

  it('bez rozegranych meczów mówi o tym wprost', async () => {
    publicApi({ results: [] });
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByText('Brak rozegranych meczów')).toBeInTheDocument();
  });
});
