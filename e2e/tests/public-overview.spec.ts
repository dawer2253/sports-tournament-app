import { PUBLIC_URL } from './env';
import { expect, test } from './fixtures';

/** Odpytywanie strony publicznej (`POLL_INTERVAL_MS`, 15 s) z zapasem na odpowiedź Laravela. */
const ONE_POLL = 20_000;

/**
 * Przegląd pucharu (#296): przed drabinką kibic widzi prezentację drużyn
 * z `/teams`, a po jej wygenerowaniu w panelu — bez przeładowania, w czasie
 * jednego cyklu odpytywania — pas rundy i drabinkę. Szew, którego nie widzi
 * ani vitest na mocku, ani Pest bez przeglądarki: generator w backendzie →
 * `/matches?stageId=` → pas etapu i drzewo na Przeglądzie.
 *
 * Kolejność drużyn w `teamIds` to rozstawienie, jak w `public-bracket.spec.ts`:
 * Półfinał 1 to Bobry – Gryfy (seedy 1 i 4), Półfinał 2 to Dziki – Foki.
 */
test('kibic widzi drużyny pucharu przed drabinką, a po jej wygenerowaniu pas rundy i drabinkę na Przeglądzie', async ({
  page,
  api,
  cup,
}) => {
  const teamIds = await test.step('aktywny puchar czterech drużyn bez drabinki przez API', async () => {
    const ids: number[] = [];
    // Kolejność dopisania inna niż alfabetyczna: Przegląd układa drużyny sam.
    for (const name of ['Gryfy', 'Bobry', 'Foki', 'Dziki']) {
      const { data, error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: cup.id } },
        body: { name },
      });
      expect(error, `POST /teams ${name}`).toBeUndefined();
      ids.push(data!.data.id);
    }
    const published = await api.PATCH('/tournaments/{tournament}', {
      params: { path: { tournament: cup.id } },
      body: { status: 'active' },
    });
    expect(published.error, 'PATCH /tournaments status').toBeUndefined();
    const [gryfy, bobry, foki, dziki] = ids as [number, number, number, number];
    return [bobry, dziki, foki, gryfy];
  });

  await test.step('Przegląd ma nagłówek „Drużyny” i cztery nazwy alfabetycznie', async () => {
    await page.goto(`${PUBLIC_URL}/t/${cup.slug}`);
    const showcase = page.getByRole('region', { name: 'Drużyny' });
    await expect(showcase.getByRole('listitem')).toHaveText(['Bobry', 'Dziki', 'Foki', 'Gryfy'].map((name) => new RegExp(`${name}$`)));
  });

  await test.step('organizator generuje drabinkę przez API', async () => {
    const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: cup.id } } });
    const stage = stages.data!.data.find((candidate) => candidate.type === 'knockout')!;
    const generated = await api.POST('/stages/{stage}/bracket', {
      params: { path: { stage: stage.id } },
      body: { teamIds, thirdPlaceMatch: false },
    });
    expect(generated.error, 'POST /bracket').toBeUndefined();
  });

  await test.step('bez przeładowania pas pokazuje „Półfinał” z dwoma meczami, a drabinka te same mecze', async () => {
    const band = page.getByRole('region', { name: 'Półfinał' });
    await expect(band.getByRole('link')).toHaveCount(2, { timeout: ONE_POLL });
    await expect(band.getByRole('link', { name: 'Bobry – Gryfy' })).toBeVisible();
    await expect(band.getByRole('link', { name: 'Dziki – Foki' })).toBeVisible();

    const bracket = page.getByRole('region', { name: 'Drabinka' });
    await expect(bracket.getByRole('link', { name: 'Półfinał 1: Bobry – Gryfy' })).toBeVisible();
    await expect(bracket.getByRole('link', { name: 'Półfinał 2: Dziki – Foki' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Drużyny' })).toHaveCount(0);
  });
});
