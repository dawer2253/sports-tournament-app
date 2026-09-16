import { Badge } from '../ui/badge'
import type { TournamentRow } from './tournament-row'

/**
 * Odznaka statusu turnieju. Status pokazują dwa widoki tej samej listy —
 * tabela turniejów i kafle dashboardu — więc etykieta i wariant mieszkają
 * w jednym miejscu: dwie kopie mapy rozjechałyby się na pierwszej nowej
 * wartości `status`.
 */
const STATUS: Record<
  TournamentRow['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: 'Szkic', variant: 'secondary' },
  active: { label: 'Trwa', variant: 'default' },
  finished: { label: 'Zakończony', variant: 'outline' },
}

export interface TournamentStatusBadgeProps {
  status: TournamentRow['status']
}

export function TournamentStatusBadge({ status }: TournamentStatusBadgeProps) {
  const { label, variant } = STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
