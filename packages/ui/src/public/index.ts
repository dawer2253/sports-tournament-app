// Wejście strony publicznej: `import { Shell, Crest } from '@tournament/ui/public'`.
// Nazwy bez przedrostka. Arkusz motywu doładowuje się osobno:
// `@import "@tournament/ui/public/theme.css"` (po `@tournament/ui/styles.css`).
//
// Barrel panelu (`src/index.ts`) tego katalogu nie re-eksportuje. Logika wspólna
// z panelem zostaje tam, gdzie jest; tu idzie tylko jej re-eksport.

export * from './public-nav'
export * from './public-shell-tournament'

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
