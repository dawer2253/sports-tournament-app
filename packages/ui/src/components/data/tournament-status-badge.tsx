import type { ReactNode } from 'react'
import { Badge } from '../ui/badge'
import type { TournamentRow } from './tournament-row'

const STATUS_BADGE: Record<
  TournamentRow['status'],
  { label: string; variant: 'destructive' | 'secondary' | 'outline'; icon?: ReactNode }
> = {
  draft: { label: 'Szkic', variant: 'secondary' },
  // Trwający turniej jest „na żywo”, więc tak jak mecz trwający (`MatchStatusBadge`)
  // i strona publiczna: czerwień z pulsującą kropką, nie zieleń marki.
  active: {
    label: 'Trwa',
    variant: 'destructive',
    icon: <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-destructive" />,
  },
  finished: { label: 'Zakończony', variant: 'outline' },
}

/**
 * Status turnieju jako etykieta. Wspólny dla listy turniejów i ekranu turnieju
 * w panelu, żeby ten sam status nie nazywał się w dwóch miejscach inaczej.
 */
export function TournamentStatusBadge({ status }: { status: TournamentRow['status'] }) {
  const badge = STATUS_BADGE[status]
  return (
    <Badge variant={badge.variant}>
      {badge.icon}
      {badge.label}
    </Badge>
  )
}
