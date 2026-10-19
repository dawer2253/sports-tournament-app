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
export function bracketWinnerSide(
  match: Omit<BracketScore, 'homePenalties' | 'awayPenalties'> & Partial<Pick<BracketScore, 'homePenalties' | 'awayPenalties'>>,
): 'home' | 'away' | null {
  // Karne bywają nieobecne (wiersz ligi w `MatchRowData`), co znaczy to samo co `null`.
  const { status, homeScore, awayScore, homePenalties = null, awayPenalties = null } = match
  if (status !== 'finished' || homeScore === null || awayScore === null) return null
  if (homeScore !== awayScore) return homeScore > awayScore ? 'home' : 'away'
  if (homePenalties === null || awayPenalties === null || homePenalties === awayPenalties) return null
  return homePenalties > awayPenalties ? 'home' : 'away'
}

/** Strona przegranego meczu zakończonego (także po karnych): przeciwna do `bracketWinnerSide`. */
export function bracketLoserSide(match: Parameters<typeof bracketWinnerSide>[0]): 'home' | 'away' | null {
  const winner = bracketWinnerSide(match)
  return winner === null ? null : winner === 'home' ? 'away' : 'home'
}

// --- Odczyt drabinki z kompletu meczów fazy (#227, #234) ----------------------
//
// Kontrakt nie ma listy rund, etykiet pozycji, wolnych losów ani flagi meczu
// o 3. miejsce: wszystko poniżej wyprowadza się z meczów fazy i ich krawędzi,
// tak jak przewiduje ADR-0004. Panel i strona publiczna wołają te same
// funkcje, więc drabinka mówi w obu miejscach to samo.

/** Drużyna w slocie meczu drabinki. */
export type BracketTeam = { id: number; name: string }

/** Strona slotu w meczu. */
export type BracketSide = 'home' | 'away'

/**
 * Mecz fazy `knockout`: tyle `Match` z kontraktu, ile potrzebują reguły
 * odczytu drabinki. Typ jest strukturalny, bo pakiet UI nie zna kontraktu;
 * `AdminMatch` i `Match` aplikacji pasują do niego wprost.
 */
export type BracketMatch = BracketScore & {
  id: number
  round: { id: number; name: string; order: number }
  /** Pozycja w pełnej drabince 2^k, w 1. rundzie z dziurami po wolnych losach. */
  matchNumber: number
  homeTeam: BracketTeam | null
  awayTeam: BracketTeam | null
  /** ISO 8601 z offsetem; `null` to „Termin do ustalenia”. */
  kickoffAt: string | null
  winnerToMatchId: number | null
  loserToMatchId: number | null
  advancesToSlot: BracketSide | null
}

/**
 * Turniej w formacie `knockout`: same fazy pucharowe. Format nie jest polem
 * turnieju, mówią o nim wyłącznie fazy (ADR-0002, „Format” w `CONTEXT.md`).
 * W takim turnieju Drabinka zastępuje Terminarz w panelu i Tabelę na
 * stronie publicznej.
 */
export function isKnockoutOnly(stages: readonly { type: string }[]): boolean {
  return stages.length > 0 && stages.every((stage) => stage.type === 'knockout')
}

/**
 * Turniej z fazą `group`, czyli grupy z playoffem (format `groups_playoff`).
 * Jak przy `isKnockoutOnly`, mówią o tym wyłącznie fazy. W takim turnieju
 * strona publiczna ma i Tabelę grup, i Drabinkę playoffu (#268).
 */
export function hasGroupStage(stages: readonly { type: string }[]): boolean {
  return stages.some((stage) => stage.type === 'group')
}

/**
 * Drużyny stojące w drabince: z wszystkich meczów fazy pucharowej. To zbiór
 * rozstawionych — generator obsadza 1. rundę i sloty po wolnych losach od
 * razu, a późniejsze rundy dostają już tylko drużyny z wcześniejszych.
 */
export function bracketTeamIds(
  matches: readonly { homeTeam: { id: number } | null; awayTeam: { id: number } | null }[],
): Set<number> {
  return new Set(matches.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]).filter((id) => id !== undefined))
}

export const THIRD_PLACE_LABEL = 'Mecz o 3. miejsce'

/** Mecz o 3. miejsce: prowadzą do niego krawędzie przegranego. Osobnej flagi nie ma. */
export function isThirdPlaceMatch(match: { id: number }, matches: readonly BracketMatch[]): boolean {
  return matches.some((candidate) => candidate.loserToMatchId === match.id)
}

/** Drużyna w slocie meczu po stronie `side`; bez strony (np. bez zwycięzcy) `null`. */
export function teamOn<T>(match: { homeTeam: T | null; awayTeam: T | null }, side: BracketSide | null): T | null {
  return side === 'home' ? match.homeTeam : side === 'away' ? match.awayTeam : null
}

/** Druga strona meczu: tam stoi przegrany, gdy po `side` stoi zwycięzca. */
export function otherSide(side: BracketSide): BracketSide {
  return side === 'home' ? 'away' : 'home'
}

/** Mecz, którego krawędź zwycięzcy albo przegranego prowadzi do slotu `side` meczu `match` (ADR-0004). */
function feeder<M extends BracketMatch>(
  match: BracketMatch,
  side: BracketSide,
  edge: 'winnerToMatchId' | 'loserToMatchId',
  matches: readonly M[],
): M | undefined {
  return matches.find((source) => source[edge] === match.id && source.advancesToSlot === side)
}

/**
 * Etykieta pozycji meczu, której nie ma w danych: „Półfinał 1”, „Finał”,
 * „Mecz o 3. miejsce”. Numer to pozycja w pełnej drabince, więc w pierwszej
 * rundzie ma dziury po wolnych losach i tak zostaje w etykiecie. Finał to
 * mecz ostatniej rundy poza meczem o 3. miejsce — z położenia, a nie
 * z `round.name`, tak jak krótka nazwa rundy.
 */
export function matchLabel(match: BracketMatch, matches: readonly BracketMatch[]): string {
  if (isThirdPlaceMatch(match, matches)) return THIRD_PLACE_LABEL
  return match.round.order === roundsCount(matches) ? 'Finał' : `${match.round.name} ${match.matchNumber}`
}

/**
 * Skąd przyjdzie drużyna do slotu: „Zwycięzca: Półfinał 1”, „Przegrany:
 * Półfinał 2”. `undefined` dla slotu, do którego nie prowadzi żadna krawędź
 * (1. runda, wolny los).
 */
export function bracketSlotSource(match: BracketMatch, side: BracketSide, matches: readonly BracketMatch[]): string | undefined {
  const winner = feeder(match, side, 'winnerToMatchId', matches)
  if (winner) return `Zwycięzca: ${matchLabel(winner, matches)}`
  const loser = feeder(match, side, 'loserToMatchId', matches)
  if (loser) return `Przegrany: ${matchLabel(loser, matches)}`
  return undefined
}

/** Pozycja meczu w drabince: etykieta i podpisy źródeł pustych slotów. */
export type BracketPosition = { label: string; homeSource?: string; awaySource?: string }

/**
 * Pozycja meczu dla widoku poza drzewem (Terminarz, Wyniki, Przegląd,
 * strona meczu), liczona z kompletu meczów fazy, a nie z listy wierszy.
 * `undefined`, gdy meczu nie ma w komplecie (np. mecz innej fazy).
 */
export function bracketPosition(matchId: number, matches: readonly BracketMatch[]): BracketPosition | undefined {
  const match = matches.find((candidate) => candidate.id === matchId)
  if (!match) return undefined
  return {
    label: matchLabel(match, matches),
    homeSource: match.homeTeam ? undefined : bracketSlotSource(match, 'home', matches),
    awaySource: match.awayTeam ? undefined : bracketSlotSource(match, 'away', matches),
  }
}

/** Liczba rund drabinki: `order` rundy finału. */
function roundsCount(matches: readonly BracketMatch[]): number {
  return Math.max(0, ...matches.map((match) => match.round.order))
}

/**
 * Krótka nazwa rundy na pigułce: „1/64” … „1/4”, „1/2”, „Finał”. Wynika
 * z położenia rundy względem finału, a nie z `round.name`: runda `order`
 * z `count` ma w pełnej drabince 2^(count − order + 1) drużyn.
 */
export function roundShortName(order: number, count: number): string {
  const teams = 2 ** (count - order + 1)
  return teams === 2 ? 'Finał' : `1/${teams / 2}`
}

/**
 * Bieżąca runda: pierwsza z meczem innym niż `finished` (mecz o 3. miejsce
 * liczy się do rundy finału), a po finale ostatnia — jak `defaultRound`
 * w terminarzu panelu. `null` bez meczów.
 */
export function currentRoundOrder(matches: readonly BracketMatch[]): number | null {
  if (matches.length === 0) return null
  const open = matches.filter((match) => match.status !== 'finished').map((match) => match.round.order)
  return open.length > 0 ? Math.min(...open) : roundsCount(matches)
}

/**
 * Drużyny w grze: wszystkie drużyny fazy minus przegrani meczów
 * zakończonych. Mecz o 3. miejsce się nie liczy, bo obie jego drużyny
 * odpadły już w półfinale.
 */
export function bracketTeamsInPlay(matches: readonly BracketMatch[]): { inPlay: number; total: number } {
  const teams = new Set<number>()
  const out = new Set<number>()
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) if (team) teams.add(team.id)
    if (isThirdPlaceMatch(match, matches)) continue
    const winner = bracketWinnerSide(match)
    const loser = winner && teamOn(match, otherSide(winner))
    if (loser) out.add(loser.id)
  }
  return { inPlay: teams.size - out.size, total: teams.size }
}

/** Wolny los: drużyna, która stoi od razu w 2. rundzie. */
export type BracketBye<M extends BracketMatch = BracketMatch> = {
  team: BracketTeam
  /** Mecz 2. rundy, w którym drużyna stoi. */
  target: M
  side: BracketSide
  /** Miejsce brakującego meczu 1. rundy, od 1: 2m − 1 dla `home` meczu m, 2m dla `away`. */
  position: number
}

/**
 * Wolne losy: drużyny w meczu 2. rundy w slocie, do którego nie prowadzi
 * żadna krawędź (ADR-0004), po pozycji. Stoją w miejscu meczu 1. rundy,
 * którego nie ma.
 */
export function bracketByes<M extends BracketMatch>(matches: readonly M[]): BracketBye<M>[] {
  return matches
    .filter((match) => match.round.order === 2 && !isThirdPlaceMatch(match, matches))
    .flatMap((match) =>
      (['home', 'away'] as const).flatMap((side) => {
        const team = teamOn(match, side)
        if (!team || feeder(match, side, 'winnerToMatchId', matches)) return []
        const position = side === 'home' ? 2 * match.matchNumber - 1 : 2 * match.matchNumber
        return [{ team: { id: team.id, name: team.name }, target: match, side, position }]
      }),
    )
    .toSorted((a, b) => a.position - b.position)
}

/**
 * Rozstawienie, z którego drabinka powstała: drużyny w kolejności seedów,
 * pierwszy element to seed 1 (odwrotność `firstRoundPairs`). Drużyna stoi
 * na pozycji z `bracketSeedPositions` — w meczu 1. rundy albo, z wolnym
 * losem, od razu w 2. rundzie w miejscu brakującego meczu. Wyniki niczego
 * tu nie zmieniają, bo sloty 1. rundy i wolne losy zostają po starcie (#239).
 */
export function bracketSeeding(matches: readonly BracketMatch[]): BracketTeam[] {
  if (matches.length === 0) return []
  const positions = bracketSeedPositions(2 ** roundsCount(matches))
  const seeds: BracketTeam[] = []
  const place = (position: number, team: BracketTeam | null) => {
    if (team) seeds[positions[position - 1]! - 1] = { id: team.id, name: team.name }
  }
  for (const match of matches) {
    if (match.round.order !== 1) continue
    place(2 * match.matchNumber - 1, match.homeTeam)
    place(2 * match.matchNumber, match.awayTeam)
  }
  for (const bye of bracketByes(matches)) place(2 * bye.position - 1, bye.team)
  return seeds.filter(Boolean)
}

/** Finał: mecz ostatniej rundy, który nie jest meczem o 3. miejsce. */
export function bracketFinal<M extends BracketMatch>(matches: readonly M[]): M | null {
  const last = roundsCount(matches)
  return matches.find((match) => match.round.order === last && !isThirdPlaceMatch(match, matches)) ?? null
}

/** Mistrz: zwycięzca finału `finished`, także po karnych. `null`, dopóki go nie ma. */
export function bracketChampion(matches: readonly BracketMatch[]): BracketTeam | null {
  const final = bracketFinal(matches)
  if (!final) return null
  const team = teamOn(final, bracketWinnerSide(final))
  return team && { id: team.id, name: team.name }
}

/** Runda drabinki z tym, co pokazują pigułki, nagłówki kolumn i karta Przeglądu. */
export type BracketRoundSummary = {
  id: number
  name: string
  order: number
  /** „1/8”, „1/2”, „Finał”. */
  shortName: string
  /** Mecze zakończone i wszystkie, z meczem o 3. miejsce w rundzie finału. */
  finished: number
  total: number
  /** Czy w rundzie trwa mecz. */
  live: boolean
}

/** Rundy fazy po `order`. */
export function bracketRoundSummaries(matches: readonly BracketMatch[]): BracketRoundSummary[] {
  const count = roundsCount(matches)
  const byOrder = new Map<number, BracketMatch[]>()
  for (const match of matches) byOrder.set(match.round.order, [...(byOrder.get(match.round.order) ?? []), match])
  return [...byOrder.values()]
    .map((round) => {
      const { id, name, order } = round[0]!.round
      return {
        id,
        name,
        order,
        shortName: roundShortName(order, count),
        finished: round.filter((match) => match.status === 'finished').length,
        total: round.length,
        live: round.some((match) => match.status === 'live'),
      }
    })
    .toSorted((a, b) => a.order - b.order)
}

/** Miejsce w kolumnie drzewa: mecz, wolny los albo (w niespójnych danych) nic. */
export type BracketTreeSlot<M extends BracketMatch = BracketMatch> =
  | { kind: 'match'; match: M }
  | { kind: 'bye'; bye: BracketBye<M> }
  | { kind: 'empty' }

/** Kolumna drzewa: runda z miejscami pełnej drabinki i meczem o 3. miejsce pod finałem. */
export type BracketTreeRound<M extends BracketMatch = BracketMatch> = BracketRoundSummary & {
  /** 2^(liczba rund − order) miejsc po `matchNumber`; mecz o 3. miejsce tu nie stoi. */
  slots: BracketTreeSlot<M>[]
  third: M | null
}

/**
 * Drabinka jako kolumny drzewa: w każdej rundzie miejsca pełnej drabinki po
 * `matchNumber`, z wolnymi losami w miejscu brakujących meczów 1. rundy.
 * Mecz o 3. miejsce nie zajmuje miejsca w kolumnie finału, stoi pod nim.
 */
export function bracketTree<M extends BracketMatch>(matches: readonly M[]): BracketTreeRound<M>[] {
  const count = roundsCount(matches)
  const byes = bracketByes(matches)
  return bracketRoundSummaries(matches).map((summary) => {
    const inRound = matches.filter((match) => match.round.order === summary.order)
    const third = inRound.find((match) => isThirdPlaceMatch(match, matches)) ?? null
    const slots = Array.from({ length: 2 ** (count - summary.order) }, (_, index): BracketTreeSlot<M> => {
      const match = inRound.find((candidate) => candidate !== third && candidate.matchNumber === index + 1)
      if (match) return { kind: 'match', match }
      const bye = summary.order === 1 ? byes.find((candidate) => candidate.position === index + 1) : undefined
      return bye ? { kind: 'bye', bye } : { kind: 'empty' }
    })
    return { ...summary, slots, third }
  })
}
