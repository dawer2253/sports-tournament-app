import { describe, expect, it } from 'vitest';
import { plural } from './plural';

const MATCHES = ['zaplanowany mecz', 'zaplanowane mecze', 'zaplanowanych meczów'] as const;

describe('plural', () => {
  it.each([
    [1, 'zaplanowany mecz'],
    [2, 'zaplanowane mecze'],
    [4, 'zaplanowane mecze'],
    [5, 'zaplanowanych meczów'],
    // „-naście” bierze dopełniacz, choć kończy się na 2–4.
    [12, 'zaplanowanych meczów'],
    [14, 'zaplanowanych meczów'],
    // Dalej decyduje ostatnia cyfra, a jedynka poza samą jedynką to dopełniacz.
    [21, 'zaplanowanych meczów'],
    [22, 'zaplanowane mecze'],
    [112, 'zaplanowanych meczów'],
    [0, 'zaplanowanych meczów'],
  ])('%i → „%s”', (count, form) => {
    expect(plural(count, MATCHES)).toBe(form);
  });
});
