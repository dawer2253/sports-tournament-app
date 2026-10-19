/** Zakładki strony publicznej: klucze, zestawy per format i ich podpisy. */
import { hasGroupStage, isKnockoutOnly } from '../lib/bracket'

/** Zakładka strony publicznej. */
export type PublicNavKey = 'home' | 'standings' | 'bracket' | 'fixtures' | 'results' | 'stats'

/** Podpis zakładki w pasku, w menu i w odnośnikach „Nie ma takiej strony”. */
export const TAB_LABELS: Record<PublicNavKey, string> = {
  home: 'Przegląd',
  standings: 'Tabela',
  bracket: 'Drabinka',
  fixtures: 'Terminarz',
  results: 'Wyniki',
  stats: 'Statystyki',
}

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

