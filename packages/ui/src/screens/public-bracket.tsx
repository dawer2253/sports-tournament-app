import { BracketTree } from '../components/data/bracket-tree'
import { CUP_TABS } from '../public/public-nav'
import { PublicShell, type PublicShellTournament } from '../components/layout/public-shell'
import { demoBracket, publicCupTournament, scheduleTimeZone, type DemoBracketMatch } from '../lib/demo-data'

export interface PublicBracketProps {
  /** Komplet meczów fazy `knockout`, jak `GET /public/t/{slug}/matches?stageId=`. */
  matches?: DemoBracketMatch[]
  tournament?: PublicShellTournament
  /** Sport z remisem: pole wyniku kafla ma miejsce na karne. */
  penaltySlot?: boolean
}

/** Puchar 16 drużyn w trakcie ćwierćfinałów: jeden ćwierćfinał trwa. */
const DEFAULT_MATCHES = demoBracket({ teams: 16, progress: { round: 3, finished: 2, live: 1 } })

/**
 * Drabinka strony publicznej (#234): zakładka pucharu z drzewem w oknie rund
 * (`BracketTree`). Strona przewija się tylko w dół, także na telefonie.
 */
export function PublicBracket({ matches = DEFAULT_MATCHES, tournament = publicCupTournament, penaltySlot = true }: PublicBracketProps) {
  return (
    <PublicShell tournament={tournament} active="bracket" tabs={CUP_TABS}>
      <BracketTree
        matches={matches}
        penaltySlot={penaltySlot}
        timeZone={scheduleTimeZone}
        matchHref={(match) => `/t/${tournament.slug}/mecze/${match.id}`}
      />
    </PublicShell>
  )
}
