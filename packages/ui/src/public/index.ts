// Wejście strony publicznej: `import { Shell, Crest } from '@tournament/ui/public'`.
// Nazwy bez przedrostka. Arkusz motywu doładowuje się osobno:
// `@import "@tournament/ui/public/theme.css"` (po `@tournament/ui/styles.css`).
//
// Barrel panelu (`src/index.ts`) tego katalogu nie re-eksportuje. Logika wspólna
// z panelem zostaje tam, gdzie jest; tu idzie tylko jej re-eksport.

export * from './public-nav'
export * from './public-shell-tournament'

// Shell i klocki.
export * from './anchor'
export * from './bracket'
export * from './bracket-notes'
export * from './board'
export * from './button'
export * from './crest'
export * from './form'
export * from './heads'
export * from './live'
export * from './match-board'
export * from './match-relation'
export * from './match-row'
export * from './round-sections'
export * from './schedule-progress'
export * from './score-cell'
export * from './shell'
export * from './skeleton'
export * from './standings-table'
export type { StandingsTableRow } from './standings-table-row'
export * from './stats'
export * from './tournament-logo'

// Ekrany (dane w propsach).
export * from './screens/bracket'
export * from './screens/match'
export * from './screens/rounds'
export * from './screens/standings'
export * from './screens/stats'
export * from './screens/system'

// Logika, której potrzebuje strona (re-eksport, kod zostaje na miejscu).
export {
  BRAND_COLOR_SAMPLES,
  DEFAULT_BRAND_COLOR,
  brandVars,
  type BrandColorSample,
} from '../lib/brand-on-dark'
export { isModifiedClick } from '../lib/utils'
export { ROUNDS_PER_PAGE, groupByRound, roundsPage, type RoundWithMatches } from '../components/data/round-groups'
export { bracketPosition, bracketTeamIds, currentRoundOrder, hasGroupStage, isKnockoutOnly } from '../lib/bracket'
export { plural } from '../lib/plural'
export { withQualifiers } from '../lib/qualifiers'
export { formatKickoff, formatMatchDay } from '../lib/kickoff'
export type { MatchPageData } from '../components/data/match-page-data'
