import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS } from './lib/api';
import { API_URL as API, server } from './test/server';
import { SLUG, publicApi, renderAt, tournament } from './test/public-api';

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
    renderAt(`/t/${SLUG}/drabinka`);

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

  it('meta pod nazwą ma „Zakończony” przy turnieju finished', async () => {
    publicApi({ data: tournament({ status: 'finished' }) });
    renderAt(`/t/${SLUG}`);
    const header = within(await screen.findByRole('banner'));
    expect(header.getByText('Piłka nożna')).toBeInTheDocument();
    expect(header.getByText('Zakończony')).toBeInTheDocument();
  });

  it('meta pod nazwą nie ma „Zakończony” przy turnieju active', async () => {
    publicApi();
    renderAt(`/t/${SLUG}`);
    const header = within(await screen.findByRole('banner'));
    expect(header.getByText('Piłka nożna')).toBeInTheDocument();
    expect(header.queryByText('Zakończony')).not.toBeInTheDocument();
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
      // Przegląd pyta o wszystkie cztery zasoby naraz.
      renderAt(`/t/${SLUG}`);
      await screen.findByRole('region', { name: 'Tabela (skrót)' });
      await waitFor(() => expect(requests).toEqual({ tournament: 1, standings: 1, fixtures: 1, results: 1 }));

      await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

      await waitFor(() => expect(requests).toEqual({ tournament: 2, standings: 2, fixtures: 2, results: 2 }));
    },
  );
});
