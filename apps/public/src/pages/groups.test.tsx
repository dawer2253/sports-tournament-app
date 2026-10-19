import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  GROUP_TEAMS,
  SLUG,
  asPublic,
  cup,
  groupMatch,
  groupTable,
  groupsTournament,
  playoffMatches,
  publicApi,
  renderAt,
  table,
} from '../test/public-api';

/** Turniej z grupami i playoffem na stronie publicznej (#268, wariant A z #252). */

const tabs = () => within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));

const QUALIFIERS_SENTENCE = 'Z grupy wychodzą 2 drużyny — miejsca nad przerywaną linią. Remis na linii rozstrzyga organizer.';

/** Wiersze ciała tabeli w regionie: czy wiersz jest nad linią wyjścia. */
function qualifying(region: HTMLElement) {
  return within(region)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryByText(', wychodzi z grupy') !== null);
}

/** Etykiety w linii terminu wierszy meczów, w kolejności z DOM-u. */
function rowLabels() {
  return [...document.querySelectorAll('[data-slot="match-row"]')].map(
    (row) => row.querySelector('[data-slot="match-label"]')?.textContent ?? null,
  );
}

describe('zakładki turnieju z grupami', () => {
  it('faza grupowa daje sześć zakładek: Tabelę i Drabinkę naraz', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)] });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('region', { name: 'Tabele grup (skrót)' });
    expect(tabs().getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Przegląd',
      'Tabela',
      'Drabinka',
      'Terminarz',
      'Wyniki',
      'Statystyki',
    ]);
  });
});

describe('Tabela turnieju z grupami', () => {
  it('rysuje każdą grupę z linią wyjścia po qualifiers miejscach i zdaniem o wychodzących', async () => {
    publicApi({
      data: groupsTournament(),
      // Grupa B przychodzi pierwsza: kolejność daje `Group.order`, nie odpowiedź.
      standings: [groupTable(2), groupTable(1)],
    });
    renderAt(`/t/${SLUG}/tabela`);

    const a = await screen.findByRole('region', { name: 'Grupa A' });
    const b = screen.getByRole('region', { name: 'Grupa B' });
    expect(screen.getAllByRole('heading', { name: /^Grupa/ }).map((heading) => heading.textContent)).toEqual([
      'Grupa A',
      'Grupa B',
    ]);
    expect(qualifying(a)).toEqual([true, true, false, false]);
    expect(qualifying(b)).toEqual([true, true, false, false]);
    expect(within(a).getByText(QUALIFIERS_SENTENCE)).toBeInTheDocument();
    expect(within(b).getByText(QUALIFIERS_SENTENCE)).toBeInTheDocument();
  });

  it('liczba wychodzących idzie z grupy turnieju, po groupId tabeli', async () => {
    const data = groupsTournament();
    data.stages[0]!.groups[1]!.qualifiers = 1;
    publicApi({ data, standings: [groupTable(1), groupTable(2)] });
    renderAt(`/t/${SLUG}/tabela`);

    const b = await screen.findByRole('region', { name: 'Grupa B' });
    expect(qualifying(b)).toEqual([true, false, false, false]);
    expect(
      within(b).getByText('Z grupy wychodzi 1 drużyna — miejsca nad przerywaną linią. Remis na linii rozstrzyga organizer.'),
    ).toBeInTheDocument();
  });

  it('tabela grupy, której turniej jeszcze nie zna, stoi bez linii zamiast zniknąć', async () => {
    // Nowy skład zapisany między odpytaniami: tabele już z nową grupą, turniej jeszcze ze starą.
    publicApi({ data: groupsTournament(), standings: [groupTable(1), { ...groupTable(2), groupId: 9, groupName: 'Grupa C' }] });
    renderAt(`/t/${SLUG}/tabela`);

    const c = await screen.findByRole('region', { name: 'Grupa C' });
    expect(qualifying(c)).toEqual([false, false, false, false]);
    expect(qualifying(screen.getByRole('region', { name: 'Grupa A' }))).toEqual([true, true, false, false]);
  });

  it('liga nie ma linii wyjścia ani zdania o wychodzących', async () => {
    publicApi({ standings: [table()] });
    renderAt(`/t/${SLUG}/tabela`);

    await screen.findByRole('columnheader', { name: 'Pkt' });
    expect(screen.queryByText(', wychodzi z grupy')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Z grupy/)).not.toBeInTheDocument();
  });
});

describe('Przegląd turnieju z grupami', () => {
  it('ma skrót wszystkich grup z linią wyjścia, a przed wygenerowaniem drabinki nie ma karty „Drabinka”', async () => {
    const requests = publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: [] });
    renderAt(`/t/${SLUG}`);

    const snippet = await screen.findByRole('region', { name: 'Tabele grup (skrót)' });
    const a = within(snippet).getByRole('region', { name: 'Grupa A' });
    const b = within(snippet).getByRole('region', { name: 'Grupa B' });
    expect(qualifying(a)).toEqual([true, true, false, false]);
    expect(within(b).getByText('Wychodzą 2 z 4')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tabela (skrót)' })).not.toBeInTheDocument();
    expect(requests.stageMatches).toContain(String(4));
    expect(screen.queryByRole('region', { name: 'Drabinka' })).not.toBeInTheDocument();
  });

  it('po wygenerowaniu drabinki ma kartę „Drabinka” nad skrótem tabel grup', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: playoffMatches() });
    renderAt(`/t/${SLUG}`);

    const bracket = await screen.findByRole('region', { name: 'Drabinka' });
    const groups = screen.getByRole('region', { name: 'Tabele grup (skrót)' });
    expect(bracket.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Drabinka turnieju z grupami', () => {
  it('przed wygenerowaniem ma pusty stan z odnośnikiem do tabel grup i liczbą wychodzących z grup', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('heading', { name: 'Drabinka powstanie po fazie grupowej' })).toBeInTheDocument();
    expect(screen.getByText('Playoff')).toBeInTheDocument();
    expect(screen.getByText(/^Z każdej grupy wychodzą 2 drużyny\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz tabele grup' })).toHaveAttribute('href', `/t/${SLUG}/tabela`);
  });

  it('liczba wychodzących idzie z qualifiers grup, a nie jest wpisana na sztywno', async () => {
    const data = groupsTournament();
    data.stages[0]!.groups[1]!.qualifiers = 1;
    publicApi({ data, standings: [groupTable(1), groupTable(2)], stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByText(/^Z grup wychodzą łącznie 3 drużyny\./)).toBeInTheDocument();
  });

  it('w samym pucharze pusty stan prowadzi na Przegląd, nie do tabel grup', async () => {
    publicApi({ data: cup(), stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('heading', { name: 'Drabinka jeszcze nie jest ułożona' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zobacz tabele grup' })).not.toBeInTheDocument();
  });

  it('po wygenerowaniu z czołówki tabel ma drzewo bez notki o rozjeździe', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: playoffMatches() });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByRole('group', { name: 'Rundy' })).toBeInTheDocument();
    expect(screen.queryByText(/Drabinka różni się od dzisiejszych tabel grup/)).not.toBeInTheDocument();
  });

  it('notka o rozjeździe: drużyna z drabinki stoi dziś pod linią, a nad nią stoi inna', async () => {
    // W Grupie A Orły wyprzedziły Wilki, które grają w drabince jako 2A.
    publicApi({ data: groupsTournament(), standings: [groupTable(1, [0, 2, 1, 3]), groupTable(2)], stageMatches: playoffMatches() });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(
      await screen.findByText(
        'Drabinka różni się od dzisiejszych tabel grup: w drabince gra Wilki Bemowo, a w tabeli grupy nad linią stoi dziś Orły Bielany.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rundy' })).toBeInTheDocument();
  });
});

describe('Terminarz i Wyniki turnieju z grupami', () => {
  it('mecz grupy niesie nazwę grupy, a mecz playoffu etykietę pozycji', async () => {
    const playoff = playoffMatches();
    publicApi({
      data: groupsTournament(),
      fixtures: [groupMatch(11, 1, 3), groupMatch(12, 2, 3), ...playoff.filter((match) => match.round.order === 1).map(asPublic)],
      stageMatches: playoff,
    });
    renderAt(`/t/${SLUG}/terminarz`);

    // Etykiety pozycji liczą się z kompletu meczów fazy, który dochodzi osobno.
    await waitFor(() => expect(rowLabels()).toEqual(['Grupa A', 'Grupa B', 'Półfinał 1', 'Półfinał 2']));
  });

  it('Wyniki: mecz grupy z nazwą grupy', async () => {
    publicApi({ data: groupsTournament(), results: [groupMatch(21, 2, 1, { status: 'finished', homeScore: 1, awayScore: 0 })] });
    renderAt(`/t/${SLUG}/wyniki`);

    await screen.findByRole('link', { name: `${GROUP_TEAMS[2][0].name} – ${GROUP_TEAMS[2][1].name}` });
    expect(rowLabels()).toEqual(['Grupa B']);
  });
});
