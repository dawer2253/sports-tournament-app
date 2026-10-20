import { ADMIN_URL, PUBLIC_URL } from './env';
import { expect, test, uniqueName } from './fixtures';

/**
 * Zgłoszenie drużyny (#300): zgłaszający wysyła je ze strony publicznej, bez
 * logowania, a organizator przyjmuje je w panelu — i wtedy drużyna stoi na
 * liście drużyn. Szew, którego nie widzi ani vitest na mocku, ani Pest bez
 * przeglądarki: formularz strony → `POST /public/t/{slug}/registrations` →
 * karta „Zgłoszenia” panelu → `POST /registrations/{id}/accept` → drużyna.
 *
 * Walidacje, zapisy zamknięte i limit żądań pokrywają vitest i Pest.
 */
test('zgłaszający zgłasza drużynę na stronie publicznej, a organizator przyjmuje ją w panelu', async ({ page, api, tournament }) => {
  const teamName = uniqueName('Lwy');

  await test.step('opublikowany turniej z otwartymi zapisami przez API', async () => {
    const { error } = await api.PATCH('/tournaments/{tournament}', {
      params: { path: { tournament: tournament.id } },
      body: { status: 'active', registration: { open: true } },
    });
    expect(error, 'PATCH /tournaments status i zapisy').toBeUndefined();
  });

  await test.step('na stronie turnieju pasek zapisów prowadzi do formularza', async () => {
    await page.goto(`${PUBLIC_URL}/t/${tournament.slug}`);
    await page.getByRole('complementary', { name: 'Zapisy' }).getByRole('link', { name: 'Zgłoś drużynę' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Zgłoś drużynę' })).toBeVisible();
  });

  await test.step('zgłaszający wypełnia i wysyła formularz', async () => {
    await page.getByLabel('Nazwa drużyny').fill(teamName);
    await page.getByLabel('Imię i nazwisko').fill('Anna Wiśniewska');
    await page.getByLabel('E-mail').fill('anna.wisniewska@example.com');
    await page.getByRole('button', { name: 'Dodaj zawodnika' }).click();
    await page.getByLabel('Zawodnik 1').fill('Paweł Lis');
    await page.getByLabel('Numer zawodnika 1').fill('9');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();

    await expect(page.getByRole('status')).toContainText(`Drużyna „${teamName}” czeka na decyzję organizatora.`);
  });

  await test.step('organizator przyjmuje zgłoszenie w karcie „Zgłoszenia”', async () => {
    await page.goto(`${ADMIN_URL}/tournaments/${tournament.id}/registrations`);
    const card = page.getByRole('article', { name: teamName });
    await expect(card).toContainText('anna.wisniewska@example.com');
    await card.getByRole('button', { name: 'Przyjmij' }).click();
    await expect(page.getByRole('region', { name: 'Rozpatrzone' }).getByRole('article', { name: teamName })).toBeVisible();
  });

  await test.step('drużyna stoi na liście drużyn panelu, z zawodnikiem ze zgłoszenia', async () => {
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Drużyny' }).click();
    const row = page.getByRole('row', { name: new RegExp(teamName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('1');
  });
});
