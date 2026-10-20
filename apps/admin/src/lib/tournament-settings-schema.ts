import type { Points, Tournament, TournamentUpdate } from '@tournament/api-client';
import { z } from 'zod';

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

/** Próg seta z `SetFormat` w `openapi.yaml` (#301). */
const setPointsValue = z
  .number({ error: 'Podaj liczbę od 5 do 50.' })
  .int('Podaj liczbę całkowitą.')
  .min(5, 'Set gra się do co najmniej 5 punktów.')
  .max(50, 'Set gra się do najwyżej 50 punktów.');

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
 * @param hasSets sport z setami (#301): punktacja ma punkty po secie
 *   decydującym z porządkiem `loss ≤ lossDecidingSet < winDecidingSet ≤ win`,
 *   a formularz format seta z progiem decydującego nie większym od zwykłego.
 */
export function tournamentSettingsSchema(allowsDraw: boolean, hasSets = false) {
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
      points: z.object({
        win: pointsValue,
        draw: pointsValue,
        loss: pointsValue,
        // Punkty po secie decydującym (#301): wymagane tylko w sporcie z setami.
        winDecidingSet: pointsValue.optional(),
        lossDecidingSet: pointsValue.optional(),
      }),
      // Format seta (#301): w sporcie bez setów `null` i niczego nie sprawdza.
      setFormat: z
        .object({
          setsToWin: z.union([z.literal(2), z.literal(3)]),
          setPoints: setPointsValue,
          decidingSetPoints: setPointsValue,
          minLead: z.union([z.literal(1), z.literal(2)]),
        })
        .nullable(),
      // Podział meczu (#210). Pole minut znika przy „Bez podziału”, więc jego
      // wartość wtedy się nie liczy; przy kilku częściach jest wymagana.
      periods: z.object({ count: z.number().int().min(1).max(10), minutes: z.number().nullable() }),
    })
    .superRefine(({ points, periods, setFormat }, ctx) => {
      if (setFormat && setFormat.decidingSetPoints > setFormat.setPoints) {
        ctx.addIssue({
          code: 'custom',
          path: ['setFormat', 'decidingSetPoints'],
          message: 'Set decydujący nie może być dłuższy od zwykłego.',
        });
      }
      for (const field of ['winDecidingSet', 'lossDecidingSet'] as const) {
        if (hasSets && points[field] === undefined) {
          ctx.addIssue({ code: 'custom', path: ['points', field], message: 'Podaj liczbę od 0 do 10.' });
        }
      }
      if (
        hasSets &&
        points.winDecidingSet !== undefined &&
        points.lossDecidingSet !== undefined &&
        (points.loss > points.lossDecidingSet || points.lossDecidingSet >= points.winDecidingSet || points.winDecidingSet > points.win)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['points'],
          message: 'Porażka w secie decydującym daje co najmniej tyle co porażka i mniej niż wygrana w secie decydującym, a ta najwyżej tyle co wygrana.',
        });
      }
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
    setFormat: tournament.setFormat ? { ...tournament.setFormat } : null,
  };
}

function samePoints(a: Points, b: Points) {
  return (
    a.win === b.win &&
    a.draw === b.draw &&
    a.loss === b.loss &&
    a.winDecidingSet === b.winDecidingSet &&
    a.lossDecidingSet === b.lossDecidingSet
  );
}

function sameSetFormat(a: NonNullable<Tournament['setFormat']>, b: NonNullable<Tournament['setFormat']>) {
  return a.setsToWin === b.setsToWin && a.setPoints === b.setPoints && a.decidingSetPoints === b.decidingSetPoints && a.minLead === b.minLead;
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
  // Format seta idzie tylko zmieniony: od pierwszego wpisanego seta serwer go
  // nie przyjmie (ADR-0012), a reszta ustawień ma się dać zapisać.
  if (values.setFormat && saved.setFormat && !sameSetFormat(values.setFormat, saved.setFormat)) body.setFormat = values.setFormat;
  return body;
}
