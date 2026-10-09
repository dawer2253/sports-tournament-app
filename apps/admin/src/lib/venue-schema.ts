import type { Venue } from '@tournament/api-client';
import { z } from 'zod';

/**
 * Walidacja obiektu przy dodawaniu i edycji. Odwzorowuje ciało
 * `POST /tournaments/{tournament}/venues` (nazwa 1–120 znaków, adres do 255);
 * unikalność nazwy w turnieju i limit obiektów sprawdza serwer
 * (`apps/admin/AGENTS.md`, „Edycja list”).
 *
 * Adres jest w formularzu tekstem, a puste pole znaczy `null`: obiekt bez
 * adresu, który tabela pokazuje jako „–”.
 */
export const venueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Podaj nazwę obiektu.')
    .max(120, 'Nazwa może mieć najwyżej 120 znaków.'),
  address: z
    .string()
    .trim()
    .max(255, 'Adres może mieć najwyżej 255 znaków.')
    .transform((value) => (value === '' ? null : value)),
});

/** Pola formularza obiektu: same napisy, tak jak w `<input>`. */
export type VenueFormValues = z.input<typeof venueSchema>;

/** Ciało `POST` i `PATCH` obiektu. */
export type VenueValues = z.output<typeof venueSchema>;

/** Wartości startowe formularza: dane obiektu przy edycji, puste pola przy dodawaniu. */
export function venueValues(venue: Pick<Venue, 'name' | 'address'> | null): VenueFormValues {
  return { name: venue?.name ?? '', address: venue?.address ?? '' };
}
