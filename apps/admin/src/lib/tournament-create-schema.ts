import type { TournamentFormat } from '@tournament/api-client';
import { z } from 'zod';

/**
 * Formaty rozgrywek w kolejności, w jakiej pokazuje je formularz. Lista jest
 * wypisana, a nie wyprowadzona z kontraktu, bo do każdej pozycji dochodzi opis
 * po polsku; typ `TournamentFormat` pilnuje, że nie rozjedzie się z enumem.
 */
export const TOURNAMENT_FORMATS: {
  value: TournamentFormat;
  label: string;
  description: string;
}[] = [
  {
    value: 'league',
    label: 'Liga każdy z każdym',
    description: 'Wszystkie drużyny grają ze sobą, o kolejności decyduje tabela punktowa.',
  },
  {
    value: 'knockout',
    label: 'Puchar (drabinka)',
    description: 'Przegrany odpada, wygrany awansuje do kolejnej rundy.',
  },
  {
    value: 'groups_playoff',
    label: 'Grupy + playoff',
    description: 'Faza grupowa wyłania najlepszych, potem rozgrywki pucharowe.',
  },
];

const FORMAT_VALUES = TOURNAMENT_FORMATS.map((format) => format.value) as [
  TournamentFormat,
  ...TournamentFormat[],
];

/**
 * Walidacja kreatora turnieju. Odwzorowuje `TournamentCreate` z `openapi.yaml`
 * (nazwa 1–160 znaków, `sportId`, `format`) i nic ponad to: backend waliduje to
 * samo po swojej stronie, a ten schemat jest wygodą, nie zabezpieczeniem.
 *
 * Sport i format startują w formularzu jako niewybrane, bo nie wybieramy niczego
 * za organizera — domyślnie zaznaczony kafelek wysłałby ktoś, kto go nie
 * przeczytał. Dlatego komunikat „Wybierz…" siedzi przy `error`, a nie przy
 * `min`: dla pustego wyboru zod zgłasza niezgodność typu, nie naruszenie zakresu.
 */
export const tournamentCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Podaj nazwę turnieju.')
    .max(160, 'Nazwa może mieć najwyżej 160 znaków.'),
  sportId: z.int({ error: 'Wybierz sport.' }),
  format: z.enum(FORMAT_VALUES, { error: 'Wybierz format rozgrywek.' }),
});

/**
 * Kształt po walidacji. Że zgadza się z ciałem żądania `POST /tournaments`,
 * pilnuje adnotacja przy wysyłce w `pages/tournament-create.tsx`.
 *
 * Niewybrany sport i format formularz trzyma jako `undefined` — to typ, który
 * react-hook-form dopuszcza w `defaultValues` bez osobnego typu wejściowego.
 */
export type TournamentCreateValues = z.output<typeof tournamentCreateSchema>;
