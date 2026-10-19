import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, match, publicApi, renderAt, scorer } from '../test/public-api';

/*
 * Strzelcy na kaflu „Na żywo” Przeglądu (#208). Wiersze składa serwer
 * (`PublicMatch.scorers`), a ekran rozstrzyga stronę, format i limit — tego
 * pilnują testy niżej. Wiersz Terminarza i Wyników strzelców już nie ma
 * (#292, test w `match-rounds.test.tsx`).
 */

/** Wpisy listy strzelców drużyny, w kolejności z DOM-u; pusta, gdy listy nie ma. */
function scorersOf(team: string, container: HTMLElement = document.body) {
  const list = within(container).queryByRole('list', { name: `Strzelcy: ${team}` });
  return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : [];
}

describe('Przegląd', () => {
  it('kafel „Na żywo” pokazuje strzelców po obu stronach, z samobójem u przeciwnika', async () => {
    publicApi({
      fixtures: [
        match(1, 3, {
          status: 'live',
          homeScore: 2,
          awayScore: 0,
          scorers: [
            scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [5] }),
            scorer(1, 'away', 2, { player: { id: 2, name: 'Jan Lis' }, minutes: [40], ownGoal: true }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}`);

    const tile = within(await screen.findByRole('region', { name: 'Na żywo' })).getByRole('article');
    expect(scorersOf('Gospodarz 1', tile)).toEqual(["Marek Nowak 5'", "Jan Lis 40' (sam.)"]);
    expect(scorersOf('Gość 1', tile)).toEqual([]);
  });
});
