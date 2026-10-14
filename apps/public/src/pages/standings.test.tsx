import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SLUG, publicApi, renderAt, row, table, tournament } from '../test/public-api';

const BASKETBALL = tournament({ name: 'Liga Koszykówki 2026', sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } });

/** Treść każdego wiersza ciała tabeli, komórka po komórce, w kolejności z DOM-u. */
function bodyRows() {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map((tr) => within(tr).getAllByRole('cell').map((cell) => cell.textContent));
}

describe('Tabela', () => {
  it('nagłówek zdobyczy bierze się z tabeli, nie ze sportu turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a tabela mówi „Punkty".
    // Zgodna para przeszłaby też implementacji mapującej `sport.code` na
    // etykietę, a ADR-0006 mówi, że etykietę niesie odpowiedź tabeli.
    publicApi({ standings: [table({ scoreLabel: 'Punkty' })] });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
  });

  it('tabela bez allowsDraw nie ma kolumny R, choć sport turnieju zna remisy', async () => {
    publicApi({ standings: [table({ allowsDraw: false })] });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Pkt' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument();
  });

  it('tabela z allowsDraw ma kolumnę R, choć sport turnieju remisów nie zna', async () => {
    publicApi({ data: BASKETBALL, standings: [table({ allowsDraw: true })] });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'R' })).toBeInTheDocument();
  });

  it('zdanie pod tabelą idzie za tiebreakers z odpowiedzi, nie za ustawieniami sportu', async () => {
    // Koszykówka nie ma w ustawieniach „Bramki zdobyte”, a turniej nie zna
    // kolejności z odpowiedzi — przejdzie tylko widok, który czyta tabelę.
    publicApi({
      data: BASKETBALL,
      standings: [
        table({
          tiebreakers: [
            { code: 'points', label: 'Punkty w tabeli' },
            { code: 'score_for', label: 'Bramki zdobyte' },
            { code: 'wins', label: 'Zwycięstwa' },
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(
      await screen.findByText(
        'Kolejność: punkty w tabeli → bramki zdobyte → zwycięstwa → nazwa drużyny (alfabetycznie).',
      ),
    ).toBeInTheDocument();
  });

  it('każda tabela ma nagłówek groupName ?? stageName i własne zdanie', async () => {
    publicApi({
      standings: [
        table({ stageId: 1, stageName: 'Faza zasadnicza' }),
        table({ stageId: 2, groupId: 7, stageName: 'Faza grupowa', groupName: 'Grupa A', tiebreakers: [{ code: 'points', label: 'Pkt' }] }),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('heading', { name: 'Faza zasadnicza' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupa A' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Kolejność:/)).toHaveLength(2);
  });

  it('wiersze wychodzą w kolejności i z wartościami z API', async () => {
    // Kolejność rozstrzygają kryteria organizatora — widok ma jej nie poprawiać.
    // Para na górze ma równe punkty, a API stawia wyżej drużynę z gorszym
    // bilansem i dalszą w alfabecie.
    publicApi({
      standings: [
        table({
          rows: [
            row({ position: 1, team: { id: 2, name: 'Olimpia Park', logoUrl: null }, played: 6, won: 2, drawn: 1, lost: 3, scoreFor: 9, scoreAgainst: 8, scoreDifference: 1, points: 7 }),
            row({ position: 2, team: { id: 1, name: 'Dzielnica FC', logoUrl: null }, played: 3, won: 2, drawn: 1, lost: 0, scoreFor: 10, scoreAgainst: 5, scoreDifference: 5, points: 7 }),
          ],
        }),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    await screen.findByRole('row', { name: /Dzielnica FC/ });
    const rows = bodyRows();
    expect(rows.map((cells) => cells[1])).toEqual([expect.stringContaining('Olimpia Park'), expect.stringContaining('Dzielnica FC')]);
    expect(rows[0]).toContain('9:8');
    expect(rows[1]).toContain('10:5');
  });
});
