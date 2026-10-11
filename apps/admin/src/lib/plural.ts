/**
 * Polska odmiana rzeczownika po liczebniku: `[1, 2–4, 5+]`, np.
 * `['zaplanowany mecz', 'zaplanowane mecze', 'zaplanowanych meczów']`.
 * Druga forma obejmuje liczby kończące się na 2–4 poza „-naście” (12–14,
 * 112–114), trzecia całą resztę łącznie z zerem.
 */
/** Mecze `scheduled` w oknach usuwania drużyny i obiektu (#171). */
export const SCHEDULED_MATCHES = ['zaplanowany mecz', 'zaplanowane mecze', 'zaplanowanych meczów'] as const;

export function plural(count: number, [one, few, many]: readonly [string, string, string]) {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14) ? few : many;
}
