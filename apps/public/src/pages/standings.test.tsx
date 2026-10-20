import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SLUG, groupTable, groupsTournament, publicApi, renderAt, row, stageMatch, table, tournament } from '../test/public-api';

const BASKETBALL = tournament({ name: 'Liga Koszykówki 2026', sport: { id: 2, code: 'basketball', name: 'Koszykówka', allowsDraw: false } });

/** Ułożony terminarz ligi (`stageId: 1`): kolejka 1 rozegrana, kolejka 2 przed nami. */
const SCHEDULE = [
  stageMatch(1, 1, { status: 'finished', homeScore: 2, awayScore: 1 }),
  stageMatch(2, 2, { kickoffAt: '2026-10-25T09:00:00+00:00' }),
];

/** Treść każdego wiersza ciała tabeli, komórka po komórce, w kolejności z DOM-u. */
function bodyRows(scope: HTMLElement = document.body) {
  const [, ...rows] = within(scope).getAllByRole('row');
  return rows.map((tr) => within(tr).getAllByRole('cell').map((cell) => cell.textContent));
}

/** Wiersz tabeli drużyny. */
const teamRow = (name: string) => screen.findByRole('row', { name: new RegExp(name) });

describe('Tabela', () => {
  it('nagłówek zdobyczy bierze się z tabeli, nie ze sportu turnieju', async () => {
    // Para rozjechana celowo: turniej jest piłkarski, a tabela mówi „Punkty".
    // Zgodna para przeszłaby też implementacji mapującej `sport.code` na
    // etykietę, a ADR-0006 mówi, że etykietę niesie odpowiedź tabeli.
    publicApi({ standings: [table({ scoreLabel: 'Punkty' })], stageMatches: SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument();
  });

  it('tabela bez allowsDraw nie ma kolumny R, choć sport turnieju zna remisy', async () => {
    publicApi({ standings: [table({ allowsDraw: false })], stageMatches: SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Pkt' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument();
  });

  it('tabela z allowsDraw ma kolumnę R, choć sport turnieju remisów nie zna', async () => {
    publicApi({ data: BASKETBALL, standings: [table({ allowsDraw: true })], stageMatches: SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'R' })).toBeInTheDocument();
  });

  it('zdanie pod tabelą idzie za tiebreakers z odpowiedzi i pomija points po kodzie, nie po etykiecie', async () => {
    // Koszykówka nie ma w ustawieniach „Bramki zdobyte”, a turniej nie zna
    // kolejności z odpowiedzi — przejdzie tylko widok, który czyta tabelę.
    // `points` ma tu etykietę inną niż „Punkty”, a „Punkty zdobyte” to inne
    // kryterium: zdanie, które odsiewa po etykiecie, pomyli się w obie strony.
    publicApi({
      data: BASKETBALL,
      standings: [
        table({
          tiebreakers: [
            { code: 'points', label: 'Liczba punktów' },
            { code: 'score_for', label: 'Punkty zdobyte' },
            { code: 'wins', label: 'Zwycięstwa' },
          ],
        }),
      ],
      stageMatches: SCHEDULE,
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(
      await screen.findByText(
        'Przy równej liczbie punktów: punkty zdobyte → zwycięstwa → nazwa drużyny (alfabetycznie).',
      ),
    ).toBeInTheDocument();
  });

  it('wiersze wychodzą w kolejności i z wartościami z API, pod nazwą fazy', async () => {
    // Kolejność rozstrzygają kryteria organizatora — widok ma jej nie poprawiać.
    // Para na górze ma równe punkty, a API stawia wyżej drużynę z gorszym
    // bilansem i dalszą w alfabecie.
    publicApi({
      standings: [
        table({
          stageName: 'Faza zasadnicza',
          rows: [
            row({ position: 1, team: { id: 2, name: 'Olimpia Park', logoUrl: null }, played: 6, won: 2, drawn: 1, lost: 3, scoreFor: 9, scoreAgainst: 8, scoreDifference: 1, points: 7 }),
            row({ position: 2, team: { id: 1, name: 'Dzielnica FC', logoUrl: null }, played: 3, won: 2, drawn: 1, lost: 0, scoreFor: 10, scoreAgainst: 5, scoreDifference: 5, points: 7 }),
          ],
        }),
      ],
      stageMatches: SCHEDULE,
    });
    renderAt(`/t/${SLUG}/tabela`);

    const region = await screen.findByRole('region', { name: 'Faza zasadnicza' });
    await teamRow('Dzielnica FC');
    const rows = bodyRows(region);
    expect(rows.map((cells) => cells[1])).toEqual([expect.stringContaining('Olimpia Park'), expect.stringContaining('Dzielnica FC')]);
    expect(rows[0]).toContain('9:8');
    expect(rows[0]).toContain('+1');
    expect(rows[1]).toContain('10:5');
  });

  it('forma z API trafia do wiersza w tej samej kolejności, najnowszy ostatni', async () => {
    publicApi({
      standings: [table({ rows: [row({ played: 4, won: 1, drawn: 1, lost: 2, form: ['loss', 'loss', 'draw', 'win'] })] })],
      stageMatches: SCHEDULE,
    });
    renderAt(`/t/${SLUG}/tabela`);

    const dzielnica = await teamRow('Dzielnica FC');
    expect(within(dzielnica).getByText('Forma: porażka, porażka, remis, zwycięstwo')).toBeInTheDocument();
  });

  it('turniej zakończony z ligą ma pas „Mistrz” z drużyną z pierwszego miejsca i jej punktami', async () => {
    publicApi({
      data: tournament({ status: 'finished' }),
      standings: [
        table({
          rows: [
            row({ position: 1, team: { id: 2, name: 'Olimpia Park', logoUrl: null }, points: 31 }),
            row({ position: 2, team: { id: 1, name: 'Dzielnica FC', logoUrl: null }, points: 29 }),
          ],
        }),
      ],
      stageMatches: [stageMatch(1, 1, { status: 'finished', homeScore: 1, awayScore: 0 })],
    });
    renderAt(`/t/${SLUG}/tabela`);

    const champion = await screen.findByRole('region', { name: 'Mistrz' });
    expect(within(champion).getByText('Olimpia Park')).toBeInTheDocument();
    expect(within(champion).getByText('31')).toBeInTheDocument();
    expect(within(champion).queryByText('Dzielnica FC')).not.toBeInTheDocument();
  });

  it('turniej w trakcie i turniej z grupami nie mają pasa „Mistrz”', async () => {
    publicApi({ standings: [table()], stageMatches: SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);
    await screen.findByRole('columnheader', { name: 'Pkt' });
    expect(screen.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument();
    cleanup();

    publicApi({
      data: groupsTournament({ status: 'finished' }),
      standings: [groupTable(1), groupTable(2)],
      stageMatches: [stageMatch(1, 1, { stageId: 3, groupId: 1, status: 'finished', homeScore: 1, awayScore: 0 })],
    });
    renderAt(`/t/${SLUG}/tabela`);
    await screen.findByRole('region', { name: 'Grupa A' });
    expect(screen.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument();
  });

  it('liga bez meczów w fazie ma pusty stan z odnośnikiem do Przeglądu zamiast tabeli zer', async () => {
    publicApi({ standings: [table({ rows: [row({ played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0, form: [] })] })], stageMatches: [] });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('heading', { name: 'Tabela ruszy z terminarzem' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' });
    expect(link).toHaveAttribute('href', `/t/${SLUG}`);

    await user.click(link);
    expect(router.state.location.pathname).toBe(`/t/${SLUG}`);
  });

  it('liga z ułożonym terminarzem bez wyników ma tabelę i datę startu', async () => {
    publicApi({
      standings: [table({ rows: [row({ played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0, form: [] })] })],
      stageMatches: [
        stageMatch(1, 1, { kickoffAt: '2026-09-12T08:00:00+00:00' }),
        stageMatch(2, 1, { kickoffAt: '2026-09-05T08:00:00+00:00' }),
        stageMatch(3, 2, { kickoffAt: null }),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Startuje 5 września')).toBeInTheDocument();
  });

  it('kolejka liczy się jako rozegrana dopiero, gdy skończył się jej ostatni mecz', async () => {
    publicApi({
      standings: [table()],
      stageMatches: [
        stageMatch(1, 1, { status: 'finished', homeScore: 1, awayScore: 0 }),
        stageMatch(2, 1, { status: 'finished', homeScore: 0, awayScore: 0 }),
        stageMatch(3, 2, { status: 'finished', homeScore: 3, awayScore: 1 }),
        stageMatch(4, 2, { status: 'live', homeScore: 0, awayScore: 0 }),
        stageMatch(5, 3),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    const fact = await screen.findByText((_, element) => element?.getAttribute('data-slot') === 'fact' && element.textContent === '1 z 3 kolejek rozegrane');
    expect(fact).toBeInTheDocument();
  });

  it('turniej zakończony ma fakt o wszystkich kolejkach i zakończonym sezonie', async () => {
    publicApi({
      data: tournament({ status: 'finished' }),
      standings: [table()],
      stageMatches: [
        stageMatch(1, 1, { status: 'finished', homeScore: 1, awayScore: 0 }),
        stageMatch(2, 2, { status: 'finished', homeScore: 0, awayScore: 0 }),
      ],
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(
      await screen.findByText((_, element) => element?.getAttribute('data-slot') === 'fact' && element.textContent === '2 kolejki rozegrane, sezon zakończony'),
    ).toBeInTheDocument();
  });
});

describe('Tabela: sport z setami (#301)', () => {
  const VOLLEYBALL = tournament({ name: 'Liga Siatkówki 2026', sport: { id: 3, code: 'volleyball', name: 'Siatkówka', allowsDraw: false } });

  it('pokazuje sety i kolumnę punktów w setach z etykietą z odpowiedzi', async () => {
    publicApi({
      data: VOLLEYBALL,
      standings: [
        table({
          scoreLabel: 'Sety',
          rallyPointsLabel: 'Punkty w setach',
          allowsDraw: false,
          rows: [row({ scoreFor: 6, scoreAgainst: 2, scoreDifference: 4, rallyPointsFor: 183, rallyPointsAgainst: 162, drawn: 0 })],
        }),
      ],
      stageMatches: SCHEDULE,
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Punkty w setach' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sety' })).toBeInTheDocument();
    expect(bodyRows()[0]).toEqual(expect.arrayContaining(['6:2', '183:162']));
  });

  it('w piłce kolumny punktów w setach nie ma', async () => {
    publicApi({ standings: [table()], stageMatches: SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('columnheader', { name: 'Pkt' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Punkty w setach' })).not.toBeInTheDocument();
  });
});
