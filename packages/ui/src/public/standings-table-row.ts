import type { StandingsTableRow as PanelStandingsTableRow } from '../components/data/standings-table-row'
import type { FormResult } from './form'

/**
 * Wiersz tabeli strony publicznej: wiersz panelu (`StandingRow` z kontraktu,
 * z `qualifies` i `tied` od `withQualifiers`) plus forma drużyny
 * (`StandingRow.form`, najnowszy wynik na końcu). Zgodność z kontraktem
 * pilnuje `apps/public/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno, żeby `lib/demo-data.ts` mogło go użyć bez importu
 * komponentu.
 */
export type StandingsTableRow = PanelStandingsTableRow & {
  form: readonly FormResult[]
}
