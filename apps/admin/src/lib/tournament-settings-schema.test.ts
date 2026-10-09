import type { Tournament } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import { tournamentSettingsUpdate, tournamentSettingsValues, tournamentSettingsSchema } from './tournament-settings-schema';

const SAVED: Tournament = {
  id: 7,
  name: 'Liga Osiedlowa 2026',
  slug: 'liga-osiedlowa-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points'],
  teamsCount: 8,
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

const valid = tournamentSettingsValues(SAVED);

/** Komunikaty pod danym kluczem (np. `points` albo `points.win`). */
function messagesAt(allowsDraw: boolean, input: unknown, path: string): string[] {
  const result = tournamentSettingsSchema(allowsDraw).safeParse(input);
  if (result.success) return [];
  return result.error.issues.filter((issue) => issue.path.join('.') === path).map((issue) => issue.message);
}

describe('tournamentSettingsSchema', () => {
  it('przepuszcza zapisany turniej', () => {
    expect(tournamentSettingsSchema(true).safeParse(valid).success).toBe(true);
  });

  it.each(['ab', 'Liga', 'liga--2026', '-liga', 'liga_2026', 'a'.repeat(81)])('odrzuca slug %s', (slug) => {
    expect(messagesAt(true, { ...valid, slug }, 'slug')).toHaveLength(1);
  });

  it('odrzuca kolor spoza #RRGGBB', () => {
    expect(messagesAt(true, { ...valid, branding: { primaryColor: '#1F7A4' } }, 'branding.primaryColor')).toHaveLength(1);
  });

  it('pilnuje zakresu 0–10 przy polu', () => {
    expect(messagesAt(true, { ...valid, points: { win: 11, draw: 1, loss: 0 } }, 'points.win')).toEqual([
      'Najwyżej 10 punktów.',
    ]);
    expect(messagesAt(true, { ...valid, points: { win: 3, draw: 1, loss: Number.NaN } }, 'points.loss')).toHaveLength(1);
  });

  it('porządek punktacji siada pod points', () => {
    expect(messagesAt(true, { ...valid, points: { win: 2, draw: 2, loss: 2 } }, 'points')).toHaveLength(1);
    expect(messagesAt(true, { ...valid, points: { win: 3, draw: 4, loss: 0 } }, 'points')).toHaveLength(1);
    expect(messagesAt(true, { ...valid, points: { win: 3, draw: 0, loss: 1 } }, 'points')).toHaveLength(1);
  });

  it('bez remisów draw nie wchodzi do porządku', () => {
    expect(messagesAt(false, { ...valid, points: { win: 2, draw: 0, loss: 1 } }, 'points')).toEqual([]);
  });
});

describe('tournamentSettingsUpdate', () => {
  it('bez zmian daje puste ciało', () => {
    expect(tournamentSettingsUpdate(valid, SAVED, true)).toEqual({});
  });

  it('wysyła tylko zmienione pola, a branding w kształcie z kontraktu', () => {
    expect(
      tournamentSettingsUpdate({ ...valid, slug: 'liga-2027', branding: { primaryColor: '#1D4E89' } }, SAVED, true),
    ).toEqual({ slug: 'liga-2027', branding: { primaryColor: '#1D4E89' } });
  });

  it('points idzie w komplecie, gdy zmieniło się jedno pole', () => {
    expect(tournamentSettingsUpdate({ ...valid, points: { win: 4, draw: 1, loss: 0 } }, SAVED, true)).toEqual({
      points: { win: 4, draw: 1, loss: 0 },
    });
  });

  it('bez remisów wysyła draw: 0', () => {
    const saved = { ...SAVED, points: { win: 2, draw: 0, loss: 1 } };
    expect(tournamentSettingsUpdate({ ...valid, points: { win: 3, draw: 5, loss: 1 } }, saved, false)).toEqual({
      points: { win: 3, draw: 0, loss: 1 },
    });
  });
});
