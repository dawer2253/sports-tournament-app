import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from './lib/api';
import { API_URL as API, server } from './test/server';
import { SLUG, cup, publicApi, renderAt, tournament } from './test/public-api';

const tabs = () => within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));

afterEach(() => {
  vi.useRealTimers();
});

describe('trasa turnieju', () => {
  it('zmiana zakładki nie pyta ponownie o turniej', async () => {
    const requests = publicApi();
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Tabela (skrót)' });
    await user.click(tabs().getByRole('link', { name: 'Tabela' }));
    await screen.findByRole('table');
    await user.click(tabs().getByRole('link', { name: 'Terminarz' }));
    await screen.findByText('Brak zaplanowanych meczów');
    await user.click(tabs().getByRole('link', { name: 'Wyniki' }));
    await screen.findByText('Brak rozegranych meczów');

    expect(requests.tournament).toBe(1);
    expect(tabs().getByRole('link', { name: 'Wyniki' })).toHaveAttribute('aria-current', 'page');
  });

  it('zakładki prowadzą pod polskie adresy', async () => {
    publicApi();
    const { router } = renderAt(`/t/${SLUG}/tabela`);

    await screen.findByRole('table');
    expect(tabs().getByRole('link', { name: 'Tabela' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      `/t/${SLUG}`,
      `/t/${SLUG}/tabela`,
      `/t/${SLUG}/terminarz`,
      `/t/${SLUG}/wyniki`,
      `/t/${SLUG}/statystyki`,
    ]);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/tabela`);
  });

  it('404 turnieju daje „Nie ma takiego turnieju”, bez shella i z tym samym tytułem karty', async () => {
    document.title = 'Liga z poprzedniej wizyty';
    server.use(
      http.get(`${API}/public/t/:slug`, () => HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 })),
    );
    renderAt('/t/nie-ma-takiego');

    expect(await screen.findByText('Nie ma takiego turnieju')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument();
    expect(document.title).toBe('Nie ma takiego turnieju');
  });

  it('po 404 turnieju odpytywanie trwa, więc opublikowany szkic pojawia się sam', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi();
    let published = false;
    server.use(
      http.get(`${API}/public/t/:slug`, () =>
        published
          ? HttpResponse.json({ data: tournament() })
          : HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 }),
      ),
    );
    renderAt(`/t/${SLUG}`);
    await screen.findByText('Nie ma takiego turnieju');

    published = true;
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByRole('navigation', { name: 'Sekcje turnieju' })).toBeInTheDocument();
  });

  it('odpytanie po 404 nie zdejmuje ekranu 404 na czas pytania', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get(`${API}/public/t/:slug`, async () => {
        requests++;
        if (requests > 1) await delay(200);
        return HttpResponse.json({ message: 'Nie znaleziono zasobu.' }, { status: 404 });
      }),
    );
    renderAt('/t/nie-ma-takiego');
    await screen.findByText('Nie ma takiego turnieju');

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(requests).toBe(2);
    expect(screen.queryByLabelText('Wczytywanie turnieju')).not.toBeInTheDocument();
    expect(screen.getByText('Nie ma takiego turnieju')).toBeInTheDocument();
  });

  it('inny błąd turnieju pokazuje komunikat z odpowiedzi', async () => {
    server.use(
      http.get(`${API}/public/t/:slug`, () => HttpResponse.json({ message: 'Usługa chwilowo niedostępna.' }, { status: 503 })),
    );
    renderAt(`/t/${SLUG}`);

    expect(await screen.findByText('Nie udało się wczytać turnieju')).toBeInTheDocument();
    expect(screen.getByText('Usługa chwilowo niedostępna.')).toBeInTheDocument();
  });

  it('nieznana podtrasa daje stronę 404 pod nagłówkiem turnieju', async () => {
    publicApi();
    renderAt(`/t/${SLUG}/kalendarz`);

    expect(await screen.findByText('Nie ma takiej strony')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Liga Osiedlowa 2026' })).toBeInTheDocument();
    for (const link of tabs().getAllByRole('link')) expect(link).not.toHaveAttribute('aria-current');
  });

  it('nieznany adres poza turniejem daje stronę 404', async () => {
    renderAt('/nie-ma-takiej');

    expect(await screen.findByText('Nie ma takiej strony')).toBeInTheDocument();
  });

  it('tytuł karty to nazwa turnieju', async () => {
    publicApi({ data: tournament({ name: 'Puchar Jesieni 2026' }) });
    renderAt(`/t/${SLUG}`);

    await waitFor(() => expect(document.title).toBe('Puchar Jesieni 2026'));
  });

  it('pasek shella nie ma metki sportu ani „Zakończony” (wariant C, #287)', async () => {
    publicApi({ data: tournament({ status: 'finished' }) });
    renderAt(`/t/${SLUG}`);
    const name = await screen.findByRole('heading', { level: 1, name: 'Liga Osiedlowa 2026' });
    const header = within(name.closest('header')!);
    expect(header.queryByText('Piłka nożna')).not.toBeInTheDocument();
    expect(header.queryByText('Zakończony')).not.toBeInTheDocument();
  });

  it('korzeń shella dostaje kolor turnieju z odpowiedzi API, rozjaśniony na ciemne tło', async () => {
    publicApi({ data: tournament({ branding: { logoUrl: null, primaryColor: '#1E3A8A' } }) });
    renderAt(`/t/${SLUG}`);
    const name = await screen.findByRole('heading', { level: 1, name: 'Liga Osiedlowa 2026' });
    const root = name.closest<HTMLElement>('.public-site')!;
    expect(root.style.getPropertyValue('--brand')).toBe('#1E3A8A');
    // Granat ma z kartą za mało kontrastu: linia i tekst idą rozjaśnione (#287).
    expect(root.style.getPropertyValue('--brand-line')).toBe('#4769be');
    expect(root.style.getPropertyValue('--brand-text')).toBe('#6085dc');
  });

  it('nieznana podtrasa pucharu daje odnośniki do zakładek pucharu, bez Tabeli', async () => {
    publicApi({ data: cup() });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/kalendarz`);

    const links = within(await screen.findByRole('navigation', { name: 'Zakładki turnieju' })).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Przegląd', `/t/${SLUG}`],
      ['Drabinka', `/t/${SLUG}/drabinka`],
      ['Terminarz', `/t/${SLUG}/terminarz`],
      ['Wyniki', `/t/${SLUG}/wyniki`],
      ['Statystyki', `/t/${SLUG}/statystyki`],
    ]);
    await user.click(links[2]!);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}/terminarz`);
  });

  it('błąd zakładki: „Spróbuj ponownie” pyta jeszcze raz i pokazuje dane', async () => {
    publicApi();
    let requests = 0;
    server.use(
      http.get(`${API}/public/t/:slug/results`, () => {
        requests++;
        return requests === 1
          ? HttpResponse.json({ message: 'Usługa chwilowo niedostępna.' }, { status: 503 })
          : HttpResponse.json({ data: [] });
      }),
    );
    const user = userEvent.setup();
    renderAt(`/t/${SLUG}/wyniki`);

    expect(await screen.findByText('Nie udało się wczytać wyników')).toBeInTheDocument();
    expect(screen.getByText('Usługa chwilowo niedostępna.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByText('Brak rozegranych meczów')).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it('nieudane odświeżenie w tle nie zdejmuje ekranu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    publicApi();
    renderAt(`/t/${SLUG}`);
    await screen.findByRole('heading', { level: 1, name: 'Liga Osiedlowa 2026' });

    server.use(http.get(`${API}/public/t/:slug`, () => HttpResponse.json({ message: 'Awaria.' }, { status: 500 })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(screen.getByRole('heading', { level: 1, name: 'Liga Osiedlowa 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Nie udało się wczytać turnieju')).not.toBeInTheDocument();
  });
});

describe('odpytywanie', () => {
  it.each(['active', 'finished'] as const)(
    'turniej %s: zapytania wracają po POLL_INTERVAL_MS',
    async (status) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const requests = publicApi({ data: tournament({ status }) });
      // Przegląd pyta o wszystkie pięć zasobów naraz.
      renderAt(`/t/${SLUG}`);
      await screen.findByRole('region', { name: 'Tabela (skrót)' });
      await waitFor(() =>
        expect(requests).toEqual({ tournament: 1, standings: 1, fixtures: 1, results: 1, leaderboard: [null], match: 0, stageMatches: [] }),
      );

      await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

      await waitFor(() =>
        expect(requests).toEqual({ tournament: 2, standings: 2, fixtures: 2, results: 2, leaderboard: [null, null], match: 0, stageMatches: [] }),
      );
    },
  );
});
