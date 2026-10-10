// PROTOTYP (#163) — tabela ligi wspólna dla wariantów. Warianty różnią się
// miejscem tabeli i edycją kryteriów, nie samą tabelą. Nie do main.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@tournament/ui';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Row, Separator, TiebreakerCode } from './standings-data';

export type Labels = Record<TiebreakerCode, string>;

export function separatorLabel(sep: Separator, labels: Labels): string {
  return sep === 'name' ? 'Nazwa drużyny' : labels[sep];
}

/** „Punkty w tabeli → Bezpośredni mecz → … → nazwa drużyny” (pytanie z #160 pkt 7). */
export function CriteriaSentence({
  tiebreakers,
  labels,
  className,
}: {
  tiebreakers: TiebreakerCode[];
  labels: Labels;
  className?: string;
}) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Kolejność: {tiebreakers.map((c) => labels[c].toLocaleLowerCase('pl')).join(' → ')} → nazwa drużyny
      (alfabetycznie).
    </p>
  );
}

export function StandingsTable({
  rows,
  scoreLabel,
  allowsDraw,
  labels,
  showSeparators,
  previousPositions,
  compact,
}: {
  rows: Row[];
  scoreLabel: string;
  allowsDraw: boolean;
  labels: Labels;
  showSeparators: boolean;
  /** Pozycje według zapisanych kryteriów; podane pokazują strzałki zmiany (podgląd). */
  previousPositions?: Map<number, number>;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <Table className={cn(compact && '[&_td]:py-1.5')}>
        {/* Nagłówek odcięty od wierszy jak w `public-standings`: tło, wersaliki, drobniejszy krój (#163). */}
        <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Drużyna</TableHead>
            <TableHead className="w-10 text-center" title="Mecze">
              M
            </TableHead>
            <TableHead className="w-10 text-center" title="Wygrane">
              W
            </TableHead>
            {allowsDraw && (
              <TableHead className="w-10 text-center" title="Remisy">
                R
              </TableHead>
            )}
            <TableHead className="w-10 text-center" title="Porażki">
              P
            </TableHead>
            <TableHead className="w-20 text-center">{scoreLabel}</TableHead>
            <TableHead className="w-12 text-center" title="Bilans">
              +/−
            </TableHead>
            <TableHead className="w-12 text-center !text-foreground">Pkt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const before = previousPositions?.get(r.team.id);
            const delta = before === undefined ? 0 : before - r.position;
            return (
              <TableRow
                key={r.team.id}
                className={cn(
                  // Granica grupy punktowej: remisujące drużyny czyta się jako blok.
                  r.separatedBy === 'points' && 'border-t-2 border-t-border',
                  delta !== 0 && 'bg-amber-50 dark:bg-amber-950/30',
                )}
              >
                <TableCell className="text-right font-semibold tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    {delta > 0 && <ArrowUp className="size-3 text-emerald-600" aria-label={`w górę o ${delta}`} />}
                    {delta < 0 && <ArrowDown className="size-3 text-rose-600" aria-label={`w dół o ${-delta}`} />}
                    {r.position}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex flex-wrap items-center gap-2">
                    {r.team.name}
                    {showSeparators && r.separatedBy && r.separatedBy !== 'points' && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px] font-normal',
                          r.separatedBy === 'name'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                            : 'bg-muted text-muted-foreground',
                        )}
                        title="Kryterium, które ustawiło drużynę niżej od poprzedniej przy równych punktach"
                      >
                        ↑ {separatorLabel(r.separatedBy, labels).toLocaleLowerCase('pl')}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{r.played}</TableCell>
                <TableCell className="text-center tabular-nums">{r.won}</TableCell>
                {allowsDraw && <TableCell className="text-center tabular-nums">{r.drawn}</TableCell>}
                <TableCell className="text-center tabular-nums">{r.lost}</TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {r.scoreFor}:{r.scoreAgainst}
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {r.scoreDifference > 0 ? `+${r.scoreDifference}` : r.scoreDifference}
                </TableCell>
                <TableCell className="text-center font-bold tabular-nums">{r.points}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
