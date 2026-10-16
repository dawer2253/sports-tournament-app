import { expect, test } from './fixtures';

const TEAMS = ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany', 'Rysie Wola'];

/**
 * Faza grupowa w panelu (#258): skład grup ustala osobna karta, a Terminarz
 * pokazuje wspólną kolejkę z meczami wszystkich grup i filtrem po grupie.
 *
 * Drużyny powstają przez API, a przez ekrany idzie tylko to, co test sprawdza:
 * losowanie i zapis składu oraz wygenerowanie terminarza. Pary są losowane,
 * więc test asertuje niezmienniki domeny — cztery drużyny rozłożone na dwie
 * grupy, a kolejka ma mecz każdej z nich — a nie konkretne pary.
 */
test('organizer ustala skład grup i generuje terminarz fazy grupowej', async ({ page, api, groups }) => {
  await test.step('dodaje cztery drużyny przez API', async () => {
    for (const name of TEAMS) {
      const { error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: groups.id } },
        body: { name },
      });
      expect(error, `POST /tournaments/${groups.id}/teams`).toBeUndefined();
    }
  });

  await test.step('losuje i zapisuje skład grup', async () => {
    await page.goto(`/tournaments/${groups.id}/groups`);
    await expect(page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Grupy' })).toBeVisible();

    // Faza bez składu startuje z dwiema grupami; losowanie rozkłada cztery drużyny po dwie.
    await page.getByRole('button', { name: 'Losuj' }).click();
    await page.getByRole('button', { name: 'Zapisz skład grup' }).click();
    await expect(page.getByText('Zapisano skład grup.')).toBeVisible();
  });

  await test.step('generuje terminarz grup', async () => {
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Terminarz' }).click();
    await page.getByRole('button', { name: 'Wygeneruj terminarz' }).click();

    const dialog = page.getByRole('dialog', { name: 'Wygeneruj terminarz grup' });
    await dialog.getByText('Raz', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Wygeneruj' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('w kolejce są mecze obu grup', async () => {
    // Dwie grupy po dwie drużyny: jedna kolejka z dwoma meczami, po jednym z każdej grupy.
    await expect(page.getByRole('heading', { name: 'Kolejka 1' })).toBeVisible();
    const rows = page.getByRole('button', { name: / – / });
    await expect(rows).toHaveCount(2);

    const filter = page.getByRole('group', { name: 'Filtr grup' });
    await expect(filter.getByRole('button', { name: 'Grupa A' })).toBeVisible();
    await expect(filter.getByRole('button', { name: 'Grupa B' })).toBeVisible();

    // Filtr zwęża kolejkę do meczów jednej grupy.
    await filter.getByRole('button', { name: 'Grupa A' }).click();
    await expect(rows).toHaveCount(1);
  });
});
