import { expect, test } from './fixtures';

/**
 * Tabele grup w panelu (#259): po meczu grupy Tabela pokazuje punkty
 * i linię wyjścia, a zmiana liczby wychodzących przy tabeli ją przenosi.
 *
 * Skład, terminarz i wynik idą przez API — ekrany grup i terminarza sprawdza
 * `organizer-groups.spec.ts`. Gospodarza losuje generator, więc zwycięzcę
 * test bierze z meczu, a nie z góry. Wiersz nad linią rozpoznaje po słowach
 * „wychodzi z grupy”, które tabela daje czytnikowi ekranu.
 */
test('organizer widzi tabelę grupy z linią wyjścia i ją przesuwa', async ({ page, api, groups }) => {
  const teamIds: number[] = [];

  await test.step('układa przez API dwie grupy, terminarz i wynik meczu grupy A', async () => {
    for (const name of ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany', 'Rysie Wola', 'Lwy Targówek']) {
      const { data, error } = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: groups.id } },
        body: { name },
      });
      expect(error, `POST /tournaments/${groups.id}/teams`).toBeUndefined();
      teamIds.push(data!.data.id);
    }

    const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: groups.id } } });
    const stage = stages.data!.data.find((candidate) => candidate.type === 'group')!;

    const composed = await api.PUT('/stages/{stage}/groups', {
      params: { path: { stage: stage.id } },
      body: {
        groups: [
          // Trzy drużyny w A: przy dwóch wychodzących linia dalej stoi nad ostatnią.
          { name: 'Grupa A', teamIds: teamIds.slice(0, 3), qualifiers: 1 },
          { name: 'Grupa B', teamIds: teamIds.slice(3), qualifiers: 1 },
        ],
      },
    });
    expect(composed.error, 'PUT /stages/{stage}/groups').toBeUndefined();

    const generated = await api.POST('/stages/{stage}/schedule', {
      params: { path: { stage: stage.id } },
      body: { meetings: 1 },
    });
    expect(generated.error, 'POST /stages/{stage}/schedule').toBeUndefined();

    const groupA = composed.data!.data.groups.find((group) => group.name === 'Grupa A')!;
    const matches = await api.GET('/tournaments/{tournament}/matches', {
      params: { path: { tournament: groups.id }, query: { stageId: stage.id } },
    });
    const match = matches.data!.data.find((candidate) => candidate.groupId === groupA.id)!;
    const saved = await api.PATCH('/matches/{match}', {
      params: { path: { match: match.id } },
      body: { status: 'finished', homeScore: 2, awayScore: 0 },
    });
    expect(saved.error, 'PATCH /matches').toBeUndefined();

    test.info().annotations.push({ type: 'zwycięzca', description: match.homeTeam!.name });
  });

  const winner = test.info().annotations.find((annotation) => annotation.type === 'zwycięzca')!.description!;
  const groupA = page.getByRole('region', { name: 'Faza grupowa · Grupa A' });
  const rows = groupA.getByRole('row').filter({ has: page.getByRole('cell') });
  const qualifying = rows.filter({ hasText: 'wychodzi z grupy' });

  await test.step('Tabela pokazuje punkty zwycięzcy i linię pod pierwszym miejscem', async () => {
    await page.goto(`/tournaments/${groups.id}/standings`);

    await expect(page.getByRole('region', { name: 'Faza grupowa · Grupa B' })).toBeVisible();
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText(winner);
    await expect(rows.first().getByRole('cell').last()).toHaveText('3');
    await expect(qualifying).toHaveCount(1);
    await expect(groupA.getByText(/Z grupy wychodzi 1 drużyna — miejsca nad przerywaną linią/)).toBeVisible();
  });

  await test.step('zmiana liczby wychodzących przenosi linię', async () => {
    await page.getByRole('combobox', { name: 'Ile drużyn wychodzi z grupy Grupa A' }).click();
    await page.getByRole('option', { name: '2' }).click();

    await expect(qualifying).toHaveCount(2);
    await expect(rows.last()).not.toContainText('wychodzi z grupy');
    await expect(groupA.getByText(/Z grupy wychodzą 2 drużyny — miejsca nad przerywaną linią/)).toBeVisible();
  });
});
