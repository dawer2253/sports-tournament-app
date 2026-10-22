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
  /** Doliczony czas (#317): `minute: 45, addedTime: 3` to „45+3′”. Brak pola znaczy `null`. */
  addedTime?: number | null
}

/** Minuta zdarzenia z doliczonym czasem (`EventMinute` z kontraktu, a w zdarzeniu para `minute` + `addedTime`). */
export type EventMinute = { minute: number; addedTime: number | null }

/** Minuta jak na osi meczu: „63′”, z doliczonym czasem „45+3′”, a bez minuty „—”. */
export function formatEventMinute(minute: number | null, addedTime: number | null = null): string {
  if (minute === null) return '—'
  return addedTime === null ? `${minute}′` : `${minute}+${addedTime}′`
}

/**
 * Minuta wpisana w pole: „67” albo „45+3”. Puste pole to zdarzenie bez minuty
 * (`{ minute: null, addedTime: null }`), a `null` znaczy, że wpis nie jest
 * minutą (poza 1–150, doliczony czas poza 1–30, litery, ułamek).
 */
export function parseEventMinute(text: string): { minute: number | null; addedTime: number | null } | null {
  const value = text.trim()
  if (value === '') return { minute: null, addedTime: null }
  const match = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/.exec(value)
  if (!match) return null
  const minute = Number(match[1])
  const addedTime = match[2] === undefined ? null : Number(match[2])
  if (minute < 1 || minute > 150) return null
  if (addedTime !== null && (addedTime < 1 || addedTime > 30)) return null
  return { minute, addedTime }
}

/** Odwrotność `parseEventMinute`: tekst do pola „Minuta” („67”, „45+3”, a bez minuty pusty). */
export function eventMinuteText(minute: number | null, addedTime: number | null = null): string {
  if (minute === null) return ''
  return addedTime === null ? String(minute) : `${minute}+${addedTime}`
}
