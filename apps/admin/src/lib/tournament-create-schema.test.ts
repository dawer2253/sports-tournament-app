import { describe, expect, it } from 'vitest';
import { tournamentCreateSchema } from './tournament-create-schema';

const valid = { name: 'Liga Osiedlowa 2026', sportId: 1, format: 'league' as const };

/** Pierwszy komunikat dla danego pola albo `undefined`, gdy pole przeszło. */
function messageFor(input: unknown, field: string): string | undefined {
  const result = tournamentCreateSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('tournamentCreateSchema', () => {
  it('przepuszcza komplet pól w kształcie TournamentCreate', () => {
    const result = tournamentCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it('wymaga nazwy', () => {
    expect(messageFor({ ...valid, name: '' }, 'name')).toBe('Podaj nazwę turnieju.');
  });

  it('przycina białe znaki i odrzuca nazwę złożoną z samych spacji', () => {
    expect(messageFor({ ...valid, name: '   ' }, 'name')).toBe('Podaj nazwę turnieju.');
    expect(tournamentCreateSchema.parse({ ...valid, name: '  Liga  ' }).name).toBe('Liga');
  });

  it('pilnuje limitu 160 znaków z kontraktu', () => {
    expect(messageFor({ ...valid, name: 'a'.repeat(161) }, 'name')).toBe(
      'Nazwa może mieć najwyżej 160 znaków.',
    );
    expect(tournamentCreateSchema.safeParse({ ...valid, name: 'a'.repeat(160) }).success).toBe(true);
  });

  // `undefined` to stan, w którym formularz trzyma niewybrany kafelek; `null`
  // bierze się stąd, że API i storage potrafią przysłać właśnie je.
  it.each([undefined, null])('wymaga wyboru sportu (%s)', (empty) => {
    expect(messageFor({ ...valid, sportId: empty }, 'sportId')).toBe('Wybierz sport.');
  });

  it.each([undefined, null])('wymaga wyboru formatu (%s)', (empty) => {
    expect(messageFor({ ...valid, format: empty }, 'format')).toBe('Wybierz format rozgrywek.');
  });

  it('odrzuca sportId, które nie jest liczbą całkowitą', () => {
    expect(messageFor({ ...valid, sportId: 1.5 }, 'sportId')).toBe('Wybierz sport.');
  });

  it('nie zna formatów spoza enuma kontraktu', () => {
    expect(messageFor({ ...valid, format: 'swiss' }, 'format')).toBe('Wybierz format rozgrywek.');
  });
});
