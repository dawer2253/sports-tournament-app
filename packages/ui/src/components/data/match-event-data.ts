/**
 * Typy zdarzeń meczu dla klocków okna meczu (#200). Podzbiory typów
 * z kontraktu, przepisane ręcznie, bo pakiet UI nie zna klienta API —
 * zgodność pilnuje `apps/admin/src/lib/contract-guard.ts`.
 *
 * Mieszkają osobno z tego samego powodu co `MatchRowData`: żeby
 * `lib/demo-data.ts` mogło ich użyć bez importowania komponentów.
 */

/** Typ zdarzenia sportu (`SportEventType` z `GET /sports`). */
export type EventTypeOption = {
  code: string
  label: string
  hasPlayer: boolean
  /** Wkład jednego zdarzenia do statystyki `stat`, np. 3 przy rzucie za 3. */
  value: number
  /** `null`: zdarzenie nie wlicza się do żadnej klasyfikacji (samobój). */
  stat: string | null
}

/** Zawodnik do wyboru w siatce numerów (podzbiór `Player`). */
export type RosterPlayer = {
  id: number
  name: string
  number: number | null
}

/** Zdarzenie meczu na osi (`MatchEvent` z kontraktu). */
export type MatchEventRow = {
  id: number
  team: { id: number; name: string }
  player: { id: number; name: string } | null
  type: string
  typeLabel: string
  /** `null`, gdy minuty nie wpisano; takie zdarzenie stoi na końcu osi. */
  minute: number | null
}

/** Minuta jak na osi meczu: „63′”, a bez minuty „—”. */
export function formatEventMinute(minute: number | null): string {
  return minute === null ? '—' : `${minute}′`
}
