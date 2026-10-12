import { expect, test } from './fixtures';

/**
 * Zdarzenie meczu przy stoliku (#200): mecz trwający → typ przy drużynie →
 * numer zawodnika → zdarzenie na osi. Przechodzi przez kontrakt zdarzeń,
 * walidację drużyny i zawodnika na Laravelu oraz okno meczu z sekcją poza
 * formularzem — szew, którego nie widzi vitest na msw ani Pest bez
 * przeglądarki.
 *
 * Turniej, drużyny, zawodnicy, terminarz i stan meczu powstają przez API; przez
 * ekran idzie tylko to, co test sprawdza.
 */
test('mecz trwający: gol zawodnika trafia na oś meczu i zostaje po ponownym otwarciu', async ({ api, page, tournament }) => {
  const teams: { id: number; name: string; scorer: string }[] = [];

  for (const [name, scorer] of [
    ['Wilki', 'Marek Nowak'],
    ['Sokoły', 'Tomasz Lis'],
  ] as const) {
    const created = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(created.error, `POST /teams ${name}`).toBeUndefined();
    const team = created.data!.data;

    const player = await api.POST('/teams/{team}/players', {
      params: { path: { team: team.id } },
      body: { name: scorer, number: 9, position: null },
    });
    expect(player.error, `POST /players ${scorer}`).toBeUndefined();
    teams.push({ id: team.id, name, scorer });
  }

  const stages = await api.GET('/tournaments/{tournament}/stages', {
    params: { path: { tournament: tournament.id } },
  });
  const stage = stages.data!.data[0]!;
  const generated = await api.POST('/stages/{stage}/schedule', {
    params: { path: { stage: stage.id } },
    body: { meetings: 1 },
  });
  expect(generated.error, 'POST /schedule').toBeUndefined();

  const matches = await api.GET('/tournaments/{tournament}/matches', {
    params: { path: { tournament: tournament.id }, query: { stageId: stage.id } },
  });
  const match = matches.data!.data[0]!;
  const started = await api.PATCH('/matches/{match}', {
    params: { path: { match: match.id } },
    body: { status: 'live', homeScore: 0, awayScore: 0 },
  });
  expect(started.error, 'PATCH /matches live').toBeUndefined();

  // Gospodarza losuje generator, więc strzelca bierzemy z drużyny gospodarza.
  const home = teams.find((team) => team.id === match.homeTeam!.id)!;
  const away = teams.find((team) => team.id === match.awayTeam!.id)!;
  const title = `${home.name} – ${away.name}`;

  await page.goto(`/tournaments/${tournament.id}/schedule`);

  await test.step(`wpisuje gola: ${home.scorer} w 12′`, async () => {
    await page.getByRole('button', { name: title }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await dialog.getByRole('group', { name: `Zdarzenia: ${home.name}` }).getByRole('button', { name: 'Bramka', exact: true }).click();
    await dialog.getByLabel('Minuta').fill('12');
    await dialog.getByRole('button', { name: `9. ${home.scorer}` }).click();

    await expect(
      dialog.getByRole('list', { name: 'Oś meczu' }).getByRole('button', { name: `Edytuj: 12′ Bramka, ${home.scorer} (${home.name})` }),
    ).toBeVisible();
  });

  await test.step('zdarzenie zostaje po ponownym otwarciu okna', async () => {
    const dialog = page.getByRole('dialog', { name: title });
    await dialog.getByRole('button', { name: 'Anuluj' }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await page.getByRole('button', { name: title }).click();
    await expect(
      page
        .getByRole('dialog', { name: title })
        .getByRole('list', { name: 'Oś meczu' })
        .getByRole('button', { name: `Edytuj: 12′ Bramka, ${home.scorer} (${home.name})` }),
    ).toBeVisible();
  });
});
