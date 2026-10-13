import { expect, test } from './fixtures';

/**
 * Nazwy po alfabecie, bo lista drużyn idzie po nazwie, a okno rozstawienia
 * startuje od jej kolejności: Bobry to seed 1, Dziki seed 2.
 */
const TEAMS = ['Bobry', 'Dziki', 'Foki', 'Gryfy', 'Kruki', 'Lisy'];

/**
 * Generowanie drabinki na prawdziwej bazie (#227): sześć drużyn to drabinka
 * na osiem, więc seedy 1 i 2 dostają wolny los i stoją od razu w półfinałach,
 * a w ćwierćfinale grają tylko dwa mecze. Szew, którego nie widzi ani vitest
 * na mocku, ani Pest bez przeglądarki: rozstawienie z okna musi dojść do
 * generatora w tej samej kolejności.
 */
test('organizer rozstawia i generuje drabinkę pucharu sześciu drużyn', async ({ page, api, cup }) => {
  await test.step('dodaje sześć drużyn przez API', async () => {
    for (const name of TEAMS) {
      const { error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: cup.id } },
        body: { name },
      });
      expect(error, `POST /teams ${name}`).toBeUndefined();
    }
  });

  await test.step('generuje drabinkę z kolejności z listy', async () => {
    await page.goto(`/tournaments/${cup.id}/bracket`);
    await expect(page.getByText(/6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych\./)).toBeVisible();
    await page.getByRole('button', { name: 'Rozstaw i wygeneruj' }).click();

    const dialog = page.getByRole('dialog', { name: 'Rozstaw i wygeneruj' });
    await expect(dialog.getByRole('list', { name: 'Podgląd 1. rundy' }).getByRole('listitem')).toHaveCount(4);
    await dialog.getByRole('button', { name: 'Wygeneruj' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('w ćwierćfinale grają dwa mecze', async () => {
    await expect(page.getByRole('tab', { selected: true })).toContainText('Ćwierćfinał');
    await expect(page.getByRole('button', { name: /^Ćwierćfinał \d/ })).toHaveCount(2);
  });

  await test.step('w półfinałach stoją seedy 1 i 2', async () => {
    await page.getByRole('tab', { name: /^Półfinał/ }).click();
    await expect(page.getByRole('button', { name: 'Półfinał 1: Bobry – Zwycięzca: Ćwierćfinał 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Półfinał 2: Dziki – Zwycięzca: Ćwierćfinał 4' })).toBeVisible();
  });

  await test.step('karta Terminarz jest w pucharze nieczynna', async () => {
    const tab = page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByText('Terminarz');
    await expect(tab).toHaveAttribute('aria-disabled', 'true');
  });
});

/**
 * Wynik meczu pucharowego na prawdziwej bazie (#228): remis rozstrzygnięty
 * karnymi wpuszcza zwycięzcę do finału, a przegranego do meczu o 3. miejsce.
 * Szew panel → `PATCH` → awans w backendzie → odświeżona lista meczów fazy,
 * którego nie widzi ani vitest na mocku, ani Pest bez przeglądarki.
 */
test('organizer wpisuje remis z karnymi w półfinale, a zwycięzca i przegrany stają w meczach zależnych', async ({
  page,
  api,
  cup,
}) => {
  await test.step('puchar czterech drużyn z meczem o 3. miejsce przez API', async () => {
    const teamIds: number[] = [];
    for (const name of TEAMS.slice(0, 4)) {
      const { data, error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: cup.id } },
        body: { name },
      });
      expect(error, `POST /teams ${name}`).toBeUndefined();
      teamIds.push(data!.data.id);
    }
    const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: cup.id } } });
    const stage = stages.data!.data.find((candidate) => candidate.type === 'knockout')!;
    const { error } = await api.POST('/stages/{stage}/bracket', {
      params: { path: { stage: stage.id } },
      body: { teamIds, thirdPlaceMatch: true },
    });
    expect(error, 'POST /bracket').toBeUndefined();
  });

  await test.step('półfinał 1:1, Zakończony, karne 4:3', async () => {
    await page.goto(`/tournaments/${cup.id}/bracket`);
    await page.getByRole('button', { name: 'Półfinał 1: Bobry – Gryfy' }).click();

    const dialog = page.getByRole('dialog', { name: 'Bobry – Gryfy' });
    // Radio przełącznika stanu jest `sr-only` pod etykietą, jak w `organizer-flow.spec.ts`.
    await dialog.getByText('Zakończony', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: 'Zakończony', exact: true })).toBeChecked();
    await dialog.getByLabel('Wynik Bobry').fill('1');
    await dialog.getByLabel('Wynik Gryfy').fill('1');
    await dialog.getByLabel('Karne Bobry').fill('4');
    await dialog.getByLabel('Karne Gryfy').fill('3');
    await expect(dialog.getByText('Bobry awansują do finału.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Zapisz' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Półfinał 1: Bobry – Gryfy' })).toContainText('1:1 (k. 4:3)');
  });

  await test.step('zwycięzca stoi w finale, a przegrany w meczu o 3. miejsce', async () => {
    await page.getByRole('tab', { name: /^Finał/ }).click();
    await expect(page.getByRole('button', { name: 'Finał: Bobry – Zwycięzca: Półfinał 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mecz o 3. miejsce: Gryfy – Przegrany: Półfinał 2' })).toBeVisible();
  });
});
