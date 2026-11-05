import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

/** Szerokość i wysokość PNG z nagłówka IHDR (bajty 16–23, big-endian). */
function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(1, 4).toString('ascii'), 'sygnatura PNG').toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * Grafika do social mediów (#333): PNG renderuje przeglądarka panelu z węzła
 * szablonu, w skali 4, więc 4:5 ma wyjść 1440 × 1800. jsdom tego nie
 * narysuje, a test ekranu podmienia render, więc plik sprawdza tylko ten
 * przebieg. Dane powstają przez API, przez ekran idzie tylko „Grafiki”.
 */
test('wynik meczu z zakładki Grafiki pobiera się jako PNG 1440 × 1800', async ({ page, api, tournament }) => {
  for (const name of ['Orły', 'Sokoły']) {
    const { error } = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(error, `POST /teams ${name}`).toBeUndefined();
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
  const saved = await api.PATCH('/matches/{match}', {
    params: { path: { match: match.id } },
    body: { status: 'finished', homeScore: 2, awayScore: 1 },
  });
  expect(saved.error, 'PATCH /matches').toBeUndefined();

  await page.goto(`/tournaments/${tournament.id}`);
  await page.getByRole('link', { name: 'Grafiki' }).click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournament.id}/graphics`));

  await page.getByRole('radio', { name: /Wynik meczu/ }).check();
  const preview = page.getByRole('img', { name: `Grafika: Wynik meczu, ${tournament.name}` });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(match.homeTeam!.name);
  await expect(preview).toContainText(match.awayTeam!.name);

  // Przycisk czeka na gotowy plik (render w chwili podglądu), więc klik od razu go pobiera.
  const button = page.getByRole('button', { name: 'Pobierz PNG' });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);

  expect(download.suggestedFilename()).toBe(`grafika-${tournament.slug}-wynik-4x5.png`);
  const png = await readFile(await download.path());
  expect(pngSize(png)).toEqual({ width: 1440, height: 1800 });
});
