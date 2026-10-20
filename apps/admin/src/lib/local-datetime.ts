/**
 * Pole `datetime-local` a moment z API (ADR-0008). Pole trzyma czas lokalny
 * bez offsetu, a API mówi w UTC i na wejściu wymaga offsetu, więc oba
 * kierunki idą przez strefę przeglądarki. Wspólne dla terminu meczu (#174)
 * i terminu zapisów (#300).
 */

/** Wartość pola na moment w UTC (`…Z`), który API przyjmie jako datę z offsetem. */
export function toOffsetIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/** Moment z API (UTC) na wartość `datetime-local` w strefie przeglądarki; `''` bez daty. */
export function toLocalInputValue(iso: string | null): string {
  if (iso === null) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
