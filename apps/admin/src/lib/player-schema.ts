import { z } from 'zod';

const NUMBER_MESSAGE = 'Numer to liczba całkowita od 0 do 999.';

/** Puste pole formularza to w kontrakcie `null`, nie pusty napis. */
function emptyToNull(value: string) {
  return value === '' ? null : value;
}

/**
 * Walidacja okna zawodnika. Odwzorowuje ciało `POST /teams/{team}/players`
 * (`name` 1–120 znaków, `number` całkowity 0–999 albo `null`, `position` do 60
 * znaków albo `null`). Unikalność numeru i limit 50 zawodników sprawdza tylko
 * serwer (`apps/admin/AGENTS.md`, „Edycja list”).
 *
 * Numer wchodzi jako tekst, bo pole może zostać puste, a `valueAsNumber`
 * zrobiłoby z pustego pola `NaN`. Sprawdzamy zapis cyframi, a nie wynik
 * `Number()`, który przyjąłby też `1e2` czy `0x10`.
 */
export const playerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Podaj imię i nazwisko.')
    .max(120, 'Imię i nazwisko może mieć najwyżej 120 znaków.'),
  number: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, NUMBER_MESSAGE)
    .transform((value) => (value === '' ? null : Number(value))),
  position: z
    .string()
    .trim()
    .max(60, 'Pozycja może mieć najwyżej 60 znaków.')
    .transform(emptyToNull),
});

/** Pola formularza, czyli to, co wpisał organizer. */
export type PlayerFormValues = z.input<typeof playerSchema>;

/** Ciało `POST` i `PATCH` zawodnika. */
export type PlayerValues = z.output<typeof playerSchema>;
