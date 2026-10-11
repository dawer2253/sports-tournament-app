import { expect, test, type Page } from '@playwright/test';
import { createApiClient } from '@tournament/api-client';
import { API_URL, ORGANIZER, TOKEN_KEY } from './env';

// Jedyne testy, które przechodzą przez formularz logowania, więc startują bez
// sesji z projektu `setup`.
test.use({ storageState: { cookies: [], origins: [] } });

async function logIn(page: Page, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ORGANIZER.email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
}

test('organizer loguje się na koncie z seeda i widzi swoje turnieje', async ({ page }) => {
  await logIn(page, ORGANIZER.password);

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Twoje turnieje' })).toBeVisible();
  // Lista przyszła z Laravela, a nie z mocka: seed demo zakłada ten turniej.
  await expect(page.getByText('Liga Osiedlowa 2026')).toBeVisible();
});

test('złe hasło nie wpuszcza do panelu', async ({ page }) => {
  await logIn(page, 'zle-haslo');

  await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
});

test('wylogowanie unieważnia token, a nie tylko go zapomina', async ({ page }) => {
  await logIn(page, ORGANIZER.password);
  await expect(page.getByRole('heading', { name: 'Twoje turnieje' })).toBeVisible();
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);

  await page.getByRole('button', { name: 'Menu konta' }).click();
  await page.getByRole('menuitem', { name: 'Wyloguj' }).click();

  await expect(page).toHaveURL('/login');
  // Panel bez tokenu odbija z powrotem na logowanie.
  await page.goto('/');
  await expect(page).toHaveURL('/login');
  // Ten sam token nie otwiera już API: wylogowanie skasowało go w Sanctumie.
  const me = await createApiClient({ baseUrl: API_URL, getToken: () => token }).GET('/me');
  expect(me.response.status).toBe(401);
});
