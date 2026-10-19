/**
 * Strony meczu na tablicy pasa etapu i w bocznej kolumnie Przeglądu (#296):
 * nazwa strony (drużyna albo źródło pustego slotu pucharu) i nazwa
 * odnośnika „Gospodarz – Gość”, jak w wierszu meczu z #292. Poza barrelem:
 * to pomocnik klocków, nie API strony.
 */
import type { MatchRowData } from '../components/data/match-row-data'

/** Strona meczu. */
export type Side = 'home' | 'away'

export function teamOf(match: MatchRowData, side: Side) {
  return side === 'home' ? match.homeTeam : match.awayTeam
}

/** Nazwa strony meczu: drużyna, a w pustym slocie pucharu źródło albo „Do ustalenia”, jak w wierszu meczu. */
export function sideName(match: MatchRowData, side: Side): string {
  const source = side === 'home' ? match.bracket?.homeSource : match.bracket?.awaySource
  return teamOf(match, side)?.name ?? source ?? 'Do ustalenia'
}

/** Nazwa odnośnika tablicy i wiersza meczu: „Gospodarz – Gość”, jak w wierszu z #292. */
export function matchPairLabel(match: MatchRowData): string {
  return `${sideName(match, 'home')} – ${sideName(match, 'away')}`
}
