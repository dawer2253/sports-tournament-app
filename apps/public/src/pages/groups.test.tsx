import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  GROUP_STAGE_ID,
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
  stageMatch,
  table,
} from '../test/public-api';

/** Turniej z grupami i playoffem na stronie publicznej (#268, wariant A z #252). */

const tabs = () => within(screen.getByRole('navigation', { name: 'Sekcje turnieju' }));

/** Terminarz fazy grupowej: po jednym zakończonym meczu w obu grupach. */
const GROUP_SCHEDULE = [1, 2].map((groupId) =>
  stageMatch(groupId, 1, { stageId: GROUP_STAGE_ID, groupId, status: 'finished', homeScore: 1, awayScore: 0 }),
);

/**
 * Pozycja linii wyjścia w regionie grupy: ile wierszy ciała stoi nad nią,
 * `null` bez linii.
 */
function lineAfter(region: HTMLElement) {
  const rows = within(region).getAllByRole('row').slice(1);
  const index = rows.findIndex((row) => within(row).queryByText('wyjście z grupy') !== null);
  return index === -1 ? null : index;
}

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
  it('rysuje każdą grupę z linią wyjścia po qualifiers miejscach i jedno zdanie o kolejności pod obiema', async () => {
    publicApi({
      data: groupsTournament(),
      // Grupa B przychodzi pierwsza: kolejność daje `Group.order`, nie odpowiedź.
      standings: [groupTable(2), groupTable(1)],
      stageMatches: GROUP_SCHEDULE,
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
    // Linia stoi nad pierwszym niewychodzącym, czyli pod drugim wierszem.
    expect(lineAfter(a)).toBe(2);
    expect(lineAfter(b)).toBe(2);
    expect(screen.getAllByText(/^Przy równej liczbie punktów:/)).toHaveLength(1);
    expect(screen.queryByText(/^Z grupy wychodz/)).not.toBeInTheDocument();
  });

  it('liczba wychodzących idzie z grupy turnieju, po groupId tabeli', async () => {
    const data = groupsTournament();
    data.stages[0]!.groups[1]!.qualifiers = 1;
    publicApi({ data, standings: [groupTable(1), groupTable(2)], stageMatches: GROUP_SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    const b = await screen.findByRole('region', { name: 'Grupa B' });
    expect(qualifying(b)).toEqual([true, false, false, false]);
    expect(lineAfter(b)).toBe(1);
    expect(lineAfter(screen.getByRole('region', { name: 'Grupa A' }))).toBe(2);
  });

  it('tabela grupy, której turniej jeszcze nie zna, stoi bez linii zamiast zniknąć', async () => {
    // Nowy skład zapisany między odpytaniami: tabele już z nową grupą, turniej jeszcze ze starą.
    publicApi({
      data: groupsTournament(),
      standings: [groupTable(1), { ...groupTable(2), groupId: 9, groupName: 'Grupa C' }],
      stageMatches: GROUP_SCHEDULE,
    });
    renderAt(`/t/${SLUG}/tabela`);

    const c = await screen.findByRole('region', { name: 'Grupa C' });
    expect(qualifying(c)).toEqual([false, false, false, false]);
    expect(lineAfter(c)).toBeNull();
    expect(qualifying(screen.getByRole('region', { name: 'Grupa A' }))).toEqual([true, true, false, false]);
  });

  it('liga nie ma linii wyjścia', async () => {
    publicApi({ standings: [table()], stageMatches: [stageMatch(1, 1)] });
    renderAt(`/t/${SLUG}/tabela`);

    await screen.findByRole('columnheader', { name: 'Pkt' });
    expect(screen.queryByText(', wychodzi z grupy')).not.toBeInTheDocument();
    expect(screen.queryByText('wyjście z grupy')).not.toBeInTheDocument();
  });

  it('przed drabinką mówi, kiedy powstanie, a po jej wygenerowaniu prowadzi do niej', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: GROUP_SCHEDULE });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByText('Drabinka playoffu powstanie po fazie grupowej')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Drabinka playoffu' })).not.toBeInTheDocument();
    cleanup();

    publicApi({
      data: groupsTournament(),
      standings: [groupTable(1), groupTable(2)],
      stageMatches: [...GROUP_SCHEDULE, ...playoffMatches()],
    });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('link', { name: 'Drabinka playoffu' })).toHaveAttribute('href', `/t/${SLUG}/drabinka`);
  });

  it('faza grupowa bez składu ma pusty stan „Grupy jeszcze nie są ułożone”', async () => {
    publicApi({ data: groupsTournament(), standings: [], stageMatches: [] });
    renderAt(`/t/${SLUG}/tabela`);

    expect(await screen.findByRole('heading', { name: 'Grupy jeszcze nie są ułożone' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
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
  it('przed wygenerowaniem ma pusty stan z odnośnikiem do Tabeli', async () => {
    publicApi({ data: groupsTournament(), standings: [groupTable(1), groupTable(2)], stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByText('Drabinki jeszcze nie ma')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przejdź do tabeli' })).toHaveAttribute('href', `/t/${SLUG}/tabela`);
  });

  it('w samym pucharze pusty stan zostaje bez odnośnika', async () => {
    publicApi({ data: cup(), stageMatches: [] });
    renderAt(`/t/${SLUG}/drabinka`);

    expect(await screen.findByText('Drabinki jeszcze nie ma')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Przejdź do tabeli' })).not.toBeInTheDocument();
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
