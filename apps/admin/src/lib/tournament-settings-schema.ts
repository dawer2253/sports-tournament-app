import type { Points, Tournament, TournamentUpdate } from '@tournament/api-client';
import { z } from 'zod';

/** Wzorzec sluga z `TournamentUpdate.slug` w `openapi.yaml`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      points: z.object({ win: pointsValue, draw: pointsValue, loss: pointsValue }),
    })
    .superRefine(({ points }, ctx) => {
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
    points: { ...tournament.points },
  };
}

function samePoints(a: Points, b: Points) {
  return a.win === b.win && a.draw === b.draw && a.loss === b.loss;
}

/**
 * Ciało `PATCH /tournaments/{tournament}` z samych zmienionych pól.
 *
 * `points` idzie w komplecie, gdy zmieniło się którekolwiek z trzech, bo
 * backend nie przyjmuje części punktacji (#109). W sporcie bez remisów pola
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
  const points = allowsDraw ? values.points : { ...values.points, draw: 0 };
  if (!samePoints(points, saved.points)) body.points = points;
  return body;
}
