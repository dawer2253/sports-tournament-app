/** Mecze `scheduled` w oknach usuwania drużyny i obiektu (#171). */
export const SCHEDULED_MATCHES = ['zaplanowany mecz', 'zaplanowane mecze', 'zaplanowanych meczów'] as const;

/** Kolejki w opisie opcji generowania: „19 kolejek” (#174). */
export const ROUNDS = ['kolejka', 'kolejki', 'kolejek'] as const;

/** Kolejki w toaście po generowaniu: „Wygenerowano 1 kolejkę” (#174). */
export const ROUNDS_ACCUSATIVE = ['kolejkę', 'kolejki', 'kolejek'] as const;

/** Rundy drabinki w toaście po generowaniu: „Wygenerowano drabinkę: 3 rundy” (#227). */
export const BRACKET_ROUNDS_ACCUSATIVE = ['rundę', 'rundy', 'rund'] as const;

/** Mecze w generowaniu terminarza: „190 meczów” (#174). */
export const MATCHES = ['mecz', 'mecze', 'meczów'] as const;

/** Kolizje w toaście rozkładu dat: „2 kolizje”, „5 kolizji” (#175). */
export const COLLISIONS = ['kolizja', 'kolizje', 'kolizji'] as const;

/** Pusty stan terminarza: „2 drużyny grają każdy z każdym” (#174). */
export const TEAMS_PLAYING = ['drużyna gra', 'drużyny grają', 'drużyn gra'] as const;

/** Liczba drużyn w nagłówku tabeli (#173). */
export const TEAMS = ['drużyna', 'drużyny', 'drużyn'] as const;

/** Liczba grup w edytorze składu i terminie fazy grupowej (#258). */
export const GROUPS = ['grupa', 'grupy', 'grup'] as const;

/** Podgląd kolejności przy tabeli: „2 drużyny zmieniają miejsce” (#173). */
export const TEAMS_CHANGING_PLACE = ['drużyna zmienia', 'drużyny zmieniają', 'drużyn zmienia'] as const;

/**
 * Polska odmiana rzeczownika po liczebniku: `[1, 2–4, 5+]`, np.
 * `SCHEDULED_MATCHES`. Druga forma obejmuje liczby kończące się na 2–4 poza
 * „-naście” (12–14, 112–114), trzecia całą resztę łącznie z zerem.
 */
export function plural(count: number, [one, few, many]: readonly [string, string, string]) {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14) ? few : many;
}
