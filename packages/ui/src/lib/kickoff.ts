/**
 * Terminy meczów po polsku, w strefie czasowej (ADR-0008: API mówi w UTC,
 * czas lokalny liczy klient przez `Intl` ze strefą, a nie przez dodanie
 * godziny). Bez `timeZone` obowiązuje strefa przeglądarki — tak pokazuje panel.
 * Jawną strefę podają makiety, żeby zrzut nie zależał od maszyny.
 */

/** Napis meczu bez daty (#174). */
export const NO_KICKOFF = 'Termin do ustalenia'

function dayFormat(timeZone?: string) {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone })
}

function timeFormat(timeZone?: string) {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone })
}

/** Dzień meczu, np. „sob., 5 wrz”. */
export function formatMatchDay(iso: string, timeZone?: string): string {
  return dayFormat(timeZone).format(new Date(iso))
}

/**
 * Termin meczu: „sob., 5 wrz, 10:00”, sama godzina przy `showDate: false`
 * (kolejka w jednym dniu, data stoi wtedy nad listą) albo „Termin do
 * ustalenia”.
 */
export function formatKickoff(
  iso: string | null,
  { showDate = true, timeZone }: { showDate?: boolean; timeZone?: string } = {},
): string {
  if (iso === null) return NO_KICKOFF
  const time = timeFormat(timeZone).format(new Date(iso))
  return showDate ? `${formatMatchDay(iso, timeZone)}, ${time}` : time
}

/** Różne dni, w które grają mecze z terminem, w kolejności chronologicznej. */
export function matchDays(kickoffs: readonly (string | null)[], timeZone?: string): string[] {
  const dated = kickoffs.filter((iso): iso is string => iso !== null).sort()
  return [...new Set(dated.map((iso) => formatMatchDay(iso, timeZone)))]
}

/**
 * Zakres dat kolejki: „sob., 5 wrz”, „sob., 5 wrz – ndz., 6 wrz” albo „bez
 * terminu”, gdy żaden mecz nie ma daty. Mecze bez daty obok datowanych
 * dopisują swoją liczbę, żeby zakres nie udawał kompletu.
 *
 * Napisy `kickoffAt` mają w API jeden offset (`+00:00`), więc sortują się
 * leksykograficznie tak jak momenty.
 */
export function formatRoundDates(kickoffs: readonly (string | null)[], timeZone?: string): string {
  const days = matchDays(kickoffs, timeZone)
  if (days.length === 0) return 'bez terminu'
  const range = days.length === 1 ? days[0] : `${days[0]} – ${days[days.length - 1]}`
  const undated = kickoffs.filter((iso) => iso === null).length
  return undated > 0 ? `${range} · ${undated} bez terminu` : range
}
