import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, finished, match, publicApi, renderAt, scorer } from '../test/public-api';

/*
 * Strzelcy pod wynikiem (#208). Wiersze składa serwer (`PublicMatch.scorers`),
 * a ekran rozstrzyga stronę, format i limit — tego pilnują testy niżej.
 */

/** Wpisy listy strzelców drużyny, w kolejności z DOM-u; pusta, gdy listy nie ma. */
function scorersOf(team: string, container: HTMLElement = document.body) {
  const list = within(container).queryByRole('list', { name: `Strzelcy: ${team}` });
  return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : [];
}

describe('Wyniki', () => {
  it('samobój stoi po stronie przeciwnika drużyny strzelca, z dopiskiem „(sam.)”', async () => {
    publicApi({
      results: [
        finished(1, 1, {
          homeScore: 1,
          awayScore: 1,
          scorers: [
            scorer(1, 'away', 7, { player: { id: 7, name: 'Jan Lis' }, minutes: [30], ownGoal: true }),
            scorer(1, 'away', 8, { player: { id: 8, name: 'Adam Zieliński' }, minutes: [70] }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(["Jan Lis 30' (sam.)"]);
    expect(scorersOf('Gość 1')).toEqual(["Adam Zieliński 70'"]);
  });

  it('bramka bez minuty przełącza wiersz na sumę, a wiersz z kompletem minut pokazuje minuty', async () => {
    publicApi({
      results: [
        finished(1, 1, {
          scorers: [
            scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, value: 2, minutes: [23, 67] }),
            scorer(1, 'away', 2, { player: { id: 2, name: 'Rafał Duda' }, value: 2, minutes: [23] }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(["Marek Nowak 23' 67'"]);
    expect(scorersOf('Gość 1')).toEqual(['Rafał Duda 2']);
  });

  it('w formacie sumy stoją najwyżej 3 wiersze na drużynę, malejąco po value, a minut nikt nie ogranicza', async () => {
    const sum = (id: number, name: string, value: number) =>
      scorer(1, 'home', id, { player: { id, name }, value, minutes: [] });
    const goal = (id: number) => scorer(1, 'away', id, { player: { id, name: `Strzelec ${id}` }, minutes: [id] });
    publicApi({
      results: [
        finished(1, 1, {
          homeScore: 90,
          awayScore: 5,
          // Kolejność z API: wiersze bez minut po id zawodnika.
          scorers: [goal(11), goal(12), goal(13), goal(14), goal(15), sum(1, 'Igor Kowal', 12), sum(2, 'Kacper Lipa', 28), sum(3, 'Oskar Dąb', 31), sum(4, 'Bruno Klon', 19)],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(scorersOf('Gospodarz 1')).toEqual(['Oskar Dąb 31', 'Kacper Lipa 28', 'Bruno Klon 19']);
    expect(scorersOf('Gość 1')).toEqual([11, 12, 13, 14, 15].map((id) => `Strzelec ${id} ${id}'`));
  });

  it('pod wynikiem stoją tylko zdobycze: bez kartek i bez listy przy meczu bez strzelców', async () => {
    publicApi({
      results: [
        finished(1, 1, { scorers: [scorer(1, 'home', 1, { player: { id: 1, name: 'Marek Nowak' }, minutes: [23] })] }),
        finished(2, 1, { homeScore: 0, awayScore: 0 }),
      ],
    });
    renderAt(`/t/${SLUG}/wyniki`);

    const round = await screen.findByRole('region', { name: 'Kolejka 1' });
    expect(within(round).getAllByRole('list', { name: /^Strzelcy:/ })).toHaveLength(1);
    expect(scorersOf('Gospodarz 1')).toEqual(["Marek Nowak 23'"]);
    expect(round).not.toHaveTextContent(/kartk/i);
  });
});

describe('Terminarz', () => {
  it('mecz na żywo ma strzelców pod wynikiem, zaplanowany nie ma listy', async () => {
    publicApi({
      fixtures: [
        match(1, 1, {
          status: 'live',
          homeScore: 0,
          awayScore: 1,
          scorers: [scorer(1, 'away', 4, { player: { id: 4, name: 'Tomasz Lis' }, minutes: [12] })],
        }),
        match(2, 1),
      ],
    });
    renderAt(`/t/${SLUG}/terminarz`);

    const round = within(await screen.findByRole('region', { name: 'Kolejka 1' }));
    const live = round.getByRole('group', { name: 'Gospodarz 1 – Gość 1' });
    expect(scorersOf('Gość 1', live)).toEqual(["Tomasz Lis 12'"]);
    expect(within(round.getByRole('group', { name: 'Gospodarz 2 – Gość 2' })).queryByRole('list')).not.toBeInTheDocument();
  });
});

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
