import type { Venue } from '@tournament/api-client';
import { describe, expect, it } from 'vitest';
import { venueSchema, venueValues } from './venue-schema';

const valid = { name: 'Boisko Bemowo', address: 'ul. Powstańców Śląskich 1, Warszawa' };

/** Pierwszy komunikat dla danego pola albo `undefined`, gdy pole przeszło. */
function messageFor(input: unknown, field: string): string | undefined {
  const result = venueSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('venueSchema', () => {
  it('przepuszcza nazwę i adres w kształcie ciała `POST` obiektu', () => {
    expect(venueSchema.parse(valid)).toEqual(valid);
  });

  it('wymaga nazwy, także gdy są w niej same spacje', () => {
    expect(messageFor({ ...valid, name: '' }, 'name')).toBe('Podaj nazwę obiektu.');
    expect(messageFor({ ...valid, name: '   ' }, 'name')).toBe('Podaj nazwę obiektu.');
  });

  it('przycina nazwę, tak jak robi to serwer przed sprawdzeniem unikalności', () => {
    expect(venueSchema.parse({ ...valid, name: '  Hala Ursus ' }).name).toBe('Hala Ursus');
  });

  it('pilnuje limitu 120 znaków nazwy z kontraktu', () => {
    expect(messageFor({ ...valid, name: 'a'.repeat(121) }, 'name')).toBe(
      'Nazwa może mieć najwyżej 120 znaków.',
    );
    expect(venueSchema.safeParse({ ...valid, name: 'a'.repeat(120) }).success).toBe(true);
  });

  // Puste pole znaczy „bez adresu”, a nie adres z pustego napisu: tabela pokazuje
  // wtedy „–”, a pusty napis dałby pustą komórkę.
  it.each(['', '   '])('puste pole adresu (%j) wysyła `null`', (address) => {
    expect(venueSchema.parse({ ...valid, address }).address).toBeNull();
  });

  it('pilnuje limitu 255 znaków adresu z kontraktu', () => {
    expect(messageFor({ ...valid, address: 'a'.repeat(256) }, 'address')).toBe(
      'Adres może mieć najwyżej 255 znaków.',
    );
    expect(venueSchema.parse({ ...valid, address: 'a'.repeat(255) }).address).toHaveLength(255);
  });
});

describe('venueValues', () => {
  const venue: Venue = { id: 2, tournamentId: 1, name: 'Hala Ursus', address: null };

  it('przy dodawaniu startuje z pustymi polami', () => {
    expect(venueValues(null)).toEqual({ name: '', address: '' });
  });

  it('przy edycji startuje z danymi obiektu, a brak adresu to puste pole', () => {
    expect(venueValues(venue)).toEqual({ name: 'Hala Ursus', address: '' });
    expect(venueValues({ ...venue, address: 'ul. Sosnkowskiego 3' })).toEqual({
      name: 'Hala Ursus',
      address: 'ul. Sosnkowskiego 3',
    });
  });

  it('wartości startowe edycji przechodzą przez schemat bez zmian obiektu', () => {
    // Otwarcie edycji i „Zapisz” bez zmian nie może zamienić `null` na `''`.
    expect(venueSchema.parse(venueValues(venue))).toEqual({ name: 'Hala Ursus', address: null });
  });
});
