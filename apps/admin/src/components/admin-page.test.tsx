import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '../lib/session';
import { API_URL as API, server } from '../test/server';
import { AdminPage } from './admin-page';

const TOKEN = '1|token-sprzed-wylogowania';

const ME = {
  data: {
    id: 1,
    name: 'Dawid Patko',
    email: 'dawid@example.com',
    createdAt: '2026-09-01T10:00:00+02:00',
  },
};

/**
 * `endSession()` przekierowuje przez `window.location.replace`, a jsdom nie
 * umie nawigować. Samej metody nie da się podmienić — w jsdomie `replace` jest
 * niekonfigurowalną własnością `Location` (`vi.spyOn` rzuca „Cannot redefine
 * property") — ale `window.location` już tak, więc podmieniamy cały obiekt.
 * `pathname` inny niż `/login`, bo na logowaniu `endSession()` przekierowanie
 * pomija.
 */
const replace = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { pathname: '/', replace });
  setToken(TOKEN);
  server.use(http.get(`${API}/me`, () => HttpResponse.json(ME)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AdminPage active="dashboard" title="Turnieje">
          <p>Treść ekranu</p>
        </AdminPage>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

/** „Wyloguj" siedzi w menu konta, więc każde kliknięcie zaczyna się od otwarcia menu. */
async function clickLogout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu konta' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Wyloguj' }));
}

describe('AdminPage — wylogowanie', () => {
  it('POST /logout niesie token sprzed wylogowania', async () => {
    // Nagłówek czytany w handlerze, czyli w chwili, w której żądanie wyszło.
    // Gdyby `endSession()` poszło przed `POST /logout`, klient nie miałby już
    // czego dokleić i nagłówka by nie było.
    const authorization = vi.fn<(header: string | null) => void>();
    server.use(
      http.post(`${API}/logout`, ({ request }) => {
        authorization(request.headers.get('Authorization'));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = renderPage();
    await clickLogout(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(authorization).toHaveBeenCalledExactlyOnceWith(`Bearer ${TOKEN}`);
    expect(getToken()).toBeNull();
  });

  it.each([
    [
      '500',
      () => HttpResponse.json({ message: 'Serwer nie odpowiada.' }, { status: 500 }),
    ],
    ['błędzie sieci', () => HttpResponse.error()],
  ])('token znika także przy %s', async (_, respond) => {
    server.use(http.post(`${API}/logout`, respond));

    const user = renderPage();
    await clickLogout(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(getToken()).toBeNull();
  });

  it('dwa kliknięcia „Wyloguj" pod rząd dają jedno POST /logout', async () => {
    // Odpowiedź wstrzymana do drugiego kliknięcia: tylko wtedy pierwsze
    // żądanie jest jeszcze w drodze, gdy przychodzi drugie.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const requests = vi.fn();
    server.use(
      http.post(`${API}/logout`, async () => {
        requests();
        await held;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = renderPage();
    await clickLogout(user);
    await waitFor(() => expect(requests).toHaveBeenCalledOnce());
    await clickLogout(user);

    release();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(requests).toHaveBeenCalledOnce();
  });
});
