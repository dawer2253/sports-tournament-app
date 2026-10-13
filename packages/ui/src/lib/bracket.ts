/**
 * Reguły drabinki, które widok liczy przed wygenerowaniem i przy odczycie
 * (#215). Jedno źródło dla podglądu par w oknie rozstawienia i dla zdań
 * o rozmiarze drabinki w panelu; generator w backendzie liczy to samo
 * (`App\Schedule\BracketGenerator`), a zgodność obu stron pilnują ich testy.
 */

/** Rozmiar drabinki: najbliższa potęga dwójki ≥ liczby drużyn (co najmniej 2). */
export function bracketSize(teams: number): number {
  let size = 2
  while (size < teams) size *= 2
  return size
}

/**
 * Seedy na kolejnych pozycjach pełnej drabinki, np. `[1, 8, 4, 5, 2, 7, 3, 6]`
 * dla 8. Każdy poziom rozkłada seed `s` na parę `s – (2m + 1 − s)`, więc
 * seedy 1…2^k nie spotkają się, zanim zostanie 2^k drużyn.
 */
export function bracketSeedPositions(size: number): number[] {
  let seeds = [1]
  while (seeds.length < size) {
    const mirror = seeds.length * 2 + 1
    seeds = seeds.flatMap((seed) => [seed, mirror - seed])
  }
  return seeds
}

/** Para pierwszej rundy pełnej drabinki; `away: null` to wolny los gospodarza. */
export type FirstRoundPair<T> = {
  /** Pozycja meczu w pełnej drabince (`matchNumber`), od 1, z dziurami po wolnych losach. */
  matchNumber: number
  home: T
  away: T | null
}

/**
 * Pary pierwszej rundy z kolejności rozstawienia: pierwszy element listy to
 * seed 1. Wolny los dostaje wyżej rozstawiony z pary, której rywal wypada
 * poza listę, więc przypada seedom 1…(2^k − n).
 */
export function firstRoundPairs<T>(seeding: readonly T[]): FirstRoundPair<T>[] {
  const size = bracketSize(seeding.length)
  const positions = bracketSeedPositions(size)
  return Array.from({ length: size / 2 }, (_, index) => {
    const home = positions[2 * index]!
    const away = positions[2 * index + 1]!
    return {
      matchNumber: index + 1,
      home: seeding[home - 1]!,
      away: away <= seeding.length ? seeding[away - 1]! : null,
    }
  })
}

/** Liczba wolnych losów dla `teams` drużyn: 2^k − n. */
export function byesCount(teams: number): number {
  return bracketSize(teams) - teams
}

/** Wynik meczu drabinki, z karnymi; podzbiór `Match` z kontraktu. */
export type BracketScore = {
  status: 'scheduled' | 'live' | 'finished'
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
}

/**
 * Strona zwycięzcy meczu zakończonego: z wyniku, a przy remisie z karnych.
 * `null`, dopóki mecz nie jest zakończony albo nie ma rozstrzygnięcia.
 */
export function bracketWinnerSide(match: BracketScore): 'home' | 'away' | null {
  const { status, homeScore, awayScore, homePenalties, awayPenalties } = match
  if (status !== 'finished' || homeScore === null || awayScore === null) return null
  if (homeScore !== awayScore) return homeScore > awayScore ? 'home' : 'away'
  if (homePenalties === null || awayPenalties === null || homePenalties === awayPenalties) return null
  return homePenalties > awayPenalties ? 'home' : 'away'
}

/** Wynik z karnymi: „1:1 (k. 4:3)”, „2:0” albo „–”, gdy wyniku nie ma. */
export function bracketScoreText(match: BracketScore): string {
  if (match.homeScore === null || match.awayScore === null) return '–'
  const penalties =
    match.homePenalties !== null && match.awayPenalties !== null ? ` (k. ${match.homePenalties}:${match.awayPenalties})` : ''
  return `${match.homeScore}:${match.awayScore}${penalties}`
}
