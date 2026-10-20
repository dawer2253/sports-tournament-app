import type { Group, StandingTable, Team } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import { bracketDivergence, divergenceSentence, groupTeamsFromTables, seedingFromProposal } from './qualification';

const GROUP_A: Group = { id: 3, name: 'Grupa Północ', order: 1, qualifiers: 2 };
const GROUP_B: Group = { id: 4, name: 'Grupa Południe', order: 2, qualifiers: 1 };

function team(id: number, name: string, groupId: number | null): Team {
  return { id, tournamentId: 1, name, logoUrl: null, groupId, playersCount: 0, scheduledMatchesCount: 0 };
}

/** Tabela grupy z drużynami w kolejności miejsc. */
function table(group: Group, teams: Team[]): StandingTable {
  return {
    stageId: 1,
    stageName: 'Faza grupowa',
    groupId: group.id,
    groupName: group.name,
    scoreLabel: 'Bramki',
    rallyPointsLabel: null,
    allowsDraw: true,
    tiebreakers: [],
    rows: teams.map((candidate, index) => ({
      position: index + 1,
      team: { id: candidate.id, name: candidate.name, logoUrl: null },
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0,
      rallyPointsFor: null,
      rallyPointsAgainst: null,
      points: 0,
      form: [],
    })),
  };
}

const SOKOLY = team(1, 'Sokoły Ursus', GROUP_A.id);
const ORLY = team(2, 'Orły Wola', GROUP_A.id);
const RYSIE = team(3, 'Rysie Bielany', GROUP_A.id);
const WILKI = team(4, 'Wilki Bemowo', GROUP_B.id);
const LWY = team(5, 'Lwy Mokotów', GROUP_B.id);
const TABLES = [table(GROUP_A, [SOKOLY, ORLY, RYSIE]), table(GROUP_B, [WILKI, LWY])];

describe('seedingFromProposal', () => {
  it('składa pochodzenie z miejsca i litery grupy po order, a nie z nazwy', () => {
    const proposal = [
      { teamId: 1, groupId: 3, position: 1 },
      { teamId: 4, groupId: 4, position: 1 },
      { teamId: 2, groupId: 3, position: 2 },
    ];

    expect(seedingFromProposal(proposal, [SOKOLY, ORLY, RYSIE, WILKI, LWY], [GROUP_A, GROUP_B])).toEqual([
      { id: 1, name: 'Sokoły Ursus', origin: '1A', groupId: 3 },
      { id: 4, name: 'Wilki Bemowo', origin: '1B', groupId: 4 },
      { id: 2, name: 'Orły Wola', origin: '2A', groupId: 3 },
    ]);
  });
});

describe('groupTeamsFromTables', () => {
  it('oddaje wiersze tabel grup z pochodzeniem, w kolejności tabeli', () => {
    expect(groupTeamsFromTables(TABLES, [GROUP_A, GROUP_B]).map((candidate) => candidate.origin)).toEqual([
      '1A',
      '2A',
      '3A',
      '1B',
      '2B',
    ]);
  });

  it('pomija tabelę ligi', () => {
    expect(groupTeamsFromTables([{ ...TABLES[0]!, groupId: null }], [GROUP_A])).toEqual([]);
  });
});

describe('bracketDivergence', () => {
  it('nie widzi rozjazdu, gdy w drabince stoi czołówka każdej tabeli', () => {
    expect(bracketDivergence(new Set([1, 2, 4]), TABLES, [GROUP_A, GROUP_B])).toEqual([]);
  });

  it('opisuje 3. miejsce grające zamiast 2. z tej samej grupy', () => {
    const divergences = bracketDivergence(new Set([1, 3, 4]), TABLES, [GROUP_A, GROUP_B]);

    expect(divergences).toEqual([
      { group: GROUP_A, plays: [{ name: 'Rysie Bielany', position: 3 }], missing: [{ name: 'Orły Wola', position: 2 }] },
    ]);
    expect(divergenceSentence(divergences)).toBe(
      'Drabinka różni się od tabel grup: Rysie Bielany (3. w grupie A) zamiast Orły Wola (2. w grupie A).',
    );
  });

  it('opisuje osobno nadmiar i brak bez pary, np. po zmianie liczby wychodzących', () => {
    const divergences = bracketDivergence(new Set([1, 2, 4, 5]), TABLES, [GROUP_A, { ...GROUP_B, qualifiers: 1 }]);
    const fewer = bracketDivergence(new Set([1, 4]), TABLES, [GROUP_A, GROUP_B]);

    expect(divergenceSentence(divergences)).toBe(
      'Drabinka różni się od tabel grup: Lwy Mokotów (2. w grupie B) ponad liczbę wychodzących.',
    );
    expect(divergenceSentence(fewer)).toBe('Drabinka różni się od tabel grup: Orły Wola (2. w grupie A) poza drabinką.');
  });
});
