import type { MatchRowData, MatchScorer } from './match-row-data'

// Układ strzelców pod wynikiem (#208): po której stronie stoi wiersz, w jakim
// formacie i ile ich widać. Osobno od `scorer-list.tsx`, bo to funkcje, a nie
// komponent — korzystają z nich `MatchRow` i `LiveMatchTile`.

/** Ile wierszy w formacie sumy widać na drużynę w wierszu meczu; pas strony meczu pokazuje wszystkie (#210). */
export const SUM_LINES_LIMIT = 3

/** Wiersz strzelca gotowy do pokazania w kolumnie gospodarza albo gościa. */
export type ScorerLine = {
  key: string
  name: string
  /** Minuty („23' 67'”) albo sama suma („18”). */
  detail: string
  ownGoal: boolean
}

/**
 * Format bez wiedzy o sporcie: minuty, gdy każde zdarzenie jest warte 1
 * i ma minutę (`minutes.length === value`), w przeciwnym razie sama suma —
 * rzuty w koszu albo bramka bez minuty.
 */
export function hasMinuteFormat(scorer: MatchScorer): boolean {
  return scorer.minutes.length === scorer.value
}

function toLine(scorer: MatchScorer): ScorerLine {
  return {
    key: `${scorer.player.id}${scorer.ownGoal ? '-own' : ''}`,
    name: scorer.player.name,
    detail: hasMinuteFormat(scorer) ? scorer.minutes.map((minute) => `${minute}'`).join(' ') : String(scorer.value),
    ownGoal: scorer.ownGoal,
  }
}

/**
 * Wiersze jednej strony: w formacie minut wszystkie, w kolejności z API,
 * a za nimi w formacie sumy najwyżej `limit`, malejąco po `value` (przy
 * równości w kolejności z API).
 */
function sideLines(scorers: MatchScorer[], limit: number): ScorerLine[] {
  const minutes = scorers.filter(hasMinuteFormat)
  const sums = scorers
    .filter((scorer) => !hasMinuteFormat(scorer))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, limit)
  return [...minutes, ...sums].map(toLine)
}

/**
 * Strzelcy po stronie gospodarza i gościa. Samobój stoi po stronie
 * przeciwnika drużyny `team`, bo to jej przeciwnik dostał zdobycz (#188).
 *
 * `limit` ucina wiersze w formacie sumy: wiersz meczu pokazuje
 * `SUM_LINES_LIMIT`, a pas strony meczu wszystkich (`Infinity`, #192).
 */
export function scorerSides(
  match: Pick<MatchRowData, 'homeTeam' | 'scorers'>,
  { limit = SUM_LINES_LIMIT }: { limit?: number } = {},
): { home: ScorerLine[]; away: ScorerLine[] } {
  const scorers = match.scorers ?? []
  const forHome = (scorer: MatchScorer) => (scorer.team.id === match.homeTeam?.id) !== scorer.ownGoal
  return {
    home: sideLines(scorers.filter(forHome), limit),
    away: sideLines(scorers.filter((scorer) => !forHome(scorer)), limit),
  }
}
