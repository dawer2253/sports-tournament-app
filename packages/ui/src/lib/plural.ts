/**
 * Polska odmiana rzeczownika po liczebniku: `[1, 2–4, 5+]`, np.
 * `['grupa', 'grupy', 'grup']`. Druga forma obejmuje liczby kończące się na
 * 2–4 poza „-naście” (12–14, 112–114), trzecia całą resztę łącznie z zerem.
 */
export function plural(count: number, [one, few, many]: readonly [string, string, string]): string {
  if (count === 1) return one
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14) ? few : many
}

/** Liczba drużyn przy liczniku składu grupy. */
export const TEAMS = ['drużyna', 'drużyny', 'drużyn'] as const

/** Liczba grup fazy w komunikatach składu. */
export const GROUPS = ['grupa', 'grupy', 'grup'] as const

/**
 * Orzeczenie przed liczbą wychodzących z grupy: „wychodzą 2 drużyny” (#259),
 * „Wychodzą 2 z 4” w skrócie grupy na Przeglądzie (#268).
 */
export const QUALIFY = ['wychodzi', 'wychodzą', 'wychodzi'] as const

/** Mecze kasowane razem ze składem grup. */
export const MATCHES = ['mecz', 'mecze', 'meczów'] as const
