import { expect, test as setup } from '@playwright/test';
import { createApiClient } from '@tournament/api-client';
import { API_URL, ORGANIZER } from './env';
import { saveSession } from './session';

/**
 * Logowanie raz na przebieg, przez API, a nie przez formularz: formularz ma
 * własne testy w `login.spec.ts`, a reszta suity potrzebuje tylko sesji.
 */
setup('organizer loguje się przez API', async () => {
  const api = createApiClient({ baseUrl: API_URL });
  const { data, error } = await api.POST('/login', { body: ORGANIZER });
  expect(error, 'logowanie na koncie z seeda demo').toBeUndefined();

  await saveSession(data!.data.token);
});
