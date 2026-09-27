import { Badge } from '../ui/badge'
import type { TournamentRow } from './tournament-row'

const STATUS_BADGE: Record<
  TournamentRow['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: 'Szkic', variant: 'secondary' },
  active: { label: 'Trwa', variant: 'default' },
  finished: { label: 'Zakończony', variant: 'outline' },
}

/**
 * Status turnieju jako etykieta. Wspólny dla listy turniejów i ekranu turnieju
 * w panelu, żeby ten sam status nie nazywał się w dwóch miejscach inaczej.
 */
export function TournamentStatusBadge({ status }: { status: TournamentRow['status'] }) {
  const badge = STATUS_BADGE[status]
  return <Badge variant={badge.variant}>{badge.label}</Badge>
}
