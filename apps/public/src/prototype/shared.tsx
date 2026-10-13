// PROTOTYP (#218) — wspólne klocki wariantów drabinki: shell pucharu, kafel
// meczu, drzewo z łącznikami. Nie do main.
import { cn } from '@tournament/ui';
import { PublicShell, type PublicNavKey } from '@tournament/ui/components/layout/public-shell.tsx';
import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BASE, TOURNAMENT, kickoffParts, useProto, winnerSide, type ProtoMatch, type ProtoRound, type ProtoTeam, type Slot } from './demo';
import { lastVariant } from './variant';

function isModifiedClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

const PATHS: Record<PublicNavKey, string> = {
  home: '',
  standings: '/tabela',
  bracket: '/drabinka',
  fixtures: '/terminarz',
  results: '/wyniki',
  stats: '/statystyki',
};

/** Puchar nie ma tabeli: Drabinka wchodzi na jej miejsce, zaraz po Przeglądzie. */
export const CUP_TABS: PublicNavKey[] = ['home', 'bracket', 'fixtures', 'results', 'stats'];

export function tabPath(key: PublicNavKey): string {
  return `${BASE}${PATHS[key]}${key === 'bracket' ? `?variant=${lastVariant()}` : ''}`;
}

export function matchPath(id: number): string {
  return `${BASE}/mecze/${id}`;
}

export function ProtoShell({ active, children }: { active?: PublicNavKey; children: ReactNode }) {
  const { sport } = useProto();
  const navigate = useNavigate();
  return (
    <PublicShell
      tournament={TOURNAMENT[sport]}
      active={active}
      tabs={CUP_TABS}
      navHref={tabPath}
      onNavigate={(key) => void navigate(tabPath(key))}
    >
      {children}
    </PublicShell>
  );
}

/** Cały kafel jest odnośnikiem na stronę meczu, jak `MatchRow` z `href` (#210). */
export function MatchLink({
  match,
  className,
  style,
  children,
}: {
  match: ProtoMatch;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const home = match.homeTeam?.name ?? match.homeSource ?? 'Do ustalenia';
  const away = match.awayTeam?.name ?? match.awaySource ?? 'Do ustalenia';
  return (
    <a
      href={matchPath(match.id)}
      aria-label={`${match.label}: ${home} – ${away}`}
      onClick={(event) => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        void navigate(matchPath(match.id));
      }}
      className={cn(
        'transition-colors hover:border-ring/60 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      style={style}
    >
      {children}
    </a>
  );
}

// --- Kafel meczu -------------------------------------------------------------

export const TILE_H = 52;

/**
 * Linia drużyny. Wysokość linii `leading-normal` mieści dolne wydłużenia
 * („y”, „ę”), które `truncate` przy `leading-none` obcinał.
 */
function TeamLine({ team, source, outcome }: { team: ProtoTeam | null; source?: string; outcome: 'won' | 'lost' | null }) {
  return (
    <span
      className={cn(
        'flex h-[22px] min-w-0 items-center leading-normal',
        !team && 'text-[11px] italic text-muted-foreground',
        outcome === 'won' && 'font-semibold',
        outcome === 'lost' && 'text-muted-foreground',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{team?.name ?? source ?? 'Do ustalenia'}</span>
    </span>
  );
}

/**
 * Wynik jednej drużyny w szarym polu: karne w nawiasie i wynik meczu, każde
 * w swojej kolumnie. Kolumna karnych stoi w każdym kaflu sportu z remisem,
 * także bez karnych, więc pole ma zawsze tę samą szerokość, a wynik to samo
 * miejsce. Zwycięzca ma pogrubiony wynik i karne.
 */
function ScoreLine({
  score,
  penalties,
  penaltySlot,
  outcome,
  live,
}: {
  score: number | null;
  penalties: number | null;
  penaltySlot: boolean;
  outcome: 'won' | 'lost' | null;
  live: boolean;
}) {
  return (
    <span
      className={cn(
        'grid h-[22px] items-center justify-end gap-0.5 leading-normal',
        penaltySlot ? 'grid-cols-[1.375rem_1.25rem]' : 'grid-cols-[1.75rem]',
      )}
    >
      {penaltySlot && (
        <span
          className={cn(
            'text-right text-[11px]',
            outcome === 'won' ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          {penalties !== null && `(${penalties})`}
        </span>
      )}
      <span
        className={cn(
          'text-right',
          outcome === 'won' && 'font-semibold',
          outcome === 'lost' && 'text-muted-foreground',
          live && 'font-semibold text-destructive',
        )}
      >
        {score ?? '–'}
      </span>
    </span>
  );
}

/**
 * Kafel meczu w dwóch liniach: drużyna na linię, wynik w szarym polu stałej
 * szerokości po prawej. Zaplanowany mecz ma tam termin, jak SofaScore. Karne
 * stoją w szarym polu w nawiasie przed wynikiem; w sporcie z remisem pole
 * zawsze ma na nie miejsce, w koszu (bez remisów) jest węższe.
 */
export function MatchTile({
  match,
  className,
  style,
  sources = true,
}: {
  match: ProtoMatch;
  className?: string;
  style?: CSSProperties;
  /** `false` w drzewie: skąd przyjdzie drużyna, pokazują łączniki, a podpis i tak by się uciął. */
  sources?: boolean;
}) {
  const winner = winnerSide(match);
  const outcome = (side: 'home' | 'away') => (winner === null ? null : winner === side ? 'won' : 'lost');
  const live = match.status === 'live';
  const when = kickoffParts(match.kickoffAt);
  // Karne istnieją tylko w sporcie z remisem (#216); w koszu pole ich nie rezerwuje.
  const penaltySlot = useProto().sport === 'football';
  return (
    <MatchLink
      match={match}
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-[13px] leading-none',
        live && 'border-destructive/70',
        className,
      )}
      style={{ height: TILE_H, ...style }}
    >
      {live && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-destructive" />}
      <span className="flex min-w-0 flex-col justify-center py-1 pr-1 pl-2.5">
        <TeamLine team={match.homeTeam} source={sources ? match.homeSource : undefined} outcome={outcome('home')} />
        <TeamLine team={match.awayTeam} source={sources ? match.awaySource : undefined} outcome={outcome('away')} />
      </span>
      <span
        className={cn(
          'flex shrink-0 flex-col justify-center border-l bg-muted/30 px-1.5 tabular-nums',
          penaltySlot ? 'w-14' : 'w-11',
        )}
      >
        {match.status === 'scheduled' ? (
          <span className="flex flex-col items-end gap-1 text-[11px] leading-none text-muted-foreground">
            <span>{when.day}</span>
            <span className="font-medium text-foreground">{when.time}</span>
          </span>
        ) : (
          <>
            <ScoreLine score={match.homeScore} penalties={match.homePenalties} penaltySlot={penaltySlot} outcome={outcome('home')} live={live} />
            <ScoreLine score={match.awayScore} penalties={match.awayPenalties} penaltySlot={penaltySlot} outcome={outcome('away')} live={live} />
          </>
        )}
      </span>
    </MatchLink>
  );
}

export function ByeTile({ team, className, style }: { team: ProtoTeam; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('flex flex-col justify-center rounded-lg border border-dashed px-2.5 text-[13px] leading-none text-muted-foreground', className)}
      style={{ height: TILE_H, ...style }}
    >
      <span className="truncate leading-normal">{team.name}</span>
      <span className="text-[11px] leading-normal italic">wolny los</span>
    </div>
  );
}

export function ChampionTile({ team, className, style }: { team: ProtoTeam; className?: string; style?: CSSProperties }) {
  return (
    <div role="status" className={cn('flex items-center gap-2.5 rounded-lg bg-brand p-2.5 text-brand-foreground', className)} style={style}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-foreground/15">
        <Trophy aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{team.name}</span>
        <span className="block text-[11px] text-brand-foreground/80">Zwycięzca pucharu</span>
      </span>
    </div>
  );
}

// --- Drzewo ------------------------------------------------------------------

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const GAP = 10;
const U = TILE_H + GAP;
const CONNECTOR = 22;

/** Środek miejsca `p` w kolumnie `j`: mecz stoi w połowie między parą, z której przychodzą drużyny. */
function center(j: number, p: number): number {
  return p * 2 ** j * U + ((2 ** j - 1) * U) / 2 + TILE_H / 2;
}

export interface TreeProps {
  /** Kolejne rundy widoczne jako kolumny. */
  rounds: ProtoRound[];
  /** Zakres miejsc pierwszej kolumny (część drabinki); domyślnie cała runda. */
  range?: [number, number];
  width: number;
  /** Czy za ostatnią kolumną jest jeszcze runda: rysuje wąsy do niej. */
  hasNext: boolean;
  champion?: ProtoTeam | null;
  /** Mecze do podświetlenia (ścieżka drużyny). */
  highlight?: Set<number>;
}

/**
 * Drzewo w kolumnach o stałej szerokości, dopasowanych do kontenera — nic nie
 * wystaje w bok. Pozycje liczone wprost z `matchNumber` (#215), łączniki pod
 * kątem prostym. Mecz o 3. miejsce i mistrz stoją pod finałem.
 */
export function Tree({ rounds, range, width, hasNext, champion, highlight }: TreeProps) {
  const cols = rounds.length;
  if (width === 0 || cols === 0) return null;
  const tail = hasNext ? CONNECTOR / 2 : 0;
  const colW = (width - (cols - 1) * CONNECTOR - tail) / cols;
  const [from, to] = range ?? [0, rounds[0].slots.length];
  const m0 = to - from;
  let height = m0 * U - GAP;

  const tiles: ReactNode[] = [];
  const lines: ReactNode[] = [];

  rounds.forEach((round, j) => {
    const x = j * (colW + CONNECTOR);
    const start = Math.floor(from / 2 ** j);
    const count = Math.max(1, Math.round(m0 / 2 ** j));
    const slots: Slot[] = round.slots.slice(start, start + count);
    slots.forEach((slot, p) => {
      const top = center(j, p) - TILE_H / 2;
      const style = { position: 'absolute', left: x, top, width: colW } as const;
      const key = `${round.id}-${start + p}`;
      if (slot.kind === 'bye') tiles.push(<ByeTile key={key} team={slot.team} style={style} />);
      else
        tiles.push(
          <MatchTile
            key={key}
            match={slot.match}
            sources={false}
            style={style}
            className={cn(highlight?.has(slot.match.id) && 'border-primary ring-2 ring-primary/60')}
          />,
        );
    });

    const drawsOut = j < cols - 1 || hasNext;
    if (drawsOut && slots.length >= 2) {
      for (let q = 0; q < slots.length / 2; q++) {
        const y1 = center(j, 2 * q);
        const y2 = center(j, 2 * q + 1);
        lines.push(
          <div
            key={`b-${round.id}-${q}`}
            aria-hidden
            className="absolute rounded-r-md border-y border-r border-muted-foreground/35"
            style={{ left: x + colW, top: y1, height: y2 - y1, width: CONNECTOR / 2 }}
          />,
        );
        if (j < cols - 1)
          lines.push(
            <div
              key={`h-${round.id}-${q}`}
              aria-hidden
              className="absolute border-t border-muted-foreground/35"
              style={{ left: x + colW + CONNECTOR / 2, top: (y1 + y2) / 2, width: CONNECTOR / 2 }}
            />,
          );
      }
    }

    // Pod finałem: mistrz i mecz o 3. miejsce.
    if (round.slots.length === 1) {
      let y = center(j, 0) + TILE_H / 2 + 14;
      if (champion) {
        tiles.push(<ChampionTile key="champion" team={champion} style={{ position: 'absolute', left: x, top: y, width: colW }} />);
        y += 52 + 14;
      }
      if (round.third) {
        tiles.push(
          <p key="third-label" className="absolute text-[11px] font-medium text-muted-foreground uppercase" style={{ left: x, top: y, width: colW }}>
            Mecz o 3. miejsce
          </p>,
        );
        tiles.push(
          <MatchTile key="third" match={round.third} sources={false} style={{ position: 'absolute', left: x, top: y + 18, width: colW }} />,
        );
        y += 18 + TILE_H;
      }
      height = Math.max(height, y);
    }
  });

  return (
    <div className="relative" style={{ height }}>
      {lines}
      {tiles}
    </div>
  );
}

/** Szerokość kolumny drzewa dla `cols` kolumn — do wyrównania nagłówków z kolumnami. */
export function treeColumns(width: number, cols: number, hasNext: boolean): { colW: number; gap: number } {
  const tail = hasNext ? CONNECTOR / 2 : 0;
  return { colW: (width - (cols - 1) * CONNECTOR - tail) / cols, gap: CONNECTOR };
}

export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-1.5 animate-pulse rounded-full bg-destructive', className)} />;
}
