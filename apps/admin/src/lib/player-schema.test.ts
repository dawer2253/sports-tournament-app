import { describe, expect, it } from 'vitest';
import { playerSchema } from './player-schema';

function parse(values: Partial<{ name: string; number: string; position: string }>) {
  return playerSchema.safeParse({ name: 'Marek Nowak', number: '', position: '', ...values });
}

function messages(values: Parameters<typeof parse>[0]) {
  const result = parse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('playerSchema', () => {
  it('puste pola numeru i pozycji dają `null`, bo kontrakt nie przyjmuje pustego napisu', () => {
    expect(parse({ number: '', position: '   ' }).data).toEqual({
      name: 'Marek Nowak',
      number: null,
      position: null,
    });
  });

  it('numer z pola tekstowego staje się liczbą', () => {
    expect(parse({ number: ' 9 ' }).data?.number).toBe(9);
    expect(parse({ number: '0' }).data?.number).toBe(0);
    expect(parse({ number: '999' }).data?.number).toBe(999);
  });

  it.each(['1000', '-1', '1.5', '7a', '1e2'])('numer „%s” jest odrzucany', (number) => {
    expect(messages({ number })).toEqual(['Numer to liczba całkowita od 0 do 999.']);
  });

  it('imię i nazwisko jest wymagane i ma najwyżej 120 znaków', () => {
    expect(messages({ name: '  ' })).toEqual(['Podaj imię i nazwisko.']);
    expect(messages({ name: 'a'.repeat(121) })).toEqual([
      'Imię i nazwisko może mieć najwyżej 120 znaków.',
    ]);
    expect(parse({ name: '  Marek Nowak  ' }).data?.name).toBe('Marek Nowak');
  });

  it('pozycja ma najwyżej 60 znaków', () => {
    expect(messages({ position: 'a'.repeat(61) })).toEqual([
      'Pozycja może mieć najwyżej 60 znaków.',
    ]);
    expect(parse({ position: ' napastnik ' }).data?.position).toBe('napastnik');
  });
});
