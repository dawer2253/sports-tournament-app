import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { createApiClient, type ApiClient, type Tournament } from '@tournament/api-client';
import { API_URL } from './env';
import { readToken } from './session';

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
  /** Świeży puchar (`format: 'knockout'`) w piłce nożnej, założony przez API. */
  cup: Tournament;
  /** Świeży turniej grupowy (`format: 'groups_playoff'`) w piłce nożnej, założony przez API. */
  groups: Tournament;
}

/** Nowy turniej piłkarski w danym formacie, przez API. */
async function createTournament(
  api: ApiClient,
  format: 'league' | 'groups_playoff' | 'knockout',
  prefix: string,
): Promise<Tournament> {
  const sports = await api.GET('/sports');
  const football = sports.data?.data.find((sport) => sport.code === 'football');
  expect(football, 'piłka nożna w GET /sports').toBeDefined();

  const { data, error } = await api.POST('/tournaments', {
    body: { name: uniqueName(prefix), sportId: football!.id, format },
  });
  expect(error, 'POST /tournaments').toBeUndefined();
  return data!.data;
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
    const token = await readToken();
    await use(createApiClient({ baseUrl: API_URL, getToken: () => token }));
  },

  tournament: async ({ api }, use) => {
    await use(await createTournament(api, 'league', 'E2E'));
  },

  cup: async ({ api }, use) => {
    await use(await createTournament(api, 'knockout', 'Puchar E2E'));
  },

  groups: async ({ api }, use) => {
    await use(await createTournament(api, 'groups_playoff', 'Grupy E2E'));
  },
});

export { expect };
