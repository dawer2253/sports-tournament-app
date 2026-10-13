import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, finished, leaderRow, leaderboard, match, publicApi, renderAt, row, table } from '../test/public-api';

/**
 * Nazwy par w sekcji, w kolejności z DOM-u. `MatchRow` to odnośnik na stronę
 * meczu (#210) z nazwą „gospodarz – gość”; odnośnik nagłówka sekcji odpada.
 */
function pairsIn(section: string) {
  return within(screen.getByRole('region', { name: section }))
    .getAllByRole('link', { name: / – / })
    .map((link) => link.getAttribute('aria-label'));
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
    // #210 zmienia punkt 1 Przeglądu z #206: „Śledź na żywo” prowadzi na stronę meczu.
    expect(live.getAllByRole('link', { name: /Śledź na żywo/ }).map((link) => link.getAttribute('href'))).toEqual([
      `/t/${SLUG}/mecze/1`,
      `/t/${SLUG}/mecze/2`,
    ]);
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

  it('kolejki Przeglądu to te, na których otwierają się Terminarz i Wyniki, nie te z najwcześniejszym terminem', async () => {
    // Przełożony mecz kolejki 1 rozegrano po kolejce 3, więc w `/results`
    // (malejąco po terminie) stoi pierwszy. Wyniki otwierają się na kolejce 3.
    // W `/fixtures` mecz kolejki 6 ma wcześniejszy termin niż kolejka 5.
    publicApi({
      results: [finished(1, 1), finished(2, 3), finished(3, 3), finished(4, 2)],
      fixtures: [match(5, 6), match(6, 5), match(7, 5)],
    });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Ostatnie wyniki' });
    expect(pairsIn('Ostatnie wyniki')).toEqual(['Gospodarz 2 – Gość 2', 'Gospodarz 3 – Gość 3']);
    expect(pairsIn('Najbliższe mecze')).toEqual(['Gospodarz 6 – Gość 6', 'Gospodarz 7 – Gość 7']);
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

  it('sekcja bez meczów znika: przed startem jest tylko tabela i klasyfikacja z pustym stanem', async () => {
    publicApi({ fixtures: [], results: [] });
    renderAt(`/t/${SLUG}`);

    const card = within(await screen.findByRole('region', { name: 'Bramki' }));
    expect(sections()).toEqual(['Tabela (skrót)', 'Bramki']);
    expect(card.getByText(/Klasyfikacja ruszy po pierwszym zakończonym meczu/)).toBeInTheDocument();
    expect(card.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('sekcje idą w kolejności: Na żywo, Najbliższe mecze, Ostatnie wyniki, Tabela', async () => {
    publicApi({
      fixtures: [match(1, 2, { status: 'live', homeScore: 1, awayScore: 1 }), match(2, 3)],
      results: [finished(3, 1)],
    });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Na żywo' });
    await screen.findByRole('region', { name: 'Ostatnie wyniki' });
    await screen.findByRole('region', { name: 'Bramki' });
    expect(sections()).toEqual(['Na żywo', 'Najbliższe mecze', 'Ostatnie wyniki', 'Tabela (skrót)', 'Bramki']);
  });

  it('karta klasyfikacji pyta o domyślną statystykę, a tytuł i etykietę bierze z odpowiedzi', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a odpowiedź mówi
    // „Punkty” — przejdzie tylko widok, który czyta `label`, nie sport.
    const requests = publicApi({ leaderboards: () => leaderboard({ label: 'Punkty', rows: [leaderRow(1, { value: 57 })] }) });
    renderAt(`/t/${SLUG}`);

    const card = within(await screen.findByRole('region', { name: 'Punkty' }));
    expect(screen.queryByRole('region', { name: 'Bramki' })).not.toBeInTheDocument();
    expect(card.getByRole('listitem')).toHaveTextContent(/Zawodnik 1.*57.*Punkty/);
    expect(card.getByRole('link', { name: /Wszystkie statystyki/ })).toHaveAttribute('href', `/t/${SLUG}/statystyki`);
    expect(requests.leaderboard).toEqual([null]);
  });

  it('karta klasyfikacji dopełnia liderów do 5 wierszy kolejnymi pozycjami', async () => {
    publicApi({
      leaderboards: () =>
        leaderboard({
          rows: [
            leaderRow(1, { position: 1, value: 5 }),
            leaderRow(2, { position: 1, value: 5 }),
            ...[3, 4, 5, 6, 7].map((id) => leaderRow(id, { position: 3, value: 2 })),
          ],
        }),
    });
    renderAt(`/t/${SLUG}`);

    const card = within(await screen.findByRole('region', { name: 'Bramki' }));
    expect(card.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      [1, 2, 3, 4, 5].map((id) => expect.stringContaining(`Zawodnik ${id}`)),
    );
  });

  it('karta klasyfikacji pokazuje wszystkich z pierwszym miejscem, także sześciu, i nikogo więcej', async () => {
    publicApi({
      leaderboards: () =>
        leaderboard({
          rows: [
            ...[1, 2, 3, 4, 5, 6].map((id) => leaderRow(id, { position: 1, value: 2 })),
            leaderRow(7, { position: 7, value: 1 }),
          ],
        }),
    });
    renderAt(`/t/${SLUG}`);

    const card = within(await screen.findByRole('region', { name: 'Bramki' }));
    expect(card.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      [1, 2, 3, 4, 5, 6].map((id) => expect.stringContaining(`Zawodnik ${id}`)),
    );
  });
});
