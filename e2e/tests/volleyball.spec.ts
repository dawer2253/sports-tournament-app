import type { Locator } from '@playwright/test';
import { PUBLIC_URL } from './env';
import { expect, test, uniqueName } from './fixtures';

/** Przełącznik stanu chowa radio pod etykietą, jak w `organizer-flow.spec.ts`. */
async function choose(scope: Locator, name: string) {
  await scope.getByText(name, { exact: true }).click();
  await expect(scope.getByRole('radio', { name, exact: true })).toBeChecked();
}

/** Mecz 3:2 z piątym setem do 15: gospodarz wygrywa sety 1, 3 i 5. */
const SETS: [number, number][] = [
  [25, 20],
  [22, 25],
  [25, 23],
  [19, 25],
  [15, 12],
];

/**
 * Sport z setami (#301) przez szew panel → Laravel → strona publiczna:
 * organizator wpisuje wynik w setach, serwer liczy z nich sety wygrane
 * i punktację po secie decydującym, a kibic widzi to w Tabeli. Turniej,
 * drużyny i terminarz powstają przez API; przez ekrany idzie tylko wpis setów
 * i asercja na Tabeli strony publicznej.
 */
test('organizator wpisuje wynik 3:2 w setach, a kibic widzi w Tabeli 2 pkt zwycięzcy i 1 pkt przegranego', async ({ page, api }) => {
  const sports = await api.GET('/sports');
  const volleyball = sports.data?.data.find((sport) => sport.code === 'volleyball');
  expect(volleyball, 'siatkówka w GET /sports').toBeDefined();

  const created = await api.POST('/tournaments', {
    body: { name: uniqueName('Siatkówka E2E'), sportId: volleyball!.id, format: 'league' },
  });
  expect(created.error, 'POST /tournaments').toBeUndefined();
  const tournament = created.data!.data;

  for (const name of ['Orlęta', 'Mewy']) {
    const { error } = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(error, `POST /teams ${name}`).toBeUndefined();
  }

  const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: tournament.id } } });
  const generated = await api.POST('/stages/{stage}/schedule', {
    params: { path: { stage: stages.data!.data[0]!.id } },
    body: { meetings: 1 },
  });
  expect(generated.error, 'POST /schedule').toBeUndefined();

  // Szkic nie istnieje publicznie (404 jak nieznany slug, decyzja #82).
  const published = await api.PATCH('/tournaments/{tournament}', {
    params: { path: { tournament: tournament.id } },
    body: { status: 'active' },
  });
  expect(published.error, 'PATCH /tournaments status').toBeUndefined();

  await page.goto(`/tournaments/${tournament.id}/schedule`);
  // Para jest losowana, więc gospodarza i gościa czytamy z ekranu.
  const match = page.getByRole('button', { name: / – / });
  await expect(match).toHaveCount(1);
  const [home, away] = (await match.getAttribute('aria-label'))!.split(' – ') as [string, string];

  await test.step(`wpisuje ${home} – ${away} 3:2 w setach`, async () => {
    await match.click();
    const dialog = page.getByRole('dialog', { name: `${home} – ${away}` });
    await choose(dialog, 'Zakończony');
    for (const [index, [homePoints, awayPoints]] of SETS.entries()) {
      await dialog.getByRole('button', { name: 'Dodaj set' }).click();
      await dialog.getByLabel(`${index + 1}. set, ${home}`).fill(String(homePoints));
      await dialog.getByLabel(`${index + 1}. set, ${away}`).fill(String(awayPoints));
    }
    await expect(dialog.getByText('3 : 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Zapisz' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('kibic widzi w Tabeli 2 pkt zwycięzcy i 1 pkt przegranego', async () => {
    await page.goto(`${PUBLIC_URL}/t/${tournament.slug}/tabela`);
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Sety', exact: true })).toBeVisible();
    const pointsOf = (team: string) => table.getByRole('row').filter({ hasText: team }).getByRole('cell').last();
    await expect(pointsOf(home)).toHaveText('2');
    await expect(pointsOf(away)).toHaveText('1');
    await expect(table.getByRole('row').filter({ hasText: home })).toContainText('3:2');
  });
});
