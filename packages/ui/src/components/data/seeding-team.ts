/**
 * Drużyna na liście rozstawienia i w podglądzie par (#227). Podzbiór `Team`
 * z kontraktu, przepisany ręcznie, bo pakiet UI nie zna klienta API —
 * zgodność pilnuje `apps/admin/src/lib/contract-guard.ts`.
 *
 * W turnieju z fazą grupową (#260) drużyna niesie też pochodzenie z tabeli
 * grupy: `origin` to etykieta miejsca („1A”, „3B”), a `groupId` pozwala
 * podmienić ją na inną drużynę tej samej grupy. Rozstawienie nie jest
 * przechowywane, więc pochodzenie żyje tylko w oknie rozstawienia.
 *
 * Typ mieszka osobno z tego samego powodu co `MatchRowData`: żeby
 * `lib/demo-data.ts` i ekrany mogły go użyć bez importowania komponentu.
 */
export type SeedingTeam = {
  id: number
  name: string
  /** Miejsce w tabeli grupy jako etykieta („1A”); bez grup — brak. */
  origin?: string
  /** Grupa drużyny; podmiana na liście idzie tylko w jej obrębie. */
  groupId?: number | null
}
