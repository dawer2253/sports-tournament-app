import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { TournamentCreatePage } from './tournament-create';

const SPORTS = {
  data: [
    { id: 1, code: 'football', name: 'Piłka nożna', config: {} },
    { id: 2, code: 'basketball', name: 'Koszykówka', config: {} },
  ],
};

const ME = {
  data: {
    id: 1,
    name: 'Dawid Patko',
    email: 'dawid@example.com',
    createdAt: '2026-09-01T10:00:00+02:00',
  },
};

beforeEach(() => {
  server.use(
    http.get(`${API}/sports`, () => HttpResponse.json(SPORTS)),
    // Shell panelu pokazuje zalogowane konto na każdym ekranie.
    http.get(`${API}/me`, () => HttpResponse.json(ME)),
  );
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tournaments/new']}>
        <Routes>
          <Route path="/tournaments/new" element={<TournamentCreatePage />} />
          <Route path="/" element={<p>Lista turniejów</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), invalidate };
}

/** Wypełnia komplet pól poprawnymi wartościami. */
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('radio', { name: /Piłka nożna/ });
  await user.type(screen.getByLabelText(/Nazwa turnieju/), 'Liga Osiedlowa 2026');
  await user.click(screen.getByRole('radio', { name: /Piłka nożna/ }));
  await user.click(screen.getByRole('radio', { name: /Liga każdy z każdym/ }));
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole('button', { name: 'Załóż turniej' }));
}

describe('TournamentCreatePage', () => {
  it('wysyła POST /tournaments w kształcie z kontraktu i wraca na listę', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/tournaments`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { id: 7 } }, { status: 201 });
      }),
    );

    const { user, invalidate } = renderPage();
    await fillForm(user);
    await submit(user);

    await screen.findByText('Lista turniejów');
    expect(bodies).toEqual([{ name: 'Liga Osiedlowa 2026', sportId: 1, format: 'league' }]);
    // Bez unieważnienia lista pokazałaby wynik sprzed założenia turnieju.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tournaments'] });
  });

  it('przycina białe znaki z nazwy przed wysyłką', async () => {
    const bodies: { name?: string }[] = [];
    server.use(
      http.post(`${API}/tournaments`, async ({ request }) => {
        bodies.push((await request.json()) as { name?: string });
        return HttpResponse.json({ data: { id: 7 } }, { status: 201 });
      }),
    );

    const { user } = renderPage();
    await screen.findByRole('radio', { name: /Piłka nożna/ });
    await user.type(screen.getByLabelText(/Nazwa turnieju/), '  Liga Osiedlowa 2026  ');
    await user.click(screen.getByRole('radio', { name: /Piłka nożna/ }));
    await user.click(screen.getByRole('radio', { name: /Liga każdy z każdym/ }));
    await submit(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]?.name).toBe('Liga Osiedlowa 2026');
  });

  it('nie wysyła żądania, dopóki formularz nie jest kompletny', async () => {
    const { user } = renderPage();
    await screen.findByRole('radio', { name: /Piłka nożna/ });

    await submit(user);

    expect(await screen.findByText('Podaj nazwę turnieju.')).toBeInTheDocument();
    expect(screen.getByText('Wybierz sport.')).toBeInTheDocument();
    expect(screen.getByText('Wybierz format rozgrywek.')).toBeInTheDocument();
    // `onUnhandledRequest: 'error'` w msw pilnuje, że POST nie poszedł: handlera
    // dla niego w tym teście nie ma.
  });

  it('pokazuje błąd walidacji z API przy właściwym polu, po polsku', async () => {
    server.use(
      http.post(`${API}/tournaments`, () =>
        HttpResponse.json(
          {
            message: 'Podane dane są nieprawidłowe.',
            errors: { name: ['Turniej o tej nazwie już istnieje.'] },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = renderPage();
    await fillForm(user);
    await submit(user);

    const message = await screen.findByText('Turniej o tej nazwie już istnieje.');
    expect(message).toBeInTheDocument();
    // Formularz zostaje na miejscu: przekierowanie zjadłoby komunikat.
    expect(screen.queryByText('Lista turniejów')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Nazwa turnieju/)).toHaveAccessibleDescription(
      'Turniej o tej nazwie już istnieje.',
    );
  });

  it('błąd bez mapy pól pokazuje komunikat po polsku zamiast surowego błędu', async () => {
    server.use(
      http.post(`${API}/tournaments`, () =>
        HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 }),
      ),
    );

    const { user } = renderPage();
    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer nie odpowiada.');
  });

  it('mówi wprost, gdy nie udało się wczytać listy sportów', async () => {
    server.use(
      http.get(`${API}/sports`, () =>
        HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Nie udało się wczytać listy sportów')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Załóż turniej' })).not.toBeInTheDocument();
  });

  it('blokuje przycisk na czas wysyłki, żeby nie założyć turnieju dwa razy', async () => {
    // Odpowiedź wisi, dopóki test jej nie zwolni. Zwykłe `setTimeout` robiło
    // z tego wyścig: gdy żądanie zdążyło się domknąć między jednym a drugim
    // kliknięciem, przycisk był już z powrotem aktywny i test przechodził
    // albo nie, zależnie od maszyny.
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    let requests = 0;
    server.use(
      http.post(`${API}/tournaments`, async () => {
        requests += 1;
        await pending;
        return HttpResponse.json({ data: { id: 7 } }, { status: 201 });
      }),
    );

    const { user } = renderPage();
    await fillForm(user);

    const button = screen.getByRole('button', { name: 'Załóż turniej' });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);

    expect(requests).toBe(1);

    release();
    await screen.findByText('Lista turniejów');
  });

  it('kafelek ma nazwę bez opisu, a opis jako opis', async () => {
    renderPage();

    // Gdyby nazwę liczyła treść etykiety, wyszłoby „⚽Piłka nożna", a przy
    // formatach — nazwa sklejona z dwoma zdaniami opisu.
    expect(await screen.findByRole('radio', { name: 'Piłka nożna' })).toBeInTheDocument();

    const format = screen.getByRole('radio', { name: 'Liga każdy z każdym' });
    expect(format).toHaveAccessibleDescription(
      'Wszystkie drużyny grają ze sobą, o kolejności decyduje tabela punktowa.',
    );
  });

  it('strzałki przestawiają wybór w obrębie grupy, bez myszy', async () => {
    const { user } = renderPage();
    const football = await screen.findByRole('radio', { name: 'Piłka nożna' });

    await user.click(football);
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Koszykówka' })).toBeChecked();
    expect(football).not.toBeChecked();
  });

  it('„Anuluj" wraca na listę bez wysyłania czegokolwiek', async () => {
    const { user } = renderPage();
    await screen.findByRole('radio', { name: /Piłka nożna/ });

    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(await screen.findByText('Lista turniejów')).toBeInTheDocument();
  });
});
