/**
 * Zakładki strony publicznej. Osobno od `public-shell.tsx`, żeby aplikacja
 * mogła wziąć zestaw zakładek z barrel-a bez zdjęć hero, które ciągnie shell.
 */
import { hasGroupStage, isKnockoutOnly } from '../../lib/bracket'

/** Zakładka strony publicznej. */
export type PublicNavKey = 'home' | 'standings' | 'bracket' | 'fixtures' | 'results' | 'stats'

/** Zakładki ligi: Tabela zaraz po Przeglądzie. */
export const LEAGUE_TABS: readonly PublicNavKey[] = ['home', 'standings', 'fixtures', 'results', 'stats']

/**
 * Zakładki pucharu (#234): puchar nie ma tabeli, więc jej miejsce zaraz po
 * Przeglądzie zajmuje Drabinka.
 */
export const CUP_TABS: readonly PublicNavKey[] = ['home', 'bracket', 'fixtures', 'results', 'stats']

/**
 * Zakładki turnieju z fazą grupową (#268, wariant A z #252): Tabela grup
 * i Drabinka playoffu obok siebie, stałe przez cały turniej. Drabinka stoi
 * także przed wyjściem z grup — wtedy z pustym stanem.
 */
export const GROUP_TABS: readonly PublicNavKey[] = ['home', 'standings', 'bracket', 'fixtures', 'results', 'stats']

/**
 * Zestaw zakładek z faz turnieju. Formatu turniej nie ma (ADR-0002), więc
 * o zakładkach mówią wyłącznie fazy: faza `group` daje `GROUP_TABS`, same
 * fazy `knockout` — `CUP_TABS`, reszta — `LEAGUE_TABS`.
 */
export function publicTabs(stages: readonly { type: string }[]): readonly PublicNavKey[] {
  if (hasGroupStage(stages)) return GROUP_TABS
  return isKnockoutOnly(stages) ? CUP_TABS : LEAGUE_TABS
}

