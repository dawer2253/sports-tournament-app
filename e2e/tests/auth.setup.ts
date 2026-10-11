import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { createApiClient } from '@tournament/api-client';
import { ADMIN_URL, API_URL, AUTH_FILE, ORGANIZER, TOKEN_KEY } from './env';

/**
 * Logowanie raz na przebieg, przez API, a nie przez formularz: formularz ma
 * jeden własny test w `login.spec.ts`, a reszta suity potrzebuje tylko sesji.
 *
 * Panel trzyma token Bearer w `localStorage`, a `storageState` go obejmuje,
 * więc wystarczy zapisać plik w tym kształcie. `request.storageState()` tu nie
 * pomoże — zbiera ciasteczka, a Sanctum w trybie tokenowym żadnych nie stawia.
 */
setup('organizer loguje się przez API', async () => {
  const api = createApiClient({ baseUrl: API_URL });
  const { data, error } = await api.POST('/login', { body: ORGANIZER });
  expect(error, 'logowanie na koncie z seeda demo').toBeUndefined();

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await writeFile(
    AUTH_FILE,
    JSON.stringify({
      cookies: [],
      origins: [{ origin: ADMIN_URL, localStorage: [{ name: TOKEN_KEY, value: data!.data.token }] }],
    }),
  );
});
