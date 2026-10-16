// PROTOTYP (#251) — tabela grupy z linią wyjścia (#249, #250). Nie do main.
//
// `StandingsTable` z design systemu nie zna linii wyjścia z grupy ani plakietki
// „remis na linii", więc prototyp rysuje tabelę ręcznie. To jedna z rzeczy do
// dopisania w tickecie wykonawczym.
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@tournament/ui';
import type { ReactNode } from 'react';
import { TEAMS, plural } from '../lib/plural';
import { scoreLabel, standingsFor, useGroups, type Group } from './groups-store';
import { GroupBadge } from './shared';

export function GroupStandings({
  group,
  dense,
  control,
  footer,
}: {
  group: Group;
  dense?: boolean;
  /** Sterowanie liczbą wychodzących — wariant C stawia je przy tabeli. */
  control?: ReactNode;
  footer?: ReactNode;
}) {
  const state = useGroups();
  const rows = standingsFor(state, group);
  const allowsDraw = state.sport !== 'basketball';
  const columns = allowsDraw ? 8 : 7;
  const lastQualifierIndex = group.qualifiers - 1;

  return (
    <Card>
      <CardContent className={cn('overflow-x-auto', dense ? 'p-3' : 'p-4')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <GroupBadge name={group.name} />
          <span className="text-xs text-muted-foreground">
            wychodzi {group.qualifiers} z {group.teamIds.length}
          </span>
          {control && <div className="ml-auto">{control}</div>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Drużyna</TableHead>
              <TableHead className="w-10 text-center">M</TableHead>
              <TableHead className="w-10 text-center">W</TableHead>
              {allowsDraw && <TableHead className="w-10 text-center">R</TableHead>}
              <TableHead className="w-10 text-center">P</TableHead>
              <TableHead className="w-24 text-center">{scoreLabel(state.sport)}</TableHead>
              <TableHead className="w-12 text-center">+/-</TableHead>
              <TableHead className="w-12 text-center">Pkt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.team.id}
                className={cn(
                  row.qualifies && 'bg-primary/5',
                  index === lastQualifierIndex && 'border-b-2 border-dashed border-b-primary/40',
                )}
              >
                <TableCell className={cn('text-right tabular-nums', row.qualifies && 'border-l-2 border-l-primary font-semibold')}>
                  {row.position}
                </TableCell>
                <TableCell className="min-w-40">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.team.name}</span>
                    {row.tied && (
                      <span className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                        remis na linii
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{row.played}</TableCell>
                <TableCell className="text-center tabular-nums">{row.won}</TableCell>
                {allowsDraw && <TableCell className="text-center tabular-nums">{row.drawn}</TableCell>}
                <TableCell className="text-center tabular-nums">{row.lost}</TableCell>
                <TableCell className="text-center tabular-nums">
                  {row.scoreFor}:{row.scoreAgainst}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}
                </TableCell>
                <TableCell className="text-center font-semibold tabular-nums">{row.points}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns} className="text-center text-sm text-muted-foreground">
                  Grupa nie ma jeszcze drużyn.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/** Napis pod tabelą: kto wychodzi i jak rozstrzygnąć remis na linii (#250). */
export function QualificationLegend({ group }: { group: Group }) {
  const state = useGroups();
  const rows = standingsFor(state, group);
  const tied = rows.some((row) => row.tied);
  return (
    <p className="text-xs text-muted-foreground">
      Z grupy wychodzi {group.qualifiers} {plural(group.qualifiers, TEAMS)} — miejsca nad przerywaną linią.{' '}
      {tied
        ? 'Remis na linii rozstrzyga organizer: przy generowaniu drabinki podmienia drużynę na inną z tej samej grupy.'
        : 'Remis na linii rozstrzyga regulamin turnieju, a organizer potwierdza go przy generowaniu drabinki.'}
    </p>
  );
}
