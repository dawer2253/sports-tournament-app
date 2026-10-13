import { Trophy } from 'lucide-react'
import { cn } from '../../lib/utils'
import { TeamLogo } from '../layout/team-logo'
import { EmptyState } from '../ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { Leaderboard } from './leaderboard-row'

/** Pusty stan klasyfikacji: przed pierwszym meczem zakończonym nie ma wierszy. */
export const LEADERBOARD_EMPTY = 'Klasyfikacja ruszy po pierwszym zakończonym meczu'

export interface LeaderboardTableProps {
  leaderboard: Leaderboard
}

/**
 * Pełna klasyfikacja strony publicznej (#207): miejsce, zawodnik z drużyną
 * pod nazwiskiem i wartość, której nagłówek to `label` odpowiedzi. Trzy
 * kolumny mieszczą się na telefonie, więc drużyna nie ma osobnej.
 *
 * Zawodnicy z tą samą wartością dzielą miejsce i tworzą blok, który od reszty
 * oddziela grubsza linia — jak drużyny z równymi punktami w `StandingsTable`.
 */
export function LeaderboardTable({ leaderboard }: LeaderboardTableProps) {
  const { label, rows } = leaderboard

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Trophy />}
        title={LEADERBOARD_EMPTY}
        description="Liczą się zdarzenia z meczów zakończonych, ze wszystkich faz turnieju."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:bg-muted/60 [&_tr]:hover:bg-muted/60">
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Zawodnik</TableHead>
            <TableHead className="w-24 text-right text-foreground!">{label}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.player.id}
              className={cn(index > 0 && rows[index - 1]!.value !== row.value && 'border-t-2 border-t-border')}
            >
              <TableCell
                className={cn(
                  'text-right font-semibold tabular-nums',
                  row.position === 1 ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {row.position}
              </TableCell>
              <TableCell>
                {/* Zawodnik i drużyna to hierarchia, nie równorzędna para —
                    niesie ją układ i kontrast, nie znak między nimi. */}
                <span className="flex min-w-0 items-center gap-2">
                  <TeamLogo logoUrl={row.team.logoUrl} name={row.team.name} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.player.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.team.name}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right text-base font-bold tabular-nums">{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
