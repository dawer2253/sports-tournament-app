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
export * from './board'
export * from './button'
export * from './crest'
export * from './form'
export * from './heads'
export * from './live'
export * from './match-board'
export * from './match-relation'
export * from './score-cell'
export * from './shell'
export * from './skeleton'
export * from './tournament-logo'

// Ekrany (dane w propsach).
export * from './screens/match'
export * from './screens/system'

// Logika, której potrzebuje strona (re-eksport, kod zostaje na miejscu).
export {
  BRAND_COLOR_SAMPLES,
  DEFAULT_BRAND_COLOR,
  brandVars,
  type BrandColorSample,
} from '../lib/brand-on-dark'
export { isModifiedClick } from '../lib/utils'
export { groupByRound } from '../components/data/round-groups'
export { bracketPosition } from '../lib/bracket'
export { plural } from '../lib/plural'
export { withQualifiers } from '../lib/qualifiers'
export { formatKickoff, formatMatchDay } from '../lib/kickoff'
export type { MatchPageData } from '../components/data/match-page-data'
