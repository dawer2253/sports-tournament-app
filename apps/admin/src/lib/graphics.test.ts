import type { AdminMatch, MatchEvent, SportEventType } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import {
  defaultPreviewMatch,
  defaultResultMatch,
  graphicKindReasons,
  matchScorers,
  previewMatches,
  readGraphicParams,
  resultMatches,
  standingsCaption,
  standingsWarning,
} from './graphics';

const WILKI = { id: 1, name: 'Wilki Bemowo', logoUrl: null };
const ORLY = { id: 2, name: 'Orły Bielany', logoUrl: null };

let nextId = 1;

function match(overrides: Partial<AdminMatch> & { order?: number } = {}): AdminMatch {
  const { order = 1, ...rest } = overrides;
  return {
    id: nextId++,
    stageId: 1,
    groupId: null,
    round: { id: order, name: `Kolejka ${order}`, order },
    matchNumber: 1,
    homeTeam: WILKI,
    awayTeam: ORLY,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    sets: null,
    status: 'scheduled',
    kickoffAt: '2026-10-04T10:00:00+00:00',
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    livePeriod: null,
    periodStartedAt: null,
    onBreak: false,
    collisions: [],
    ...rest,
  };
}

const finished = (overrides: Partial<AdminMatch> & { order?: number } = {}) =>
  match({ status: 'finished', homeScore: 1, awayScore: 0, ...overrides });

const NOW = new Date('2026-10-01T12:00:00+00:00');

describe('zapowiedź', () => {
  it('bierze tylko mecze zaplanowane z terminem i znanymi drużynami, także zaległe', () => {
    const overdue = match({ kickoffAt: '2026-09-20T10:00:00+00:00' });
    const upcoming = match({ kickoffAt: '2026-10-04T10:00:00+00:00' });
    const list = previewMatches([
      upcoming,
      overdue,
      match({ status: 'live' }),
      finished(),
      match({ kickoffAt: null }),
      match({ awayTeam: null }),
    ]);
    expect(list.map(({ id }) => id)).toEqual([overdue.id, upcoming.id]);
  });

  it('domyślnie wybiera najbliższy mecz od teraz, a nie zaległy', () => {
    const overdue = match({ kickoffAt: '2026-09-20T10:00:00+00:00' });
    const later = match({ kickoffAt: '2026-10-11T10:00:00+00:00' });
    const nearest = match({ kickoffAt: '2026-10-04T10:00:00+00:00' });
    expect(defaultPreviewMatch(previewMatches([later, overdue, nearest]), NOW)?.id).toBe(nearest.id);
  });

  it('bez nadchodzącego bierze najpóźniejszy zaległy', () => {
    const older = match({ kickoffAt: '2026-09-13T10:00:00+00:00' });
    const latest = match({ kickoffAt: '2026-09-20T10:00:00+00:00' });
    expect(defaultPreviewMatch(previewMatches([latest, older]), NOW)?.id).toBe(latest.id);
  });
});

describe('wynik', () => {
  it('bierze tylko zakończone, po terminie, a bez terminu po kolejce i numerze', () => {
    const late = finished({ kickoffAt: '2026-09-20T10:00:00+00:00', order: 2 });
    const early = finished({ kickoffAt: '2026-09-13T10:00:00+00:00', order: 1 });
    const undated = finished({ kickoffAt: null, order: 3 });
    const list = resultMatches([late, match(), undated, early, match({ status: 'live' })]);
    expect(list.map(({ id }) => id)).toEqual([early.id, late.id, undated.id]);
    expect(defaultResultMatch(list)?.id).toBe(undated.id);
  });
});

describe('podpis tabeli', () => {
  it('N to największa kolejka z kompletem zakończonych meczów, bez ostrzeżenia', () => {
    const caption = standingsCaption([finished({ order: 1 }), finished({ order: 2 }), match({ order: 3 })]);
    expect(caption).toEqual({ afterRound: 2, aheadMatches: 0, aheadRounds: [] });
    expect(standingsWarning(caption)).toBeNull();
  });

  it('ostrzega, gdy tabela obejmuje zakończony mecz z dalszej kolejki', () => {
    const caption = standingsCaption([
      finished({ order: 1 }),
      finished({ order: 2 }),
      match({ order: 2 }),
      finished({ order: 3 }),
      finished({ order: 3 }),
      match({ order: 3 }),
    ]);
    expect(caption).toEqual({ afterRound: 1, aheadMatches: 3, aheadRounds: [2, 3] });
    expect(standingsWarning(caption)).toBe(
      'Tabela obejmuje już 3 mecze kolejek 2 i 3, a grafika ma podpis „po kolejce 1”.',
    );
  });

  it('bez pełnej kolejki nie ma N, a ostrzeżenie mówi, że podpisu nie będzie', () => {
    const caption = standingsCaption([finished({ order: 1 }), match({ order: 1 })]);
    expect(caption.afterRound).toBeNull();
    expect(standingsWarning(caption)).toBe(
      'Żadna kolejka nie jest jeszcze zakończona w całości, więc grafika nie ma podpisu „po kolejce”. Tabela obejmuje 1 mecz kolejki 1.',
    );
  });
});

const FOOTBALL_TYPES: SportEventType[] = [
  { code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals' },
  { code: 'own_goal', label: 'Bramka samobójcza', hasPlayer: true, value: 1, stat: null },
  { code: 'yellow_card', label: 'Żółta kartka', hasPlayer: true, value: 1, stat: 'yellowCards' },
];

let eventId = 1;
function event(team: typeof WILKI, player: string, type: string, minute: number | null, addedTime: number | null = null): MatchEvent {
  return { id: eventId++, team, player: { id: eventId, name: player }, type, typeLabel: type, minute, addedTime };
}

describe('strzelcy', () => {
  const sport = { code: 'football' as const, eventTypes: FOOTBALL_TYPES, scoringStat: 'goals' };

  it('gol samobójczy liczy się po stronie rywala, kartka nie wchodzi, a minuta z doliczonym czasem', () => {
    const scorers = matchScorers(
      [
        event(WILKI, 'Marek Nowak', 'goal', 15),
        event(WILKI, 'Jakub Wrona', 'own_goal', 45, 2),
        event(ORLY, 'Rafał Duda', 'yellow_card', 50),
        event(ORLY, 'Rafał Duda', 'goal', null),
      ],
      WILKI.id,
      sport,
    );
    expect(scorers).toEqual({
      home: [{ player: 'Marek Nowak', minute: '15′', ownGoal: false }],
      away: [
        { player: 'Jakub Wrona', minute: '45+2′', ownGoal: true },
        { player: 'Rafał Duda', minute: null, ownGoal: false },
      ],
    });
  });

  it('trzyma najwyżej 6 strzelców na drużynę', () => {
    const goals = Array.from({ length: 8 }, (_, index) => event(WILKI, `Zawodnik ${index}`, 'goal', index + 1));
    expect(matchScorers(goals, WILKI.id, sport)!.home).toHaveLength(6);
  });

  it('poza piłką strzelców nie ma', () => {
    expect(matchScorers([event(WILKI, 'Oskar Dąb', 'three_pointer', 5)], WILKI.id, { ...sport, code: 'basketball' })).toBeNull();
  });
});

describe('rodzaje bez danych', () => {
  const base = {
    matches: [finished({ order: 1 }), match({ order: 2, kickoffAt: '2026-10-04T10:00:00+00:00' })],
    tablesCount: 1,
    leaderboard: { label: 'Bramki', rows: 1 },
  };

  it('wszystkie aktywne, gdy dane są', () => {
    expect(graphicKindReasons(base)).toEqual({ matchPreview: null, matchResult: null, standings: null, leaderboard: null });
  });

  it('każdy rodzaj ma własne wyjaśnienie', () => {
    expect(graphicKindReasons({ matches: [], tablesCount: 1, leaderboard: { label: 'Bramki', rows: 0 } })).toEqual({
      matchPreview: 'Brak meczu z terminem i znanymi drużynami, który można zapowiedzieć.',
      matchResult: 'Brak zakończonego meczu.',
      standings: 'Tabela nie ma jeszcze zakończonego meczu.',
      leaderboard: 'Klasyfikacja „Bramki” jest jeszcze pusta.',
    });
  });

  it('tabela grup jest nieaktywna, a turniej bez tabeli też', () => {
    expect(graphicKindReasons({ ...base, tablesCount: 2 }).standings).toBe(
      'Turniej ma kilka tabel grup, a grafika pokazuje jedną tabelę.',
    );
    expect(graphicKindReasons({ ...base, tablesCount: 0 }).standings).toBe('Turniej nie ma tabeli.');
  });
});

describe('adres', () => {
  const available = { matchPreview: null, matchResult: null, standings: 'powód', leaderboard: null };

  it('czyta rodzaj, mecz i format', () => {
    expect(readGraphicParams(new URLSearchParams('kind=matchResult&match=12&format=9:16'), available)).toEqual({
      kind: 'matchResult',
      matchId: 12,
      format: '9:16',
    });
  });

  it('błędne wartości i rodzaj nieaktywny wracają do domyślnych', () => {
    expect(readGraphicParams(new URLSearchParams('kind=coś&match=abc&format=1:1'), available)).toEqual({
      kind: 'matchPreview',
      matchId: null,
      format: '4:5',
    });
    expect(readGraphicParams(new URLSearchParams('kind=standings'), available).kind).toBe('matchPreview');
  });
});
