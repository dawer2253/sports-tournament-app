/**
 * Minuta zdarzenia z doliczonym czasem (#317): `{ minute: 45, addedTime: 3 }`
 * to „45+3′”. Mieszka w `lib/`, bo korzystają z niej zarówno zegar meczu
 * (`match-clock.ts`), jak i komponenty z `components/data`.
 */

/** Minuta zdarzenia z doliczonym czasem (`EventMinute` z kontraktu). */
export type EventMinute = { minute: number; addedTime: number | null }

/** Minuta zdarzenia z jego pól `minute` i `addedTime`; `null`, gdy minuty nie wpisano. */
export function eventMinuteOf(event: { minute: number | null; addedTime?: number | null }): EventMinute | null {
  return event.minute === null ? null : { minute: event.minute, addedTime: event.addedTime ?? null }
}

/** Minuta jak na osi meczu: „63′”, z doliczonym czasem „45+3′”, a bez minuty „—”. */
export function formatEventMinute(at: EventMinute | null): string {
  if (at === null) return '—'
  return at.addedTime === null ? `${at.minute}′` : `${at.minute}+${at.addedTime}′`
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
export function eventMinuteText(at: EventMinute | null): string {
  if (at === null) return ''
  return at.addedTime === null ? String(at.minute) : `${at.minute}+${at.addedTime}`
}
