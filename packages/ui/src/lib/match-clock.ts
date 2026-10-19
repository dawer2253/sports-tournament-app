/**
 * Zegar meczu na żywo (#297, rozstrzygnięcie #289, „Minuta i część meczu”).
 * Liczy go przeglądarka z części meczu i jej startu stemplowanego przez
 * serwer, bez dodatkowych zapytań. Reguły i słownik: `CONTEXT.md`, hasło
 * „Match period (część meczu)”.
 */

/** Podział meczu na części (`MatchPeriods` z kontraktu). `minutes` jest `null` tylko przy jednej części. */
export type MatchPeriods = { count: number; minutes: number | null }

/** Zegar meczu z kontraktu (`Match.livePeriod`, `periodStartedAt`, `onBreak`). */
export type MatchClockState = {
  livePeriod: number | null
  /** ISO 8601 z offsetem; `null` w przerwie i po powrocie z zakończonego. */
  periodStartedAt: string | null
  onBreak: boolean
}

/** Ustawienia turnieju, z których liczy się zegar (`PublicTournament.periods`, `matchDuration`, `runningClock`). */
export type MatchClockSettings = {
  periods: MatchPeriods
  /** Długość meczu: regulaminowy koniec jedynej części w turnieju bez podziału. */
  matchDuration: number
  /** Czy zegar biegnie w minutach (piłka); bez niego tablica pokazuje część („3. kwarta”). */
  runningClock: boolean
}

/** Co ile przeglądarka przelicza minutę. */
export const MATCH_CLOCK_TICK_MS = 30_000

/** Ile minut ponad regulaminowy koniec części zegar jeszcze stoi, zanim zostanie samo „Na żywo”. */
const FORGOTTEN_AFTER = 30

/** Znak minuty (U+2032), ten sam co w relacji meczu. */
const PRIME = '′'

/** Rzeczownik części według ich liczby, nie sportu: [mianownik, dopełniacz]. Inna liczba to „część”. */
const NOUNS: Record<number, [string, string]> = {
  2: ['połowa', 'połowy'],
  3: ['tercja', 'tercji'],
  4: ['kwarta', 'kwarty'],
}
const FALLBACK_NOUN: [string, string] = ['część', 'części']

/** Etykieta części w mianowniku: „2. połowa”, „3. kwarta”. */
export function periodLabel(number: number, count: number): string {
  return `${number}. ${(NOUNS[count] ?? FALLBACK_NOUN)[0]}`
}

/** Etykieta części w dopełniaczu, do przycisku panelu: „Start 2. połowy”, „2. kwarty”. */
export function periodLabelGenitive(number: number, count: number): string {
  return `${number}. ${(NOUNS[count] ?? FALLBACK_NOUN)[1]}`
}

/**
 * Napis przy „Na żywo”: minuta („67′”, „45+3′”), „Przerwa”, część („3. kwarta”)
 * albo „Dogrywka”. `null` znaczy samo „Na żywo” bez dopisku: mecz po powrocie
 * z zakończonego, zapomniany mecz (30 minut ponad koniec części) albo dane bez
 * części.
 *
 * Część `n` startuje od stałej minuty `(n − 1) × minuty + 1`, więc 2. połowa
 * zawsze od 46′, a minuta to start części plus pełne minuty od jej startu.
 * Przeglądarka z zegarem w tyle za serwerem dostaje minutę startu części.
 */
export function matchClock(state: MatchClockState, settings: MatchClockSettings, now: Date): string | null {
  const { livePeriod, periodStartedAt, onBreak } = state
  const { periods } = settings
  if (livePeriod === null) return null
  if (livePeriod > periods.count) return 'Dogrywka'
  if (onBreak) return 'Przerwa'
  if (periodStartedAt === null) return null
  if (!settings.runningClock) return periods.count > 1 ? periodLabel(livePeriod, periods.count) : null

  const started = Date.parse(periodStartedAt)
  if (Number.isNaN(started)) return null
  const elapsed = Math.max(0, Math.floor((now.getTime() - started) / 60_000))
  const length = periods.minutes ?? settings.matchDuration
  const end = livePeriod * length
  const minute = (livePeriod - 1) * length + 1 + elapsed
  if (minute <= end) return `${minute}${PRIME}`
  const added = minute - end
  return added > FORGOTTEN_AFTER ? null : `${end}+${added}${PRIME}`
}
