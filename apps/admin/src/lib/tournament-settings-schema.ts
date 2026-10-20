import type { Points, Tournament, TournamentUpdate } from '@tournament/api-client';
import { z } from 'zod';
import { toLocalInputValue, toOffsetIso } from './local-datetime';

/** Wzorzec sluga z `TournamentUpdate.slug` w `openapi.yaml`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Minuty części meczu z `MatchPeriods.minutes` w `openapi.yaml`. */
const periodMinutes = z
  .number({ error: 'Podaj długość części w minutach.' })
  .int('Podaj liczbę całkowitą.')
  .min(1, 'Część trwa od 1 do 150 minut.')
  .max(150, 'Część trwa od 1 do 150 minut.');

const pointsValue = z
  .number({ error: 'Podaj liczbę od 0 do 10.' })
  .int('Podaj liczbę całkowitą.')
  .min(0, 'Najmniej 0 punktów.')
  .max(10, 'Najwyżej 10 punktów.');

/**
 * Walidacja formularza ustawień. Odwzorowuje `TournamentUpdate` i `Points`
 * z kontraktu, a unikalność sluga zostawia serwerowi.
 *
 * Porządek punktacji (`loss < win`, a przy remisach `loss ≤ draw ≤ win`)
 * dotyczy trzech pól naraz, więc błąd siada pod `points`, czyli przy karcie,
 * a nie przy jednym polu (#108). Ten sam klucz daje `422` z serwera.
 *
 * @param allowsDraw z konfiguracji sportu: bez remisów `draw` nie wchodzi do
 *   porządku, bo koszykówka ma `draw: 0` i `loss: 1`.
 */
export function tournamentSettingsSchema(allowsDraw: boolean) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Podaj nazwę turnieju.')
        .max(160, 'Nazwa może mieć najwyżej 160 znaków.'),
      slug: z
        .string()
        .min(3, 'Adres musi mieć co najmniej 3 znaki.')
        .max(80, 'Adres może mieć najwyżej 80 znaków.')
        .regex(SLUG_PATTERN, 'Użyj małych liter bez polskich znaków, cyfr i pojedynczych myślników.'),
      branding: z.object({
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Podaj kolor w formacie #RRGGBB.'),
      }),
      matchDuration: z
        .number({ error: 'Podaj długość meczu w minutach.' })
        .int('Podaj liczbę całkowitą.')
        .min(10, 'Długość meczu to co najmniej 10 minut.')
        .max(600, 'Długość meczu to najwyżej 600 minut.'),
      points: z.object({ win: pointsValue, draw: pointsValue, loss: pointsValue }),
      // Podział meczu (#210). Pole minut znika przy „Bez podziału”, więc jego
      // wartość wtedy się nie liczy; przy kilku częściach jest wymagana.
      periods: z.object({ count: z.number().int().min(1).max(10), minutes: z.number().nullable() }),
      // Zapisy (#300): termin to wartość pola `datetime-local`, `''` bez terminu.
      registration: z.object({ open: z.boolean(), deadline: z.string() }),
    })
    .superRefine(({ points, periods }, ctx) => {
      // `null` i puste pole (`NaN`) dają ten sam komunikat co brak liczby.
      const minutes = periods.count > 1 ? periodMinutes.safeParse(periods.minutes) : undefined;
      if (minutes?.error) {
        ctx.addIssue({ code: 'custom', path: ['periods', 'minutes'], message: minutes.error.issues[0]!.message });
      }
      if (points.loss >= points.win) {
        ctx.addIssue({
          code: 'custom',
          path: ['points'],
          message: 'Porażka musi dawać mniej punktów niż wygrana.',
        });
      } else if (allowsDraw && (points.draw < points.loss || points.draw > points.win)) {
        ctx.addIssue({
          code: 'custom',
          path: ['points'],
          message: 'Remis musi dawać nie mniej punktów niż porażka i nie więcej niż wygrana.',
        });
      }
    });
}

export type TournamentSettingsValues = z.output<ReturnType<typeof tournamentSettingsSchema>>;

/** Wartości formularza z turnieju, jak przyszedł z API. */
export function tournamentSettingsValues(tournament: Tournament): TournamentSettingsValues {
  return {
    name: tournament.name,
    slug: tournament.slug,
    branding: { primaryColor: tournament.branding.primaryColor },
    matchDuration: tournament.matchDuration,
    periods: { ...tournament.periods },
    points: { ...tournament.points },
    registration: { open: tournament.registration.open, deadline: toLocalInputValue(tournament.registration.deadline) },
  };
}

/** Czy pole terminu i zapisany termin to ten sam moment; puste pole to brak terminu. */
function sameDeadline(local: string, saved: string | null): boolean {
  if (local === '' || saved === null) return local === '' && saved === null;
  return new Date(local).getTime() === new Date(saved).getTime();
}

function samePoints(a: Points, b: Points) {
  return a.win === b.win && a.draw === b.draw && a.loss === b.loss;
}

/**
 * Ciało `PATCH /tournaments/{tournament}` z samych zmienionych pól.
 *
 * `points` idzie w komplecie, gdy zmieniło się którekolwiek z trzech, bo
 * backend nie przyjmuje części punktacji (#109). Tak samo `periods` (#210). W sporcie bez remisów pola
 * „Remis" nie ma, więc `draw` jest zawsze `0`.
 *
 * Porównanie idzie z zapisanym turniejem, a nie z „brudnymi" polami formularza:
 * nazwa z dopisaną spacją jest dla formularza zmianą, a po przycięciu przez
 * schemat — już nie.
 */
export function tournamentSettingsUpdate(
  values: TournamentSettingsValues,
  saved: Tournament,
  allowsDraw: boolean,
): TournamentUpdate {
  const body: TournamentUpdate = {};
  if (values.name !== saved.name) body.name = values.name;
  if (values.slug !== saved.slug) body.slug = values.slug;
  if (values.branding.primaryColor !== saved.branding.primaryColor) {
    body.branding = { primaryColor: values.branding.primaryColor };
  }
  if (values.matchDuration !== saved.matchDuration) body.matchDuration = values.matchDuration;
  // Podział idzie w komplecie, a „Bez podziału” zawsze z `minutes: null`,
  // choćby w ukrytym polu zostały minuty.
  const periods = values.periods.count === 1 ? { count: 1, minutes: null } : values.periods;
  if (periods.count !== saved.periods.count || periods.minutes !== saved.periods.minutes) body.periods = periods;
  const points = allowsDraw ? values.points : { ...values.points, draw: 0 };
  if (!samePoints(points, saved.points)) body.points = points;
  // Zapisy idą jak `branding`: tylko zmieniona część. Termin z pola dostaje
  // offset przed wysłaniem (ADR-0008), a puste pole usuwa termin (`null`).
  const registration: NonNullable<TournamentUpdate['registration']> = {};
  if (values.registration.open !== saved.registration.open) registration.open = values.registration.open;
  if (!sameDeadline(values.registration.deadline, saved.registration.deadline)) {
    registration.deadline = values.registration.deadline === '' ? null : toOffsetIso(values.registration.deadline);
  }
  if (Object.keys(registration).length > 0) body.registration = registration;
  return body;
}
