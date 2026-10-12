import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, finished, match, publicApi, renderAt, row, table } from '../test/public-api';

/** Nazwy par w sekcji, w kolejności z DOM-u (`MatchRow` ma nazwę „gospodarz – gość”). */
function pairsIn(section: string) {
  return within(screen.getByRole('region', { name: section }))
    .getAllByRole('group')
    .map((group) => group.getAttribute('aria-label'));
}

/** Tytuły sekcji Przeglądu w kolejności z DOM-u. */
function sections() {
  return screen.getAllByRole('region').map((region) => within(region).getAllByRole('heading')[0]!.textContent);
}

describe('Przegląd', () => {
  it('sekcja „Na żywo” jest tylko przy meczu live, z kaflem każdego takiego meczu', async () => {
    publicApi({
      fixtures: [
        match(1, 3, { status: 'live', homeScore: 1, awayScore: 0 }),
        match(2, 3, { status: 'live', homeScore: 0, awayScore: 0 }),
        match(3, 3),
      ],
    });
    renderAt(`/t/${SLUG}`);

    const live = within(await screen.findByRole('region', { name: 'Na żywo' }));
    expect(live.getAllByRole('article').map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Gospodarz 1 – Gość 1',
      'Gospodarz 2 – Gość 2',
    ]);
    expect(live.getAllByRole('link', { name: /Śledź na żywo/ })[0]).toHaveAttribute('href', `/t/${SLUG}/terminarz`);
  });

  it('bez meczu live sekcji „Na żywo” nie ma', async () => {
    publicApi({ fixtures: [match(1, 3)] });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Najbliższe mecze' });
    expect(screen.queryByRole('region', { name: 'Na żywo' })).not.toBeInTheDocument();
  });

  it('„Najbliższe mecze” to najwyżej 5 meczów zaplanowanych z jednej, najbliższej kolejki', async () => {
    // API daje terminarz rosnąco po terminie: kolejka 4 zaczyna się przed 5.
    // Mecz trwający z kolejki 4 ma swoją sekcję, więc tu go nie ma.
    publicApi({
      fixtures: [
        match(1, 4, { status: 'live', homeScore: 0, awayScore: 0 }),
        ...[2, 3, 4, 5, 6, 7].map((id) => match(id, 4)),
        match(8, 5),
      ],
    });
    renderAt(`/t/${SLUG}`);

    const section = within(await screen.findByRole('region', { name: 'Najbliższe mecze' }));
    expect(pairsIn('Najbliższe mecze')).toEqual([2, 3, 4, 5, 6].map((id) => `Gospodarz ${id} – Gość ${id}`));
    expect(section.getByRole('link', { name: /Cały terminarz/ })).toHaveAttribute('href', `/t/${SLUG}/terminarz`);
  });

  it('„Ostatnie wyniki” to najwyżej 5 meczów z najnowszej kolejki', async () => {
    // API daje wyniki malejąco po terminie: najpierw najnowsza kolejka 6.
    publicApi({ results: [...[1, 2, 3, 4, 5, 6].map((id) => finished(id, 6)), finished(7, 5)] });
    renderAt(`/t/${SLUG}`);

    const section = within(await screen.findByRole('region', { name: 'Ostatnie wyniki' }));
    expect(pairsIn('Ostatnie wyniki')).toEqual([1, 2, 3, 4, 5].map((id) => `Gospodarz ${id} – Gość ${id}`));
    expect(section.getByRole('link', { name: /Wszystkie wyniki/ })).toHaveAttribute('href', `/t/${SLUG}/wyniki`);
  });

  it('skrót tabeli ma 5 pierwszych wierszy pierwszej tabeli i odnośnik do pełnej', async () => {
    const names = ['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
    publicApi({
      standings: [
        table({ rows: names.map((name, index) => row({ position: index + 1, team: { id: index + 1, name, logoUrl: null } })) }),
        table({ stageId: 2, rows: [row({ team: { id: 99, name: 'Druga tabela', logoUrl: null } })] }),
      ],
    });
    renderAt(`/t/${SLUG}`);

    const snippet = within(await screen.findByRole('region', { name: 'Tabela (skrót)' }));
    const items = snippet.getAllByRole('listitem');
    // Treść wiersza: miejsce, skrót herbu, nazwa, punkty.
    expect(items.map((item) => item.textContent)).toEqual(
      names.slice(0, 5).map((name, index) => expect.stringMatching(new RegExp(`^${index + 1}.*${name}`))),
    );
    expect(snippet.queryByText('Druga tabela')).not.toBeInTheDocument();
    expect(snippet.getByRole('link', { name: /Zobacz pełną tabelę/ })).toHaveAttribute('href', `/t/${SLUG}/tabela`);
  });

  it('sekcja bez meczów znika: przed startem jest tylko tabela', async () => {
    publicApi({ fixtures: [], results: [] });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Tabela (skrót)' });
    expect(sections()).toEqual(['Tabela (skrót)']);
  });

  it('sekcje idą w kolejności: Na żywo, Najbliższe mecze, Ostatnie wyniki, Tabela', async () => {
    publicApi({
      fixtures: [match(1, 2, { status: 'live', homeScore: 1, awayScore: 1 }), match(2, 3)],
      results: [finished(3, 1)],
    });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Na żywo' });
    await screen.findByRole('region', { name: 'Ostatnie wyniki' });
    expect(sections()).toEqual(['Na żywo', 'Najbliższe mecze', 'Ostatnie wyniki', 'Tabela (skrót)']);
  });
});
