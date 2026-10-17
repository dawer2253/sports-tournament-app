import { expect, test } from './fixtures';

/**
 * Drabinka playoffu z wyjścia z grup (#260): dwie grupy po dwie drużyny,
 * z każdej wychodzą obie. Po rozegranych meczach grup okno rozstawienia
 * startuje z propozycji backendu, więc w półfinałach stoją zwycięzcy grup
 * przeciw drugim miejscom drugiej grupy (1A–2B, 1B–2A). Szew propozycja →
 * okno → generator, którego nie widzi ani vitest na mocku, ani Pest bez
 * przeglądarki. Wynik i awans w pucharze sprawdza `bracket.spec.ts`.
 *
 * Gospodarza losuje generator terminarza, więc zwycięzcę i przegranego test
 * bierze z meczu, a nie z góry.
 */
test('organizer rozstawia drabinkę z tabel grup, a w półfinałach stoją zwycięzcy grup', async ({ page, api, groups }) => {
  const places: Record<string, { winner: string; runnerUp: string }> = {};

  await test.step('układa przez API dwie grupy po dwie drużyny i rozgrywa ich mecze', async () => {
    const teamIds: number[] = [];
    for (const name of ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany', 'Rysie Wola']) {
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
          { name: 'Grupa A', teamIds: teamIds.slice(0, 2), qualifiers: 2 },
          { name: 'Grupa B', teamIds: teamIds.slice(2), qualifiers: 2 },
        ],
      },
    });
    expect(composed.error, 'PUT /stages/{stage}/groups').toBeUndefined();

    const generated = await api.POST('/stages/{stage}/schedule', {
      params: { path: { stage: stage.id } },
      body: { meetings: 1 },
    });
    expect(generated.error, 'POST /stages/{stage}/schedule').toBeUndefined();

    const matches = await api.GET('/tournaments/{tournament}/matches', {
      params: { path: { tournament: groups.id }, query: { stageId: stage.id } },
    });
    for (const group of composed.data!.data.groups) {
      const match = matches.data!.data.find((candidate) => candidate.groupId === group.id)!;
      const saved = await api.PATCH('/matches/{match}', {
        params: { path: { match: match.id } },
        body: { status: 'finished', homeScore: 2, awayScore: 0 },
      });
      expect(saved.error, 'PATCH /matches').toBeUndefined();
      places[group.name] = { winner: match.homeTeam!.name, runnerUp: match.awayTeam!.name };
    }
  });

  const { 'Grupa A': a, 'Grupa B': b } = places;

  await test.step('pusty stan mówi o liczbie wychodzących, a okno startuje z propozycji', async () => {
    await page.goto(`/tournaments/${groups.id}/bracket`);
    await expect(page.getByText('Z grup wychodzą 4 drużyny: drabinka na 4. Rozstawienie startuje z tabel grup.')).toBeVisible();
    await page.getByRole('button', { name: 'Rozstaw i wygeneruj' }).click();

    const dialog = page.getByRole('dialog', { name: 'Rozstaw i wygeneruj' });
    const pairs = dialog.getByRole('list', { name: 'Podgląd 1. rundy' }).getByRole('listitem');
    await expect(pairs).toHaveCount(2);
    await expect(pairs.first()).toContainText(`1A ${a!.winner}`);
    await expect(pairs.first()).toContainText(`2B ${b!.runnerUp}`);
    await dialog.getByRole('button', { name: 'Wygeneruj' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('w półfinałach stoją zwycięzcy grup przeciw drugim miejscom drugiej grupy', async () => {
    await expect(page.getByRole('tab', { selected: true })).toContainText('Półfinał');
    await expect(page.getByRole('button', { name: `Półfinał 1: ${a!.winner} – ${b!.runnerUp}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Półfinał 2: ${b!.winner} – ${a!.runnerUp}` })).toBeVisible();
    await expect(page.getByText(/Drabinka różni się od tabel grup/)).toBeHidden();
  });
});
