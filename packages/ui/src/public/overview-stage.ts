/**
 * Wybór etapu Przeglądu (#296): kolejka albo runda w pasie na górze ekranu,
 * następna kolejka (albo najbliższe mecze) w bocznej kolumnie i fakty pasa.
 * Funkcje, nie komponent: strona w `apps/public` liczy nimi propsy ekranu,
 * a stories te same propsy z danych demo.
 */
import { groupByRound, type MatchInRound, type RoundWithMatches } from '../components/data/round-groups'
import { formatRoundDates } from '../lib/kickoff'

/** Gdzie w terminarzu stoi etap: podpis pasa („Pierwsza kolejka”, „Bieżąca runda”…). */
export type StagePosition = 'first' | 'current' | 'last'

/** Etap w pasie: kolejka albo runda z kompletem jej meczów. */
export interface OverviewStage<M extends MatchInRound = MatchInRound> {
  round: RoundWithMatches<M>
  position: StagePosition
}

/** Etap ligi albo fazy grupowej z tym, co pokazują pas i nagłówek tabeli. */
export interface OverviewRounds<M extends MatchInRound = MatchInRound> {
  /** `null`, gdy obie listy są puste: stan „Bez terminarza”. */
  stage: OverviewStage<M> | null
  /** Następna kolejka Terminarza po etapie; `null` po końcu i gdy jej nie ma. */
  next: RoundWithMatches<M> | null
  /** Wszystkie kolejki w obu listach („z 14 kolejek”). */
  roundsTotal: number
  /** Termin pierwszego meczu, dopóki żaden się nie zaczął; inaczej `null`. */
  startsAt: string | null
}

/** Termin rosnąco jako chwila (offset bywa różny), bez terminu na końcu, przy remisie po `id`. */
function byKickoff(a: MatchInRound, b: MatchInRound): number {
  if (a.kickoffAt === null || b.kickoffAt === null) {
    if (a.kickoffAt === b.kickoffAt) return a.id - b.id
    return a.kickoffAt === null ? 1 : -1
  }
  return Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt) || a.id - b.id
}

/** Kolejka z meczami w kolejności terminów i z podsumowaniem liczonym od nowa. */
function roundOf<M extends MatchInRound>(matches: readonly M[], timeZone?: string): RoundWithMatches<M> {
  const sorted = matches.toSorted(byKickoff)
  const { id, name } = sorted[0]!.round
  return {
    summary: {
      id,
      name,
      dates: formatRoundDates(
        sorted.map((match) => match.kickoffAt),
        timeZone,
      ),
      finished: sorted.filter((match) => match.status === 'finished').length,
      total: sorted.length,
    },
    matches: sorted,
  }
}

/**
 * Etap ligi i fazy grupowej z list Terminarza (`fixtures`, rosnąco) i Wyników
 * (`results`, od najnowszej), pogrupowanych tak jak na tych zakładkach
 * (`groupByRound`). Etap to kolejka, na której otwiera się Terminarz, a przy
 * pustym Terminarzu ta, na której otwierają się Wyniki, więc przed startem
 * wypada 1. kolejka, a po końcu ostatnia. Pas pokazuje komplet kolejki:
 * mecze zakończone z Wyników i niezakończone z Terminarza.
 */
export function overviewRounds<M extends MatchInRound>(
  fixtures: readonly RoundWithMatches<M>[],
  results: readonly RoundWithMatches<M>[],
  timeZone?: string,
): OverviewRounds<M> {
  const upcoming = fixtures.flatMap((round) => round.matches)
  const played = results.flatMap((round) => round.matches)
  const roundsTotal = new Set([...upcoming, ...played].map((match) => match.round.id)).size
  const started = played.length > 0 || upcoming.some((match) => match.status !== 'scheduled')
  const kickoffs = upcoming.map((match) => match.kickoffAt).filter((iso): iso is string => iso !== null)
  const startsAt = started || kickoffs.length === 0 ? null : kickoffs.toSorted((a, b) => Date.parse(a) - Date.parse(b))[0]!

  const stageId = fixtures[0]?.summary.id ?? results[0]?.summary.id
  if (stageId === undefined) return { stage: null, next: null, roundsTotal, startsAt }

  const position: StagePosition = !started ? 'first' : fixtures.length === 0 ? 'last' : 'current'
  return {
    stage: { round: roundOf([...played, ...upcoming].filter((match) => match.round.id === stageId), timeZone), position },
    next: fixtures.find((round) => round.summary.id !== stageId) ?? null,
    roundsTotal,
    startsAt,
  }
}

/** Etap pucharu albo playoffu z rundą w pasie i meczami następnej rundy obok. */
export interface OverviewBracketStage<M extends MatchInRound = MatchInRound> {
  /** `null`, gdy drabinki nie ma: stan „Bez terminarza”. */
  stage: OverviewStage<M> | null
  /** Mecze zaplanowane następnej rundy („Najbliższe mecze”); `null`, gdy nie ma takich. */
  next: RoundWithMatches<M> | null
}

/**
 * Etap pucharu i playoffu z kompletu meczów fazy (`/matches?stageId=`): runda
 * z pierwszym meczem niezakończonym, tak jak otwiera się Terminarz, a po
 * finale ostatnia. Mecz o 3. miejsce stoi w rundzie finału, więc pas pokazuje
 * oba. Obok stoją mecze zaplanowane następnej rundy, także z pustymi slotami.
 */
export function overviewBracketStage<M extends MatchInRound>(matches: readonly M[], timeZone?: string): OverviewBracketStage<M> {
  const rounds = groupByRound(matches)
  if (rounds.length === 0) return { stage: null, next: null }

  const open = rounds.findIndex((round) => round.matches.some((match) => match.status !== 'finished'))
  const index = open === -1 ? rounds.length - 1 : open
  const started = matches.some((match) => match.status !== 'scheduled')
  const position: StagePosition = !started ? 'first' : open === -1 ? 'last' : 'current'
  const following = rounds[index + 1]?.matches.filter((match) => match.status === 'scheduled') ?? []

  return {
    stage: { round: roundOf(rounds[index]!.matches, timeZone), position },
    next: following.length > 0 ? roundOf(following, timeZone) : null,
  }
}

/** Drużyna prezentacji (`TeamSummary` z kontraktu). */
export interface ShowcaseTeam {
  id: number
  name: string
  logoUrl: string | null
}

/** Drużyny prezentacji alfabetycznie po polsku (Ł po L), bez względu na kolejność z API. */
export function showcaseTeams<T extends ShowcaseTeam>(teams: readonly T[]): T[] {
  return teams.toSorted((a, b) => a.name.localeCompare(b.name, 'pl'))
}
