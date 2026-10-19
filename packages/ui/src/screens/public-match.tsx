import { MatchHeader } from '../components/data/match-header'
import type { MatchPageData } from '../components/data/match-page-data'
import { MatchRelation } from '../components/data/match-relation'
import { BackLink } from '../components/layout/back-link'
import { Shell } from '../public/shell'
import {
  matchPageBasketball,
  matchPageFinished,
  matchPageLive,
  matchPageScheduled,
  publicBasketballTournament,
  publicTournament,
  scheduleTimeZone,
} from '../lib/demo-data'

/** Mecz makiety: piłka po meczu i na żywo, mecz zaplanowany, kosz po meczu. */
export type PublicMatchVariant = 'pilka' | 'na-zywo' | 'zaplanowany' | 'kosz'

const MATCHES: Record<PublicMatchVariant, MatchPageData> = {
  pilka: matchPageFinished,
  'na-zywo': matchPageLive,
  zaplanowany: matchPageScheduled,
  kosz: matchPageBasketball,
}

export interface PublicMatchProps {
  variant?: PublicMatchVariant
  /** Kolor turnieju: jasny (`#FFD400`, ciemny tekst) albo ciemny (`#1F7A45`, biały tekst). */
  color?: string
}

/**
 * Strona meczu (#210): powrót według stanu meczu, pas (`MatchHeader`)
 * i relacja (`MatchRelation`), w shellu strony publicznej (`Shell`) bez aktywnej zakładki.
 */
export function PublicMatch({ variant = 'pilka', color = '#1F7A45' }: PublicMatchProps) {
  const match = MATCHES[variant]
  const base = variant === 'kosz' ? publicBasketballTournament : publicTournament
  const tournament = { ...base, branding: { ...base.branding, primaryColor: color } }
  const back = match.status === 'scheduled' ? 'Terminarz' : 'Wyniki'

  return (
    <Shell tournament={tournament}>
      <div className="flex flex-col gap-3">
        <BackLink href="#">{back}</BackLink>
        <MatchHeader match={match} sport={tournament.sport.code} brandColor={color} timeZone={scheduleTimeZone} />
        <MatchRelation
          status={match.status}
          homeTeamId={match.homeTeam?.id ?? null}
          events={match.events}
          periods={match.periods}
          className="mx-auto mt-2 w-full max-w-3xl"
        />
      </div>
    </Shell>
  )
}
