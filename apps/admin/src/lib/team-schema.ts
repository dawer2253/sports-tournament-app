import { z } from 'zod';

/**
 * Walidacja okna nazwy drużyny (dodanie i zmiana nazwy). Odwzorowuje ciało
 * `POST /tournaments/{tournament}/teams`: `name` 1–120 znaków. Unikalność
 * i limit 128 drużyn sprawdza tylko serwer.
 */
export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Podaj nazwę drużyny.')
    .max(120, 'Nazwa może mieć najwyżej 120 znaków.'),
});

export type TeamValues = z.output<typeof teamSchema>;
