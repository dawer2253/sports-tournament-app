import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { createApiClient, type ApiClient, type Tournament } from '@tournament/api-client';
import { API_URL, AUTH_FILE, TOKEN_KEY } from './env';

/**
 * Nazwa, której nie ma żaden inny test ani seed demo. Backend wywodzi z nazwy
 * slug, więc unikalna nazwa daje unikalny slug — testy nie dzielą turnieju
 * między sobą i mogą chodzić równolegle.
 */
export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

interface Fixtures {
  /** Typowany klient kontraktu, zalogowany tym samym tokenem co przeglądarka. */
  api: ApiClient;
  /** Świeży turniej ligowy w piłce nożnej, założony przez API. */
  tournament: Tournament;
}

/**
 * Dane testów powstają przez API, a nie przez UI: ekran, którego test nie
 * sprawdza, nie może go wywrócić. Klient jest generowany z `openapi.yaml`, więc
 * zmiana kontraktu zapali `npm run typecheck` także tutaj.
 *
 * Sprzątania nie ma — bazę `e2e` czyści `migrate:fresh` na starcie przebiegu,
 * a zostawione dane pomagają czytać trace czerwonego testu.
 */
export const test = base.extend<Fixtures>({
  // Playwright czyta zależności fixture'a z destrukturyzacji pierwszego
  // argumentu, więc pusty wzorzec jest tu wymagany, a nie przeoczeniem.
  // oxlint-disable-next-line no-empty-pattern
  api: async ({}, use) => {
    const state = JSON.parse(await readFile(AUTH_FILE, 'utf8')) as {
      origins: { localStorage: { name: string; value: string }[] }[];
    };
    const token = state.origins[0]?.localStorage.find((item) => item.name === TOKEN_KEY)?.value ?? null;
    await use(createApiClient({ baseUrl: API_URL, getToken: () => token }));
  },

  tournament: async ({ api }, use) => {
    const sports = await api.GET('/sports');
    const football = sports.data?.data.find((sport) => sport.code === 'football');
    expect(football, 'piłka nożna w GET /sports').toBeDefined();

    const { data, error } = await api.POST('/tournaments', {
      body: { name: uniqueName('E2E'), sportId: football!.id, format: 'league' },
    });
    expect(error, 'POST /tournaments').toBeUndefined();
    await use(data!.data);
  },
});

export { expect };
