import type { AdminSectionKey } from '@tournament/ui';

/**
 * Sekcje turnieju, które mają już swoją trasę pod `/tournaments/:id`. Reszta
 * zostaje nieczynna, dopóki nie powstanie odpowiedni widok — `AdminShell` sam
 * wyszarza kartę bez adresu, więc nie ma tu martwych odnośników.
 */
export const SECTION_ROUTES: Partial<Record<AdminSectionKey, string>> = {
  teams: 'teams',
  groups: 'groups',
  venues: 'venues',
  settings: 'settings',
  standings: 'standings',
  schedule: 'schedule',
  bracket: 'bracket',
};

/**
 * Sekcja, na której stoi indeks trasy `/tournaments/:id`. Pierwszą rzeczą po
 * założeniu turnieju jest dodanie drużyn, więc indeks przekierowuje tutaj —
 * ta sama wartość, czego pilnuje trasa w `routes.tsx`.
 */
export const DEFAULT_SECTION: AdminSectionKey = 'teams';

const ROUTED_SECTIONS = new Set<string>(Object.keys(SECTION_ROUTES));

function isRoutedSection(segment: string): segment is AdminSectionKey {
  return ROUTED_SECTIONS.has(segment);
}

/**
 * Sekcja z adresu. W trakcie wczytywania turnieju trasa-rodzic nie renderuje
 * dziecka, więc nie ma od kogo wziąć aktywnej karty — bierzemy segment adresu,
 * a że każda sekcja ma tam własną nazwę, `teams` z `/tournaments/7/teams/5`
 * wskazuje „Drużyny" (#262).
 */
export function sectionFromPath(pathname: string): AdminSectionKey {
  const segment = pathname.split('/')[3] ?? '';
  return isRoutedSection(segment) ? segment : DEFAULT_SECTION;
}
