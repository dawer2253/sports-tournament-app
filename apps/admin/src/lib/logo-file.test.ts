import { describe, expect, it } from 'vitest';
import { logoFileError, TOURNAMENT_LOGO } from './logo-file';

const MB = 1024 * 1024;

function file(type: string, size: number, name = 'logo') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('logoFileError', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('przepuszcza %s', (type) => {
    expect(logoFileError(file(type, 1024), TOURNAMENT_LOGO)).toBeUndefined();
  });

  it('bez pliku prosi o wybór', () => {
    expect(logoFileError(null, TOURNAMENT_LOGO)).toBe('Wybierz plik z logo.');
  });

  // SVG i AVIF to obrazy, ale kontrakt ich nie przyjmuje.
  it.each(['image/gif', 'image/svg+xml', 'image/avif', ''])('odrzuca typ „%s"', (type) => {
    expect(logoFileError(file(type, 1024), TOURNAMENT_LOGO)).toBe('Logo musi być plikiem PNG, JPG albo WebP.');
  });

  // Granica jak `max:2048` w backendzie: 2048 KB przechodzi, bajt więcej już nie.
  it('przepuszcza dokładnie 2 MB, a bajt więcej odrzuca', () => {
    expect(logoFileError(file('image/png', 2 * MB), TOURNAMENT_LOGO)).toBeUndefined();
    expect(logoFileError(file('image/png', 2 * MB + 1), TOURNAMENT_LOGO)).toBe('Logo może mieć najwyżej 2 MB.');
  });

  it('zły typ wygrywa z rozmiarem, jak `bail` na serwerze', () => {
    expect(logoFileError(file('image/gif', 3 * MB), TOURNAMENT_LOGO)).toBe(
      'Logo musi być plikiem PNG, JPG albo WebP.',
    );
  });

  it('odmienia rzeczownik podany przez ekran', () => {
    const crest = { subject: 'Herb', instrumental: 'herbem' };
    expect(logoFileError(null, crest)).toBe('Wybierz plik z herbem.');
    expect(logoFileError(file('image/gif', 1), crest)).toBe('Herb musi być plikiem PNG, JPG albo WebP.');
  });
});
