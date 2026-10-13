/**
 * Drużyna na liście rozstawienia i w podglądzie par (#227). Podzbiór `Team`
 * z kontraktu, przepisany ręcznie, bo pakiet UI nie zna klienta API —
 * zgodność pilnuje `apps/admin/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno z tego samego powodu co `MatchRowData`: żeby
 * `lib/demo-data.ts` i ekrany mogły go użyć bez importowania komponentu.
 */
export type SeedingTeam = { id: number; name: string }
