import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, finished, match, publicApi, renderAt, scorer } from '../test/public-api';

/*
 * Strzelcy na tablicy meczu trwającego w pasie etapu Przeglądu (#208, #296).
 * Wiersze składa serwer (`PublicMatch.scorers`), a ekran pokazuje je tylko
 * przy meczu na żywo. Wiersz Terminarza i Wyników strzelców nie ma (#292,
 * test w `match-rounds.test.tsx`), a pełną listę ma strona meczu.
 */

/** Linia strzelców tablicy meczu o stanie `status`; `null` bez linii. */
function scorersOn(status: 'live' | 'finished') {
  const board = document.querySelector(`[data-slot="stage-board"][data-status="${status}"]`);
  return board?.querySelector('[data-slot="stage-board-scorers"]')?.textContent ?? null;
}

describe('Przegląd', () => {
  it('tablica meczu na żywo ma strzelców, z samobójem oznaczonym „(sam.)”; mecz zakończony ich nie ma', async () => {
    publicApi({
      results: [finished(2, 3, { scorers: [scorer(2, 'home', 3, { player: { id: 3, name: 'Adam Bez' }, minutes: [{ minute: 12, addedTime: null }] })] })],
      fixtures: [
        match(1, 3, {
          status: 'live',
          homeScore: 2,
          awayScore: 0,
          scorers: [
            scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [{ minute: 5, addedTime: null }] }),
            scorer(1, 'away', 2, { player: { id: 2, name: 'Jan Lis' }, minutes: [{ minute: 40, addedTime: null }], ownGoal: true }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Kolejka 3' });
    expect(scorersOn('live')).toBe("Marek Nowak 5′, Jan Lis 40′ (sam.)");
    expect(scorersOn('finished')).toBeNull();
  });
});
