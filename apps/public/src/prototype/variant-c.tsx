// PROTOTYP (#218) — wariant C: mapa całej drabinki dopasowana do szerokości
// ekranu (mecz to kreska w kolorze stanu), podzielona na części po 16
// drużyn i fazę finałową. Pod mapą szczegół wybranej części: na telefonie
// lista po rundach, na komputerze drzewo. Nie do main.
import { Input, cn, teamAbbr } from '@tournament/ui';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { teamPath, winnerSide, type ProtoBracket, type ProtoMatch, type ProtoRound, type Slot } from './demo';
import { ByeTile, ChampionTile, LiveDot, MatchTile, Tree, useElementWidth } from './shared';

/** Część drabinki: poddrzewo 8 meczów pierwszej rundy (16 drużyn) albo faza finałowa. */
type Section = {
  key: string;
  name: string;
  /** Indeksy rund (od 0) w tej części. */
  rounds: ProtoRound[];
  range?: [number, number];
  final: boolean;
};

const SECTION_SLOTS = 8;
const SECTION_ROUNDS = 4;

function buildSections(bracket: ProtoBracket): Section[] {
  const rounds = bracket.rounds;
  if (rounds.length <= SECTION_ROUNDS) return [{ key: 'all', name: 'Cała drabinka', rounds, final: true }];
  const count = rounds[0].slots.length / SECTION_SLOTS;
  const parts: Section[] = Array.from({ length: count }, (_, s) => ({
    key: String.fromCharCode(97 + s),
    name: `Część ${String.fromCharCode(65 + s)}`,
    rounds: rounds.slice(0, SECTION_ROUNDS),
    range: [s * SECTION_SLOTS, (s + 1) * SECTION_SLOTS],
    final: false,
  }));
  return [...parts, { key: 'final', name: 'Faza finałowa', rounds: rounds.slice(SECTION_ROUNDS), final: true }];
}

function sectionOf(sections: Section[], match: ProtoMatch): Section {
  if (sections.length === 1) return sections[0];
  const r = match.round.order - 1;
  if (match.third || r >= SECTION_ROUNDS) return sections[sections.length - 1];
  return sections[Math.floor(((match.matchNumber - 1) * 2 ** r) / SECTION_SLOTS)] ?? sections[0];
}

function sectionMatches(section: Section): ProtoMatch[] {
  return section.rounds.flatMap((round, j) => {
    const [from, to] = section.range ?? [0, round.slots.length * 2 ** j];
    const slots = round.slots.slice(Math.floor(from / 2 ** j), Math.max(Math.floor(from / 2 ** j) + 1, Math.round(to / 2 ** j)));
    return [...slots.flatMap((slot) => (slot.kind === 'match' ? [slot.match] : [])), ...(section.final && round.third ? [round.third] : [])];
  });
}

// --- Mapa --------------------------------------------------------------------

function fillFor(match: ProtoMatch, highlighted: boolean): string {
  if (highlighted) return 'fill-primary stroke-primary';
  if (match.status === 'live') return 'fill-destructive stroke-destructive animate-pulse';
  if (match.status === 'finished') return 'fill-foreground/55 stroke-foreground/55';
  if (match.homeTeam && match.awayTeam) return 'fill-card stroke-foreground/60';
  return 'fill-muted stroke-muted-foreground/40';
}

function BracketMap({
  bracket,
  sections,
  selected,
  onSelect,
  width,
  highlight,
}: {
  bracket: ProtoBracket;
  sections: Section[];
  selected: string;
  onSelect: (key: string) => void;
  width: number;
  highlight: Set<number>;
}) {
  const rounds = bracket.rounds;
  const R = rounds.length;
  const m1 = rounds[0].slots.length;
  const u = Math.max(6, Math.min(44, Math.floor(420 / m1)));
  const col = width / (R + 0.7);
  const rectW = col * 0.74;
  const rectH = Math.max(4, Math.round(u * 0.72));
  const withText = u >= 30;
  const cy = (j: number, p: number) => p * 2 ** j * u + ((2 ** j - 1) * u) / 2 + u / 2;
  const finalY = cy(R - 1, 0);
  const thirdY = finalY + rectH + Math.max(14, rectH);
  const height = Math.max(m1 * u, rounds[R - 1].third ? thirdY + rectH / 2 + 14 : 0);
  const finalX = (SECTION_ROUNDS - 0.13) * col;

  const label = (match: ProtoMatch) => {
    const side = (team: ProtoMatch['homeTeam'], score: number | null) => `${team ? teamAbbr(team.name) : '?'}${score !== null ? ` ${score}` : ''}`;
    return [side(match.homeTeam, match.homeScore), side(match.awayTeam, match.awayScore)];
  };

  function rect(match: ProtoMatch, x: number, y: number, key: string) {
    const [home, away] = label(match);
    return (
      <g key={key} className="pointer-events-none">
        <rect x={x} y={y - rectH / 2} width={rectW} height={rectH} rx={Math.min(4, rectH / 3)} className={cn('stroke-1', fillFor(match, highlight.has(match.id)))} />
        {withText && (
          <text
            x={x + 4}
            y={y - 2}
            className={cn('text-[9px] font-medium', match.status === 'finished' || highlight.has(match.id) ? 'fill-background' : 'fill-foreground')}
          >
            <tspan x={x + 4}>{home}</tspan>
            <tspan x={x + 4} dy={11}>
              {away}
            </tspan>
          </text>
        )}
      </g>
    );
  }

  const bands = sections.map((section) => {
    const isSel = section.key === selected;
    const box = section.range
      ? { x: -3, y: section.range[0] * u, w: finalX + 3, h: (section.range[1] - section.range[0]) * u }
      : sections.length === 1
        ? { x: -3, y: 0, w: width + 6, h: height }
        : { x: finalX, y: 0, w: width - finalX + 3, h: height };
    return (
      <rect
        key={section.key}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={6}
        role="button"
        aria-label={section.name}
        onClick={() => onSelect(section.key)}
        className={cn(
          'cursor-pointer',
          isSel && sections.length > 1 ? 'fill-primary/12 stroke-primary/60' : 'fill-transparent stroke-transparent',
          !isSel && 'hover:fill-muted',
        )}
      />
    );
  });

  const marks: ReactNode[] = [];
  const lines: string[] = [];
  rounds.forEach((round, j) => {
    const x = j * col;
    round.slots.forEach((slot: Slot, p) => {
      const y = cy(j, p);
      if (slot.kind === 'bye') {
        marks.push(
          <rect
            key={`bye-${p}`}
            x={x}
            y={y - rectH / 2}
            width={rectW}
            height={rectH}
            rx={Math.min(4, rectH / 3)}
            className="pointer-events-none fill-none stroke-muted-foreground/40 [stroke-dasharray:2_2]"
          />,
        );
      } else marks.push(rect(slot.match, x, y, `m-${slot.match.id}`));
      if (j < R - 1 && p % 2 === 0) {
        const y2 = cy(j, p + 1);
        const xm = x + rectW + (col - rectW) / 2;
        lines.push(`M${x + rectW} ${y} H${xm} V${y2} H${x + rectW} M${xm} ${(y + y2) / 2} H${x + col}`);
      }
    });
    if (round.third) {
      marks.push(rect(round.third, x, thirdY, 'third'));
      marks.push(
        <text key="third-label" x={x + rectW / 2} y={thirdY + rectH / 2 + 10} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[9px]">
          o 3. miejsce
        </text>,
      );
    }
  });

  // Puchar za finałem.
  const tx = R * col + col * 0.08;
  lines.push(`M${(R - 1) * col + rectW} ${finalY} H${tx}`);
  const trophyR = Math.max(6, Math.min(12, rectH / 2 + 2));

  return (
    <svg width={width} height={height} viewBox={`-3 0 ${width + 6} ${height}`} className="block overflow-visible" role="group" aria-label="Mapa drabinki">
      {bands}
      <path d={lines.join(' ')} className="pointer-events-none fill-none stroke-muted-foreground/40" strokeWidth={1} />
      {marks}
      <circle
        cx={tx + trophyR}
        cy={finalY}
        r={trophyR}
        className={cn('pointer-events-none', bracket.champion ? 'fill-brand' : 'fill-none stroke-muted-foreground/50 [stroke-dasharray:2_2]')}
      />
      {bracket.champion && withText && (
        <text x={tx + trophyR} y={finalY + trophyR + 11} textAnchor="middle" className="pointer-events-none fill-foreground text-[9px] font-semibold">
          {teamAbbr(bracket.champion.name)}
        </text>
      )}
    </svg>
  );
}

function Legend() {
  const item = (className: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-4 rounded-sm border', className)} />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {item('border-foreground/55 bg-foreground/55', 'rozegrany')}
      {item('border-destructive bg-destructive', 'na żywo')}
      {item('border-foreground/60 bg-card', 'zaplanowany')}
      {item('border-muted-foreground/40 bg-muted', 'czeka na rywali')}
      {item('border-dashed border-muted-foreground/50', 'wolny los')}
    </div>
  );
}

// --- Szczegół części -----------------------------------------------------------

function SectionList({ section, bracket }: { section: Section; bracket: ProtoBracket }) {
  return (
    <div className="space-y-5">
      {section.rounds.map((round, j) => {
        const [from, to] = section.range ?? [0, section.rounds[0].slots.length];
        const start = Math.floor(from / 2 ** j);
        const slots = round.slots.slice(start, start + Math.max(1, Math.round((to - from) / 2 ** j)));
        const final = round.order === bracket.rounds.length;
        return (
          <section key={round.id} aria-label={round.name} className="space-y-2">
            <h3 className="text-sm font-semibold">{round.name}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot, i) => (slot.kind === 'bye' ? <ByeTile key={i} team={slot.team} /> : <MatchTile key={i} match={slot.match} />))}
            </div>
            {final && bracket.champion && <ChampionTile team={bracket.champion} />}
            {final && round.third && (
              <>
                <h3 className="pt-2 text-sm font-semibold">Mecz o 3. miejsce</h3>
                <MatchTile match={round.third} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function VariantC({ bracket }: { bracket: ProtoBracket }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [params, setParams] = useSearchParams();
  const sections = buildSections(bracket);
  const query = params.get('druzyna') ?? '';
  const needle = query.trim().toLocaleLowerCase('pl');
  const team = needle.length >= 2 ? bracket.teams.find((t) => t.name.toLocaleLowerCase('pl').includes(needle)) : undefined;
  const path = team ? teamPath(bracket, team.id) : [];
  const highlight = new Set(path.map((m) => m.id));

  const live = bracket.matches.find((m) => m.status === 'live');
  const pending = bracket.rounds[bracket.currentOrder - 1].matches.find((m) => m.status !== 'finished');
  const fallback = sectionOf(sections, live ?? pending ?? bracket.rounds[bracket.rounds.length - 1].matches[0]);
  const teamSection = path.length > 0 ? sectionOf(sections, path[path.length - 1]) : undefined;
  const selected = sections.find((s) => s.key === params.get('czesc')) ?? teamSection ?? fallback;

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const matches = sectionMatches(selected);
  const finished = matches.filter((m) => m.status === 'finished').length;
  const root = selected.final ? null : selected.rounds[selected.rounds.length - 1].slots[(selected.range?.[0] ?? 0) / SECTION_SLOTS];
  const rootWinner = root?.kind === 'match' ? winnerSide(root.match) : null;
  const rootMatch = root?.kind === 'match' ? root.match : null;
  const wide = width >= 760;

  return (
    <div ref={ref} className="space-y-4">
      <label className="relative block">
        <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">Znajdź drużynę</span>
        <Input
          value={query}
          onChange={(e) => set({ druzyna: e.target.value, czesc: null })}
          placeholder="Znajdź drużynę: podświetli jej drogę"
          className="bg-card pl-9"
        />
      </label>
      {team && (
        <p className="text-sm">
          <span className="font-semibold">{team.name}</span>: {path.length} {path.length === 1 ? 'mecz' : 'mecze'} w drabince.
        </p>
      )}

      <div className="rounded-xl border bg-card p-3">
        {width > 0 && (
          <BracketMap
            bracket={bracket}
            sections={sections}
            selected={selected.key}
            onSelect={(key) => set({ czesc: key })}
            width={width - 26}
            highlight={highlight}
          />
        )}
        <div className="mt-3">
          <Legend />
        </div>
      </div>

      {sections.length > 1 && (
        <div role="tablist" aria-label="Części drabinki" className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
          {sections.map((section) => {
            const ms = sectionMatches(section);
            const isLive = ms.some((m) => m.status === 'live');
            const active = section.key === selected.key;
            return (
              <button
                key={section.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => set({ czesc: section.key })}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-left text-xs',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-1 font-medium">
                  {section.name}
                  {isLive && <LiveDot />}
                </span>
                <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {ms.filter((m) => m.status === 'finished').length}/{ms.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <section aria-label={selected.name} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <p className="text-sm text-muted-foreground">
            {finished} z {matches.length} rozegranych
          </p>
        </div>
        {rootMatch && (
          <p className="text-sm text-muted-foreground">
            {rootWinner ? (
              <>
                <span className="font-medium text-foreground">{rootWinner === 'home' ? rootMatch.homeTeam?.name : rootMatch.awayTeam?.name}</span> wygrywa tę
                część i gra w fazie finałowej.
              </>
            ) : (
              <>Zwycięzca tej części ({rootMatch.label}) gra w fazie finałowej.</>
            )}
          </p>
        )}
        {wide ? (
          <Tree
            rounds={selected.rounds}
            range={selected.range}
            width={width}
            hasNext={!selected.final}
            champion={selected.final ? bracket.champion : null}
            highlight={highlight}
          />
        ) : (
          <SectionList section={selected} bracket={bracket} />
        )}
      </section>
    </div>
  );
}
