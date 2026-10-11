import { expect, type Locator } from '@playwright/test';

export interface ExpectedStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Zdobycze „za:przeciw”, np. `3:1`. */
  score: string;
  points: number;
}

/**
 * Sprawdza tabelę wiersz po wierszu: kolejność drużyn, pozycję i liczby
 * wynikające z wpisanych wyników. Kolumny szuka po nagłówkach, a nie po
 * miejscu, bo panel i strona publiczna układają je inaczej (panel ma bilans,
 * wygrane to w panelu „W”, a na stronie „Z”).
 */
export async function expectStandings(table: Locator, expected: ExpectedStanding[]) {
  const rows = table.getByRole('row').filter({ has: table.page().getByRole('cell') });
  await expect(rows).toHaveCount(expected.length);

  const headers = (await table.getByRole('columnheader').allTextContents()).map((text) => text.trim());
  const column = (...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    expect(index, `kolumna ${names.join('/')} w nagłówku [${headers.join(', ')}]`).toBeGreaterThanOrEqual(0);
    return index;
  };
  const columns = {
    position: column('#'),
    team: column('Drużyna'),
    played: column('M'),
    won: column('W', 'Z'),
    drawn: column('R'),
    lost: column('P'),
    // Nagłówek zdobyczy przychodzi z API (`scoreLabel`); suita gra w piłkę.
    score: column('Bramki'),
    points: column('Pkt'),
  };

  for (const [index, row] of expected.entries()) {
    const cells = rows.nth(index).getByRole('cell');
    await expect(cells.nth(columns.team), `drużyna na miejscu ${index + 1}`).toContainText(row.team);
    await expect(cells.nth(columns.position)).toHaveText(String(index + 1));
    await expect(cells.nth(columns.played)).toHaveText(String(row.played));
    await expect(cells.nth(columns.won)).toHaveText(String(row.won));
    await expect(cells.nth(columns.drawn)).toHaveText(String(row.drawn));
    await expect(cells.nth(columns.lost)).toHaveText(String(row.lost));
    await expect(cells.nth(columns.score)).toHaveText(row.score);
    await expect(cells.nth(columns.points), `punkty ${row.team}`).toHaveText(String(row.points));
  }
}
