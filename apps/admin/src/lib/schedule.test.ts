import type { AdminMatch } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import { defaultRound, groupScheduleSize, roundRobinSize, scheduleRounds, teamsWithoutMatches } from './schedule';

function match(id: number, order: number, matchNumber: number, overrides: Partial<AdminMatch> = {}): AdminMatch {
  return {
    id,
    stageId: 1,
    groupId: null,
    round: { id: 100 + order, name: `Kolejka ${order}`, order },
    matchNumber,
    homeTeam: { id: 1, name: 'Wilki Bemowo', logoUrl: null },
    awayTeam: { id: 2, name: 'Sokoły Ursus', logoUrl: null },
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    kickoffAt: null,
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    collisions: [],
    ...overrides,
  };
}

describe('scheduleRounds', () => {
  // Numeracja z dziurą (po usuniętej drużynie, #161) nie może przesunąć
  // meczów: kolejność idzie po numerze, a nie po pozycji z numeru.
  it('składa kolejki z meczów po order i matchNumber, także z dziurą w numeracji', () => {
    const rounds = scheduleRounds([match(3, 2, 1), match(2, 1, 4), match(1, 1, 1)]);

    expect(rounds.map((round) => round.name)).toEqual(['Kolejka 1', 'Kolejka 2']);
    expect(rounds[0]!.matches.map((m) => m.id)).toEqual([1, 2]);
  });

  it('liczy „zakończone/wszystkie” i zakres dat kolejki', () => {
    const [round] = scheduleRounds(
      [
        match(1, 1, 1, { status: 'finished', homeScore: 1, awayScore: 0, kickoffAt: '2026-09-05T08:00:00+00:00' }),
        match(2, 1, 2, { status: 'live', homeScore: 0, awayScore: 0, kickoffAt: '2026-09-06T08:00:00+00:00' }),
      ],
      'Europe/Warsaw',
    );

    expect(round!.summary).toEqual({
      id: 101,
      name: 'Kolejka 1',
      dates: 'sob., 5 wrz – niedz., 6 wrz',
      finished: 1,
      total: 2,
      collisions: 0,
    });
  });

  it('liczy mecze z kolizją w kolejce (#175)', () => {
    const [round] = scheduleRounds([
      match(1, 1, 1, { collisions: [{ type: 'venue', matchId: 2 }] }),
      match(2, 1, 2, { collisions: [{ type: 'venue', matchId: 1 }] }),
      match(3, 1, 3),
    ]);

    expect(round!.summary.collisions).toBe(2);
  });
});

describe('defaultRound', () => {
  it('wybiera pierwszą kolejkę z meczem innym niż finished', () => {
    const rounds = scheduleRounds([
      match(1, 1, 1, { status: 'finished', homeScore: 1, awayScore: 0 }),
      match(2, 2, 1, { status: 'live', homeScore: 0, awayScore: 0 }),
      match(3, 3, 1),
    ]);

    expect(defaultRound(rounds)?.order).toBe(2);
  });

  it('po zakończonym sezonie wybiera ostatnią kolejkę', () => {
    const rounds = scheduleRounds([
      match(1, 1, 1, { status: 'finished', homeScore: 1, awayScore: 0 }),
      match(2, 2, 1, { status: 'finished', homeScore: 2, awayScore: 2 }),
    ]);

    expect(defaultRound(rounds)?.order).toBe(2);
  });
});

describe('teamsWithoutMatches', () => {
  const teams = [
    { id: 1, name: 'Wilki Bemowo' },
    { id: 2, name: 'Sokoły Ursus' },
    { id: 3, name: 'Orły Bielany' },
  ];

  it('zwraca drużyny, które nie grają w żadnym meczu, jako gospodarz ani gość', () => {
    expect(teamsWithoutMatches(teams, [match(1, 1, 1)]).map((team) => team.name)).toEqual(['Orły Bielany']);
  });

  it('bez terminarza nie zgłasza nikogo: to inny stan ekranu', () => {
    expect(teamsWithoutMatches(teams, [])).toEqual([]);
  });
});

describe('roundRobinSize', () => {
  it.each([
    [20, 1, 19, 190],
    [20, 2, 38, 380],
    [5, 1, 5, 10],
    [5, 2, 10, 20],
    [2, 2, 2, 2],
  ] as const)('%i drużyn, %i spotkania: %i kolejek, %i meczów', (teams, meetings, roundsCount, matchesCount) => {
    expect(roundRobinSize(teams, meetings)).toEqual({ roundsCount, matchesCount });
  });
});

describe('groupScheduleSize', () => {
  // Kolejki to najdłuższa grupa, mecze to suma par w grupach (#258).
  it.each([
    [[4, 4], 1, 3, 12],
    [[4, 4], 2, 6, 24],
    [[5, 4], 1, 5, 16],
    [[3, 2], 1, 3, 4],
    [[4], 2, 6, 12],
    // Grupa z jedyną żywą drużyną nie daje ani kolejki, ani meczu.
    [[1, 4], 1, 3, 6],
    [[], 1, 0, 0],
  ] as const)('grupy %j, %i spotkania: %i kolejek, %i meczów', (sizes, meetings, roundsCount, matchesCount) => {
    expect(groupScheduleSize([...sizes], meetings)).toEqual({ roundsCount, matchesCount });
  });
});
