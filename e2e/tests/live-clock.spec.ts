import { ONE_POLL, PUBLIC_URL } from './env';
import { expect, test } from './fixtures';

/**
 * Zegar meczu na żywo (#297): organizator prowadzi części w oknie meczu,
 * a kibic widzi minutę, przerwę i 46′ na starcie 2. połowy. Szew, którego nie
 * widzi ani vitest na msw, ani Pest bez przeglądarki: przycisk części w panelu
 * → `PATCH /matches/{match}` ze stemplem serwera → odpytanie strony → minuta
 * liczona w przeglądarce.
 *
 * Zegara przeglądarki nie przesuwamy (`page.clock`): start części stempluje
 * serwer, więc przesunięty zegar dałby fałszywą minutę. Doliczony czas
 * sprawdzają testy jednostkowe zegara.
 */
test('organizator prowadzi części meczu w panelu, a kibic widzi minutę, przerwę i 46′', async ({ page, context, api, tournament }) => {
  // Dwa cykle odpytywania strony (przerwa, potem 2. połowa) nie mieszczą się w domyślnych 30 s.
  test.setTimeout(90_000);
  const title = await test.step('aktywna liga z meczem trwającym przez API', async () => {
    for (const name of ['Wilki', 'Sokoły']) {
      const created = await api.POST('/tournaments/{tournament}/teams', {
        params: { path: { tournament: tournament.id } },
        body: { name },
      });
      expect(created.error, `POST /teams ${name}`).toBeUndefined();
    }
    const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: tournament.id } } });
    const stage = stages.data!.data[0]!;
    const generated = await api.POST('/stages/{stage}/schedule', { params: { path: { stage: stage.id } }, body: { meetings: 1 } });
    expect(generated.error, 'POST /schedule').toBeUndefined();
    const published = await api.PATCH('/tournaments/{tournament}', {
      params: { path: { tournament: tournament.id } },
      body: { status: 'active' },
    });
    expect(published.error, 'PATCH /tournaments status').toBeUndefined();

    const matches = await api.GET('/tournaments/{tournament}/matches', {
      params: { path: { tournament: tournament.id }, query: { stageId: stage.id } },
    });
    const match = matches.data!.data[0]!;
    const started = await api.PATCH('/matches/{match}', {
      params: { path: { match: match.id } },
      body: { status: 'live', homeScore: 0, awayScore: 0 },
    });
    expect(started.error, 'PATCH /matches live').toBeUndefined();
    return `${match.homeTeam!.name} – ${match.awayTeam!.name}`;
  });

  const fan = await context.newPage();
  const row = fan.getByRole('link', { name: title });

  await test.step('w Terminarzu strony wiersz ma „Na żywo” i 1′', async () => {
    await fan.goto(`${PUBLIC_URL}/t/${tournament.slug}/terminarz`);
    await expect(row.getByText('Na żywo')).toBeVisible();
    await expect(row.getByText('1′', { exact: true })).toBeVisible();
  });

  const dialog = page.getByRole('dialog', { name: title });

  await test.step('organizator zaczyna przerwę w oknie meczu', async () => {
    await page.goto(`/tournaments/${tournament.id}/schedule`);
    await page.getByRole('button', { name: title }).click();
    await dialog.getByRole('button', { name: 'Przerwa' }).click();
    await expect(dialog.getByRole('button', { name: 'Start 2. połowy' })).toBeVisible();
  });

  await test.step('kibic widzi „Przerwa” w wierszu i na stronie meczu', async () => {
    await expect(row.getByText('Przerwa', { exact: true })).toBeVisible({ timeout: ONE_POLL });
    await row.click();
    const board = fan.getByRole('region', { name: `Mecz: ${title}` });
    await expect(board.getByText('Przerwa', { exact: true })).toBeVisible();
  });

  await test.step('po „Start 2. połowy” w panelu strona meczu pokazuje 46′', async () => {
    await dialog.getByRole('button', { name: 'Start 2. połowy' }).click();
    // 2. połowa w lidze jest ostatnia: przycisku części już nie ma.
    await expect(dialog.getByRole('button', { name: /^(Przerwa|Start |Dogrywka)/ })).toHaveCount(0);
    const board = fan.getByRole('region', { name: `Mecz: ${title}` });
    await expect(board.getByText('46′', { exact: true })).toBeVisible({ timeout: ONE_POLL });
  });
});
