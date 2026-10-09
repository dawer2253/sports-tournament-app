/**
 * Tiebreak z etykietą. Typ mieszka osobno, żeby `lib/demo-data.ts` mogło go
 * użyć bez importowania komponentu (jak `tournament-row.ts`).
 */
export type TiebreakerItem = {
  /** Kod z `Tournament.tiebreakers`, np. `head_to_head`. */
  code: string
  /** Etykieta z `SportConfig.tiebreakerLabels` (#117). */
  label: string
}
