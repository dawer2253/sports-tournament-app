import { PUBLIC_URL } from './env';
import { expect, test } from './fixtures';

/**
 * Drabinka na stronie publicznej (#234): puchar czterech drużyn z meczem
 * o 3. miejsce, półfinał 1 rozstrzygnięty karnymi przez API panelu. Szew,
 * którego nie widzi ani vitest na mocku, ani Pest bez przeglądarki: awans
 * w backendzie → `/matches?stageId=` → drzewo strony publicznej.
 *
 * Nazwy po alfabecie, jak w `bracket.spec.ts`: Bobry to seed 1, więc
 * Półfinał 1 to Bobry – Gryfy (seedy 1 i 4).
 */
test('kibic widzi w drabince zwycięzcę półfinału w finale, przegranego w meczu o 3. miejsce i karne', async ({
  page,
  api,
  cup,
}) => {
  const semiId = await test.step('puchar czterech drużyn z meczem o 3. miejsce i karnymi w półfinale przez API', async () => {
    const teamIds: number[] = [];
    for (const name of ['Bobry', 'Dziki', 'Foki', 'Gryfy']) {
      const { data, error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: cup.id } },
        body: { name },
      });
      expect(error, `POST /teams ${name}`).toBeUndefined();
      teamIds.push(data!.data.id);
    }
    const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: cup.id } } });
    const stage = stages.data!.data.find((candidate) => candidate.type === 'knockout')!;
    const generated = await api.POST('/stages/{stage}/bracket', {
      params: { path: { stage: stage.id } },
      body: { teamIds, thirdPlaceMatch: true },
    });
    expect(generated.error, 'POST /bracket').toBeUndefined();

    const matches = await api.GET('/tournaments/{tournament}/matches', {
      params: { path: { tournament: cup.id }, query: { stageId: stage.id } },
    });
    const semi = matches.data!.data.find((match) => match.round.order === 1 && match.matchNumber === 1)!;
    const saved = await api.PATCH('/matches/{match}', {
      params: { path: { match: semi.id } },
      body: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 3 },
    });
    expect(saved.error, 'PATCH /matches').toBeUndefined();

    const published = await api.PATCH('/tournaments/{tournament}', {
      params: { path: { tournament: cup.id } },
      body: { status: 'active' },
    });
    expect(published.error, 'PATCH /tournaments status').toBeUndefined();
    return semi.id;
  });

  await test.step('w Drabince zwycięzca stoi w finale, a przegrany w meczu o 3. miejsce', async () => {
    await page.goto(`${PUBLIC_URL}/t/${cup.slug}`);
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Drabinka' }).click();
    // Start okna trafia do `?od=` przy wejściu (#239): półfinał ma mecz niezakończony.
    await expect(page).toHaveURL(`${PUBLIC_URL}/t/${cup.slug}/drabinka?od=1`);

    await expect(page.getByRole('link', { name: 'Finał: Bobry – Do ustalenia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mecz o 3. miejsce: Gryfy – Do ustalenia' })).toBeVisible();
  });

  await test.step('karne półfinału stoją w nawiasie przy wyniku', async () => {
    const semi = page.getByRole('link', { name: 'Półfinał 1: Bobry – Gryfy' });
    await expect(semi.getByText('(4)', { exact: true })).toBeVisible();
    await expect(semi.getByText('(3)', { exact: true })).toBeVisible();
  });

  await test.step('kafel półfinału otwiera stronę meczu', async () => {
    await page.getByRole('link', { name: 'Półfinał 1: Bobry – Gryfy' }).click();
    await expect(page).toHaveURL(`${PUBLIC_URL}/t/${cup.slug}/mecze/${semiId}`);
    const band = page.getByRole('region', { name: 'Mecz: Bobry – Gryfy' });
    await expect(band.getByText('Półfinał 1')).toBeVisible();
    await expect(band.getByLabel('Wynik 1 : 1, karne 4 : 3')).toBeVisible();
  });
});
