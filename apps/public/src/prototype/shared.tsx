// PROTOTYP (#252) — wspólne klocki wariantów: shell, tabela grupy z linią
// wyjścia, wiersze meczów z grupą, pigułki. Nie do main.
import {
  Badge,
  Button,
  EmptyState,
  Heading,
  MatchRow,
  RoundSections,
  bracketPosition,
  cn,
  groupByRound,
  isModifiedClick,
  type MatchRowData,
} from '@tournament/ui';
import { PublicShell, type PublicNavKey } from '@tournament/ui/components/layout/public-shell.tsx';
import { CalendarDays } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BASE, GROUP_STAGE_ID, groupName, type Demo, type DemoGroup, type DemoMatch, type GroupRow } from './demo';
import { lastVariant } from './variant';

const PATHS: Record<PublicNavKey, string> = {
  home: '',
  standings: '/tabela',
  bracket: '/drabinka',
  fixtures: '/terminarz',
  results: '/wyniki',
  stats: '/statystyki',
};

export function tabPath(key: PublicNavKey, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ variant: lastVariant(), ...extra });
  return `${BASE}${PATHS[key]}?${params}`;
}

export function matchPath(id: number): string {
  return `${BASE}/mecze/${id}?variant=${lastVariant()}`;
}

export function ProtoShell({
  demo,
  active,
  tabs,
  labels,
  children,
}: {
  demo: Demo;
  active?: PublicNavKey;
  tabs: readonly PublicNavKey[];
  labels?: Partial<Record<PublicNavKey, string>>;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <PublicShell
      tournament={demo.shell}
      active={active}
      tabs={tabs}
      labels={labels}
      navHref={(key) => tabPath(key)}
      onNavigate={(key) => void navigate(tabPath(key))}
    >
      {children}
    </PublicShell>
  );
}

/** Odnośnik wewnątrz prototypu, przejmowany przez router. */
export function ProtoLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        void navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function TabButton({ tab, children }: { tab: PublicNavKey; children: ReactNode }) {
  return (
    <Button asChild variant="outline">
      <ProtoLink to={tabPath(tab)}>{children}</ProtoLink>
    </Button>
  );
}

// --- Pigułki -------------------------------------------------------------------

export function Pills<K extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors',
            item.key === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// --- Tabela grupy --------------------------------------------------------------

/**
 * Tabela grupy z linią wyjścia (`Group.qualifiers`, #250). `StandingsTable`
 * z DS nie zna linii, więc prototyp rysuje tabelę sam — to rzecz do DS
 * w tickecie wykonawczym. `compact` zostawia M, +/- i Pkt.
 */
export function GroupTable({
  demo,
  group,
  compact,
  title,
  marked,
}: {
  demo: Demo;
  group: DemoGroup;
  compact?: boolean;
  title?: ReactNode;
  /** Drużyny oznaczone ikoną drabinki (wariant C: kto naprawdę gra w playoffie). */
  marked?: ReadonlySet<number>;
}) {
  const rows = demo.tables.get(group.id)!;
  const head = 'px-1.5 py-2 text-center font-medium text-muted-foreground tabular-nums';
  const cell = 'px-1.5 py-2 text-center tabular-nums';
  return (
    <div className="space-y-2">
      {title}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-xs">
            <tr>
              <th className={cn(head, 'w-8 pl-3')}>#</th>
              <th className="px-1.5 py-2 text-left font-medium text-muted-foreground">Drużyna</th>
              <th className={cn(head, 'w-8')} title="Mecze">M</th>
              {!compact && (
                <>
                  <th className={cn(head, 'w-8')} title="Wygrane">W</th>
                  {demo.allowsDraw && <th className={cn(head, 'w-8')} title="Remisy">R</th>}
                  <th className={cn(head, 'w-8')} title="Porażki">P</th>
                  <th className={cn(head, 'hidden w-16 sm:table-cell')}>{demo.scoreLabel}</th>
                </>
              )}
              <th className={cn(head, 'w-10')} title="Różnica">+/-</th>
              <th className={cn(head, 'w-10 pr-3')}>Pkt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.team.id}
                className={cn(
                  'border-b last:border-b-0',
                  index === group.qualifiers - 1 && index < rows.length - 1 && 'border-b-2 border-dashed border-b-primary/50',
                )}
              >
                <td className={cn(cell, 'pl-3', row.qualifies && 'font-semibold text-primary')}>
                  <span className={cn('inline-block w-5 rounded', row.qualifies && 'bg-primary/10')}>{row.position}</span>
                </td>
                <td className="max-w-0 px-1.5 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{row.team.name}</span>
                    {marked?.has(row.team.id) && (
                      <span title="Gra w drabince" className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                        PLAYOFF
                      </span>
                    )}
                  </span>
                </td>
                <td className={cell}>{row.played}</td>
                {!compact && (
                  <>
                    <td className={cell}>{row.won}</td>
                    {demo.allowsDraw && <td className={cell}>{row.drawn}</td>}
                    <td className={cell}>{row.lost}</td>
                    <td className={cn(cell, 'hidden sm:table-cell')}>
                      {row.scoreFor}:{row.scoreAgainst}
                    </td>
                  </>
                )}
                <td className={cell}>{row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}</td>
                <td className={cn(cell, 'pr-3 font-semibold')}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Podpis linii wyjścia: kto wychodzi z grupy. */
export function ExitLegend({ group }: { group: DemoGroup }) {
  const word = group.qualifiers === 1 ? 'drużyna' : group.qualifiers < 5 ? 'drużyny' : 'drużyn';
  return (
    <p className="text-xs text-muted-foreground">
      Z grupy {group.qualifiers === 1 ? 'wychodzi' : 'wychodzą'} {group.qualifiers} {word} do drabinki — miejsca nad przerywaną linią.
    </p>
  );
}

export function GroupHeading({ group, aside }: { group: DemoGroup; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Heading level="section">{group.name}</Heading>
      {aside}
    </div>
  );
}

/** Drużyny nad linią w kolejności grup — „na dziś wychodzą”. */
export function aboveLine(demo: Demo, group: DemoGroup): GroupRow[] {
  return demo.tables.get(group.id)!.filter((row) => row.qualifies);
}

// --- Mecze ---------------------------------------------------------------------

/** Wiersz z pozycją w drabince (playoff) albo z grupą w miejscu etykiety (wariant B). */
export function withPosition(demo: Demo, match: DemoMatch, groupLabel = false): DemoMatch {
  if (match.groupId !== null) {
    if (!groupLabel) return match;
    return { ...match, bracket: { label: groupName(demo, match.groupId)!, penaltySlot: false } };
  }
  const position = bracketPosition(match.id, demo.knockout);
  return position ? { ...match, bracket: { ...position, penaltySlot: demo.allowsDraw } } : match;
}

export function byKickoff(matches: DemoMatch[]): DemoMatch[] {
  return matches.toSorted((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') || a.id - b.id);
}

/** Mecze turnieju po fazach: grupy, potem playoff — jak `stageOrder` w `useRounds`. */
export function allMatches(demo: Demo): DemoMatch[] {
  return [...demo.groupMatches, ...demo.knockout];
}

export function openMatches(demo: Demo): DemoMatch[] {
  return byKickoff(allMatches(demo).filter((match) => match.status !== 'finished'));
}

export function finishedMatches(demo: Demo): DemoMatch[] {
  return byKickoff(allMatches(demo).filter((match) => match.status === 'finished')).toReversed();
}

export function stageOrder(stageId: number): number {
  return stageId === GROUP_STAGE_ID ? 1 : 2;
}

/** Terminarz/Wyniki: `RoundSections` jak na stronie ligi, z grupą jako etykietą wiersza albo bez. */
export function RoundList({
  demo,
  matches,
  direction,
  empty,
  groupLabel,
}: {
  demo: Demo;
  matches: DemoMatch[];
  direction: 'asc' | 'desc';
  empty: string;
  groupLabel?: boolean;
}) {
  const navigate = useNavigate();
  const rounds = groupByRound(
    matches.map((match) => withPosition(demo, match, groupLabel)),
    { direction, stageOrder },
  );
  if (rounds.length === 0) return <EmptyState icon={<CalendarDays />} title={empty} />;
  return (
    <RoundSections
      rounds={rounds}
      statusDisplay="live"
      matchHref={(match) => matchPath(match.id)}
      onMatchNavigate={(match) => void navigate(matchPath(match.id))}
    />
  );
}

/** Jeden wiersz meczu, odnośnik na stronę meczu. */
export function Row({ demo, match, showDate = true }: { demo: Demo; match: DemoMatch; showDate?: boolean }) {
  const navigate = useNavigate();
  return (
    <MatchRow
      match={withPosition(demo, match) as MatchRowData}
      showDate={showDate}
      statusDisplay="live"
      href={matchPath(match.id)}
      onNavigate={() => void navigate(matchPath(match.id))}
    />
  );
}

export function GroupBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className="font-medium">
      {name}
    </Badge>
  );
}
