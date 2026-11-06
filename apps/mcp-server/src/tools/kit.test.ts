import { describe, expect, it } from 'vitest';
import { plural, shuffle } from './kit.ts';

describe('plural', () => {
  it.each([
    [1, '1 mecz'],
    [2, '2 mecze'],
    [4, '4 mecze'],
    [5, '5 meczów'],
    [12, '12 meczów'],
    [14, '14 meczów'],
    [22, '22 mecze'],
    [112, '112 meczów'],
    [0, '0 meczów'],
  ])('%i → %s', (count, expected) => {
    expect(plural(count, 'mecz', 'mecze', 'meczów')).toBe(expected);
  });
});

describe('shuffle', () => {
  it('zwraca permutację bez gubienia i dublowania, nie ruszając wejścia', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];

    const output = shuffle(input);

    expect([...output].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('każda drużyna trafia na każde miejsce rozstawienia (losowanie nie jest przypięte do kolejności)', () => {
    const firstPlaces = new Set<number>();
    for (let attempt = 0; attempt < 200; attempt++) {
      firstPlaces.add(shuffle([1, 2, 3, 4])[0]);
    }

    expect([...firstPlaces].sort()).toEqual([1, 2, 3, 4]);
  });
});
