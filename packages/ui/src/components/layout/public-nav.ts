/**
 * Zakładki strony publicznej. Osobno od `public-shell.tsx`, żeby aplikacja
 * mogła wziąć zestaw zakładek z barrel-a bez zdjęć hero, które ciągnie shell.
 */

/** Zakładka strony publicznej. */
export type PublicNavKey = 'home' | 'standings' | 'bracket' | 'fixtures' | 'results' | 'stats'

/** Zakładki ligi i turnieju z grupami: Tabela zaraz po Przeglądzie. */
export const LEAGUE_TABS: readonly PublicNavKey[] = ['home', 'standings', 'fixtures', 'results', 'stats']

/**
 * Zakładki pucharu (#234): puchar nie ma tabeli, więc jej miejsce zaraz po
 * Przeglądzie zajmuje Drabinka.
 */
export const CUP_TABS: readonly PublicNavKey[] = ['home', 'bracket', 'fixtures', 'results', 'stats']
