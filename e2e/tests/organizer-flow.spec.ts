import type { Locator, Page } from '@playwright/test';
import { expect, test, uniqueName } from './fixtures';
import { expectStandings } from './standings';

const TEAMS = ['Orły', 'Sokoły', 'Jastrzębie'];

/**
 * Kafelki wyboru i przełącznik stanu meczu chowają radio (`sr-only`) pod
 * klikalną etykietą, więc `check()` trafia w kartę nad nim. Klikamy to, co
 * widzi organizator, i sprawdzamy, że wybór trafił w radio o tej nazwie.
 */
async function choose(scope: Page | Locator, name: string) {
  await scope.getByText(name, { exact: true }).click();
  await expect(scope.getByRole('radio', { name, exact: true })).toBeChecked();
}

/**
 * Główna ścieżka organizatora na prawdziwej bazie: turniej → drużyny →
 * terminarz → wynik → tabela. Przechodzi przez kontrakt, walidację,
 * autoryzację poddrzewa i liczenie tabeli, więc łapie rozjazdy, których nie
 * widzi ani vitest na mocku, ani Pest bez przeglądarki.
 */
test('organizer zakłada ligę, układa terminarz i wpisuje wynik, a tabela go liczy', async ({ page }) => {
  const name = uniqueName('Liga E2E');

  await test.step('zakłada turniej', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nowy turniej' }).click();
    await page.getByLabel('Nazwa turnieju').fill(name);
    // W treści ekranu, bo sport stoi też przy turniejach w sidebarze (#195).
    const form = page.getByRole('main');
    await choose(form, 'Piłka nożna');
    await choose(form, 'Liga każdy z każdym');
    await page.getByRole('button', { name: 'Załóż turniej' }).click();

    await page.getByRole('button', { name: `Otwórz turniej ${name}` }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  await test.step('dodaje trzy drużyny', async () => {
    for (const team of TEAMS) {
      await page.getByRole('button', { name: 'Dodaj drużynę' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Nowa drużyna' });
      await dialog.getByLabel('Nazwa drużyny').fill(team);
      await dialog.getByRole('button', { name: 'Dodaj' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('link', { name: team })).toBeVisible();
    }
  });

  await test.step('generuje terminarz: każdy z każdym raz', async () => {
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Terminarz' }).click();
    await page.getByRole('button', { name: 'Wygeneruj terminarz' }).click();
    const dialog = page.getByRole('dialog', { name: 'Wygeneruj terminarz' });
    await choose(dialog, 'Raz');
    await dialog.getByRole('button', { name: 'Wygeneruj' }).click();
    await expect(dialog).toBeHidden();
  });

  // Pary są losowane, więc gospodarza i gościa czytamy z ekranu. Trzy drużyny
  // przy jednej rundzie dają kolejkę z jednym meczem i jedną pauzą (bye).
  const match = page.getByRole('button', { name: / – / });
  await expect(match).toHaveCount(1);
  const [home, away] = (await match.getAttribute('aria-label'))!.split(' – ') as [string, string];
  const byeTeam = TEAMS.find((team) => team !== home && team !== away)!;

  await test.step(`wpisuje wynik ${home} 3:1 ${away}`, async () => {
    await match.click();
    const dialog = page.getByRole('dialog', { name: `${home} – ${away}` });
    await dialog.getByLabel(`Wynik ${home}`).fill('3');
    await dialog.getByLabel(`Wynik ${away}`).fill('1');
    await choose(dialog, 'Zakończony');
    await dialog.getByRole('button', { name: 'Zapisz' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('tabela liczy punkty i kolejność z wyniku', async () => {
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Tabela' }).click();
    // Drużyna z pauzą wyprzedza przegranego bilansem (0 wobec −2) przy równych
    // punktach — domyślne kryteria piłki: punkty, mecz bezpośredni, bilans.
    await expectStandings(page.getByRole('table'), [
      { team: home, played: 1, won: 1, drawn: 0, lost: 0, score: '3:1', points: 3 },
      { team: byeTeam, played: 0, won: 0, drawn: 0, lost: 0, score: '0:0', points: 0 },
      { team: away, played: 1, won: 0, drawn: 0, lost: 1, score: '1:3', points: 0 },
    ]);
  });
});
