import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_ERROR,
  SLUG,
  asPublic,
  cup,
  cupMatches,
  finished,
  groupMatch,
  groupTable,
  groupsTournament,
  leaderRow,
  leaderboard,
  match,
  playoffMatches,
  publicApi,
  renderAt,
  row,
  table,
  tournament,
} from '../test/public-api';

/** Przegląd w nowym wyglądzie (#296, DoD „Vitest (`apps/public`)”). */

/** Pas etapu: region nazwany nazwą kolejki albo rundy. */
const band = (name: string) => screen.findByRole('region', { name });

/** Nazwy par tablic pasa etapu w kolejności z DOM-u. */
function boards() {
  return [...document.querySelectorAll('[data-slot="stage-board"]')].map((board) => board.getAttribute('aria-label'));
}

/** Fakty nagłówka pasa, bez wiodących spacji. */
function facts() {
  return [...document.querySelectorAll('[data-slot="stage-band"] [data-slot="fact"]')].map((fact) => fact.textContent?.trim());
}

/** Wiersze ciała tabeli w regionie: czy wiersz jest nad linią wyjścia. */
function qualifying(region: HTMLElement) {
  return within(region)
    .getAllByRole('row')
    .slice(1)
    .map((tableRow) => within(tableRow).queryByText(', wychodzi z grupy') !== null);
}

/** Nazwy kafli prezentacji drużyn w kolejności z DOM-u. */
function showcase() {
  return [...document.querySelectorAll('[data-slot="showcase-team-name"]')].map((name) => name.textContent);
}

const TEAMS = [
  { id: 3, name: 'Orły', logoUrl: null },
  { id: 2, name: 'Łosie', logoUrl: null },
  { id: 1, name: 'Lwy', logoUrl: null },
];

describe('Przegląd: pas etapu', () => {
  it('dostaje kolejkę Terminarza, a nie tę z najwcześniejszym terminem, z meczami z /results i /fixtures razem', async () => {
    // Kolejka 3 ma najwcześniejszy termin, ale Terminarz otwiera się na kolejce 2.
    publicApi({
      results: [finished(2, 2), finished(1, 1)],
      fixtures: [
        match(5, 3, { kickoffAt: '2026-10-11T10:00:00+00:00' }),
        match(3, 2, { status: 'live', homeScore: 0, awayScore: 0 }),
        match(4, 2),
      ],
    });
    renderAt(`/t/${SLUG}`);

    const region = within(await band('Kolejka 2'));
    expect(region.getByText('Bieżąca kolejka')).toBeInTheDocument();
    expect(boards()).toEqual(['Gospodarz 2 – Gość 2', 'Gospodarz 3 – Gość 3', 'Gospodarz 4 – Gość 4']);
    expect(facts()).toEqual([expect.any(String), '1 z 3 rozegrane', 'z 3 kolejek']);
    // Obok następna kolejka Terminarza.
    expect(screen.getByRole('region', { name: 'Kolejka 3' })).toBeInTheDocument();
  });

  it('przed startem to 1. kolejka, a w tabeli termin pierwszego meczu', async () => {
    publicApi({ fixtures: [match(1, 1), match(2, 1), match(3, 2, { kickoffAt: '2026-10-25T10:00:00+00:00' })] });
    renderAt(`/t/${SLUG}`);

    expect(within(await band('Kolejka 1')).getByText('Pierwsza kolejka')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Tabela' })).getByText(/^Startuje /)).toBeInTheDocument();
  });

  it('w turnieju finished to ostatnia kolejka, bez następnej', async () => {
    publicApi({ data: tournament({ status: 'finished' }), results: [finished(3, 3), finished(2, 2), finished(1, 1)] });
    renderAt(`/t/${SLUG}`);

    expect(within(await band('Kolejka 3')).getByText('Ostatnia kolejka')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="next-match"]')).toBeNull();
  });

  it('tablica prowadzi na stronę meczu, a klik z modyfikatorem zostaje przeglądarce', async () => {
    publicApi({ fixtures: [match(7, 1)] });
    const { router } = renderAt(`/t/${SLUG}`);

    await band('Kolejka 1');
    const board = screen.getByRole('link', { name: 'Gospodarz 7 – Gość 7' });
    expect(board).toHaveAttribute('href', `/t/${SLUG}/mecze/7`);

    fireEvent.click(board, { ctrlKey: true });
    expect(router.state.location.pathname).toBe(`/t/${SLUG}`);

    fireEvent.click(board);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/t/${SLUG}/mecze/7`));
  });
});

describe('Przegląd: w miejscu tabeli', () => {
  it('liga: pełna tabela z formą, bez pasa „Mistrz” przy turnieju active', async () => {
    publicApi({ fixtures: [match(1, 1)], standings: [table({ rows: [row(), row({ position: 2, team: { id: 2, name: 'Druga', logoUrl: null } })] })] });
    renderAt(`/t/${SLUG}`);

    const main = within(await screen.findByRole('region', { name: 'Tabela' }));
    expect(await main.findByRole('columnheader', { name: 'Forma' })).toBeInTheDocument();
    expect(main.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument();
  });

  it('liga: „Mistrz” to 1. miejsce tabeli, gdy turniej jest finished', async () => {
    publicApi({
      data: tournament({ status: 'finished' }),
      results: [finished(1, 1)],
      standings: [table({ rows: [row({ position: 1, team: { id: 9, name: 'Zwycięzcy FC', logoUrl: null } }), row({ position: 2 })] })],
    });
    renderAt(`/t/${SLUG}`);

    expect(await screen.findByRole('region', { name: 'Mistrz' })).toHaveTextContent('Zwycięzcy FC');
  });

  it('puchar nie pyta o /standings; pas to runda z kompletem jej meczów, a w miejscu tabeli drabinka', async () => {
    const matches = cupMatches({ teams: 4, progress: { round: 1, finished: 1 } });
    const requests = publicApi({
      data: cup(),
      stageMatches: matches,
      results: matches.filter((candidate) => candidate.status === 'finished').map(asPublic),
      fixtures: matches.filter((candidate) => candidate.status !== 'finished').map(asPublic),
    });
    renderAt(`/t/${SLUG}`);

    expect(within(await band('Półfinał')).getByText('Bieżąca runda')).toBeInTheDocument();
    expect(boards()).toHaveLength(2);
    expect(await screen.findByRole('region', { name: 'Drabinka' })).toBeInTheDocument();
    // Obok mecze następnej rundy: finał i mecz o 3. miejsce z pustymi slotami.
    expect(within(screen.getByRole('region', { name: 'Najbliższe mecze' })).getAllByRole('link', { name: / – / })).toHaveLength(2);
    expect(requests.standings).toBe(0);
  });

  it('puchar: „Mistrz” po finale rozstrzygniętym karnymi to drużyna z wyższymi karnymi', async () => {
    const matches = cupMatches({ teams: 4, progress: 'done', thirdPlace: false }, { 2001: { homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 5 } });
    const final = matches.find((candidate) => candidate.id === 2001)!;
    publicApi({ data: cup({ status: 'finished' }), stageMatches: matches, results: matches.map(asPublic) });
    renderAt(`/t/${SLUG}`);

    expect(await screen.findByRole('region', { name: 'Mistrz' })).toHaveTextContent(final.awayTeam!.name);
  });

  it('grupy w fazie grupowej dostają wszystkie grupy z qualifiers po groupId', async () => {
    const data = groupsTournament();
    // Grupa B: wychodzi jedna, więc linia stoi po pierwszym miejscu.
    data.stages[0]!.groups[1]!.qualifiers = 1;
    publicApi({ data, standings: [groupTable(2), groupTable(1)], fixtures: [groupMatch(1, 1, 1), groupMatch(2, 2, 1)] });
    renderAt(`/t/${SLUG}`);

    const main = within(await screen.findByRole('region', { name: 'Tabele grup' }));
    const a = await main.findByRole('region', { name: 'Grupa A' });
    const b = main.getByRole('region', { name: 'Grupa B' });
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(qualifying(a)).toEqual([true, true, false, false]);
    expect(qualifying(b)).toEqual([true, false, false, false]);
    expect(screen.queryByRole('region', { name: 'Drabinka' })).not.toBeInTheDocument();
  });

  it('grupy po wygenerowaniu drabinki: drabinka i odnośnik do tabel grup zamiast tabel, a w pasie runda playoffu', async () => {
    const playoff = playoffMatches();
    publicApi({
      data: groupsTournament(),
      standings: [groupTable(1), groupTable(2)],
      stageMatches: playoff,
      results: [groupMatch(1, 1, 3, { status: 'finished', homeScore: 1, awayScore: 0 })],
      fixtures: playoff.map(asPublic),
    });
    renderAt(`/t/${SLUG}`);

    expect(await band('Półfinał')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Drabinka' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tabele grup' })).toHaveAttribute('href', `/t/${SLUG}/tabela`);
    expect(screen.queryByRole('region', { name: 'Grupa A' })).not.toBeInTheDocument();
  });
});

describe('Przegląd: stan „Bez terminarza”', () => {
  it('liga: drużyny idą z /teams, nie z wierszy /standings, alfabetycznie po polsku', async () => {
    const requests = publicApi({ teams: TEAMS, standings: [table({ rows: [row({ team: { id: 9, name: 'Z tabeli', logoUrl: null } })] })] });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Drużyny' });
    await waitFor(() => expect(showcase()).toEqual(['Lwy', 'Łosie', 'Orły']));
    expect(screen.queryByText('Z tabeli')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(requests.teams).toBeGreaterThan(0);
  });

  it('puchar bez drabinki pokazuje drużyny z /teams', async () => {
    publicApi({ data: cup(), teams: TEAMS });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Drużyny' });
    await waitFor(() => expect(showcase()).toEqual(['Lwy', 'Łosie', 'Orły']));
  });

  it('grupy bez kolejek pokazują drużyny z /teams, także bez grupy', async () => {
    publicApi({ data: groupsTournament(), teams: TEAMS, standings: [groupTable(1), groupTable(2)] });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Drużyny' });
    await waitFor(() => expect(showcase()).toEqual(['Lwy', 'Łosie', 'Orły']));
    expect(screen.queryByRole('region', { name: 'Grupa A' })).not.toBeInTheDocument();
  });

  it('liga z terminarzem nie pyta o /teams', async () => {
    const requests = publicApi({ fixtures: [match(1, 1)] });
    renderAt(`/t/${SLUG}`);

    await band('Kolejka 1');
    expect(requests.teams).toBe(0);
  });

  it('puchar z drabinką nie pyta o /teams', async () => {
    const matches = cupMatches({ teams: 4 });
    const requests = publicApi({ data: cup(), stageMatches: matches, fixtures: matches.map(asPublic) });
    renderAt(`/t/${SLUG}`);

    await band('Półfinał');
    expect(requests.teams).toBe(0);
  });
});

describe('Przegląd: sekcje niezależne', () => {
  it('błąd klasyfikacji nie zdejmuje pasa ani tabeli, a sekcja ma ponowienie', async () => {
    publicApi({ fixtures: [match(1, 1)], leaderboards: () => LEADERBOARD_ERROR });
    renderAt(`/t/${SLUG}`);

    const leader = within(await screen.findByRole('region', { name: 'Klasyfikacja' }));
    expect(await leader.findByRole('alert')).toHaveTextContent('Nie udało się wczytać klasyfikacji');
    expect(leader.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kolejka 1' })).toBeInTheDocument();
    expect(await within(screen.getByRole('region', { name: 'Tabela' })).findByRole('table')).toBeInTheDocument();
  });

  it('lider klasyfikacji domyślnej statystyki: tytuł z odpowiedzi i odnośnik do Statystyk', async () => {
    const requests = publicApi({ fixtures: [match(1, 1)], leaderboards: () => leaderboard({ label: 'Punkty', rows: [leaderRow(1, { value: 57 })] }) });
    renderAt(`/t/${SLUG}`);

    const leader = within(await screen.findByRole('region', { name: 'Punkty' }));
    expect(leader.getByText('Zawodnik 1')).toBeInTheDocument();
    expect(leader.getByRole('link', { name: 'Statystyki' })).toHaveAttribute('href', `/t/${SLUG}/statystyki`);
    expect(requests.leaderboard).toEqual([null]);
  });
});
