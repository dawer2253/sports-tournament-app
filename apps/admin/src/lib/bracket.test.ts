import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdminMatch } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import { advanceNote } from './bracket';

/**
 * `message` przykładu `blokadaAwansu` z `PATCH /matches/{match}`. Panel nie ma
 * parsera YAML, a przykład to jedna linia w apostrofach, więc wystarczy tekst.
 */
function contractBlockMessage(): string {
  const spec = readFileSync(resolve(import.meta.dirname, '../../../../packages/api-contract/openapi.yaml'), 'utf8');
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'blokadaAwansu:');
  const message = lines.slice(start).find((line) => line.trimStart().startsWith('message: '));
  expect(start, 'przykład blokadaAwansu w openapi.yaml').toBeGreaterThan(-1);
  return message!.trim().replace(/^message: '(.*)'$/, '$1').replaceAll("''", "'");
}

const team = (id: number, name: string) => ({ id, name, logoUrl: null });

function match(id: number, round: AdminMatch['round'], matchNumber: number, overrides: Partial<AdminMatch>): AdminMatch {
  return {
    id,
    stageId: 1,
    groupId: null,
    round,
    matchNumber,
    homeTeam: null,
    awayTeam: null,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    sets: null,
    status: 'scheduled',
    kickoffAt: null,
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
    livePeriod: null,
    periodStartedAt: null,
    onBreak: false,
    collisions: [],
    ...overrides,
  };
}

describe('advanceNote', () => {
  /**
   * Treść blokady stoi w dwóch miejscach: tu i w backendzie
   * (`App\Matches\Advancement`), bo panel ostrzega przed zapisem. Obie strony
   * porównują ją z przykładem z kontraktu, więc rozjazd zapali test po tej
   * stronie, która odjechała.
   */
  it('ostrzeżenie o blokadzie brzmi jak przykład blokadaAwansu z kontraktu', () => {
    const semis = { id: 1, name: 'Półfinał', order: 1 };
    const finals = { id: 2, name: 'Finał', order: 2 };
    // Te same drużyny co w przykładzie: finał Wilki Bemowo – Orły Bielany, o 3. miejsce Rysie Wola – Żubry Praga.
    const semi = match(11, semis, 1, {
      homeTeam: team(1, 'Wilki Bemowo'),
      awayTeam: team(4, 'Rysie Wola'),
      status: 'finished',
      homeScore: 2,
      awayScore: 0,
      winnerToMatchId: 21,
      loserToMatchId: 22,
      advancesToSlot: 'home',
    });
    const matches = [
      semi,
      match(21, finals, 1, { homeTeam: team(1, 'Wilki Bemowo'), awayTeam: team(2, 'Orły Bielany'), status: 'live', homeScore: 0, awayScore: 0 }),
      match(22, finals, 2, { homeTeam: team(4, 'Rysie Wola'), awayTeam: team(3, 'Żubry Praga'), status: 'live', homeScore: 0, awayScore: 0 }),
    ];

    const note = advanceNote(semi, { ...semi, homeScore: 0, awayScore: 2 }, matches);

    expect(note).toEqual({ tone: 'block', lines: [contractBlockMessage()] });
  });
});
