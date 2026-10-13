// PROTOTYP (#218) — wariant B: drzewo z łącznikami w oknie rund. Kolumny mają
// stałą szerokość dopasowaną do ekranu (telefon: 2 rundy, komputer: do 4),
// a okno przesuwają pigułki, strzałki i gest w bok. Strona przewija się
// tylko w dół. Wzór: SofaScore i ESPN (#214, §2.2). Nie do main.
import { Button, cn } from '@tournament/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { type ProtoBracket, type ProtoRound } from './demo';
import { LiveDot, Tree, treeColumns, useElementWidth } from './shared';

function columnsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 860) return 3;
  return 4;
}

const live = (round: ProtoRound) => [...round.matches, ...(round.third ? [round.third] : [])].some((m) => m.status === 'live');

export function VariantB({ bracket }: { bracket: ProtoBracket }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const treeRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const rounds = bracket.rounds;
  const cols = Math.min(columnsFor(width), rounds.length);
  const maxStart = rounds.length - cols;
  const requested = params.get('od') ? Number(params.get('od')) - 1 : bracket.currentOrder - 1;
  const start = Math.max(0, Math.min(requested, maxStart));
  const visible = rounds.slice(start, start + cols);
  const hasNext = start + cols < rounds.length;

  // Kotwica przewijania: po przesunięciu okna ten sam fragment drabinki
  // zostaje na wysokości środka ekranu, choć kolumna jest krótsza albo dłuższa.
  const anchor = useRef<number | null>(null);
  function shift(nextStart: number) {
    const clamped = Math.max(0, Math.min(nextStart, maxStart));
    if (clamped === start) return;
    const rect = treeRef.current?.getBoundingClientRect();
    if (rect && rect.height > 0) {
      const mid = window.innerHeight / 2;
      anchor.current = Math.max(0, Math.min(1, (mid - rect.top) / rect.height));
    }
    const next = new URLSearchParams(params);
    next.set('od', String(clamped + 1));
    setParams(next, { replace: true });
  }
  useLayoutEffect(() => {
    const ratio = anchor.current;
    anchor.current = null;
    const rect = treeRef.current?.getBoundingClientRect();
    if (ratio === null || !rect) return;
    const target = rect.top + ratio * rect.height - window.innerHeight / 2;
    window.scrollBy({ top: target });
  }, [start]);

  // Gest w bok przesuwa okno o rundę; pion zostaje przeglądarce (`touch-action: pan-y`).
  const touch = useRef<{ x: number; y: number } | null>(null);

  const { colW, gap } = treeColumns(width, cols, hasNext);

  return (
    <div ref={ref} className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 pt-2 pb-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Wcześniejsza runda" disabled={start === 0} onClick={() => shift(start - 1)}>
            <ChevronLeft />
          </Button>
          <div role="tablist" aria-label="Rundy" className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
            {rounds.map((round, i) => {
              const inWindow = i >= start && i < start + cols;
              return (
                <button
                  key={round.id}
                  type="button"
                  role="tab"
                  aria-selected={inWindow}
                  aria-label={round.name}
                  onClick={() => shift(i)}
                  className={cn(
                    'relative h-8 rounded-md text-xs font-medium tabular-nums',
                    inWindow ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {round.short}
                  {live(round) && <LiveDot className="absolute top-1 right-1" />}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" aria-label="Następna runda" disabled={!hasNext} onClick={() => shift(start + 1)}>
            <ChevronRight />
          </Button>
        </div>
        {/* Nagłówki kolumn, wyrównane z kolumnami drzewa. */}
        <div className="mt-2 flex" style={{ gap }}>
          {visible.map((round) => (
            <div key={round.id} className="min-w-0" style={{ width: colW }}>
              <p className="truncate text-sm font-semibold">{round.name}</p>
              <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                {round.finished}/{round.total} rozegranych
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={treeRef}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const from = touch.current;
          touch.current = null;
          if (!from) return;
          const dx = e.changedTouches[0].clientX - from.x;
          const dy = e.changedTouches[0].clientY - from.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) shift(start + (dx < 0 ? 1 : -1));
        }}
      >
        <Tree rounds={visible} width={width} hasNext={hasNext} champion={hasNext ? null : bracket.champion} />
      </div>

      {bracket.byes.length > 0 && start === 0 && (
        <p className="text-xs text-muted-foreground">
          Przerywane pola w 1. rundzie to wolne losy: {bracket.byes.length} najwyżej rozstawionych drużyn zaczyna od 2. rundy.
        </p>
      )}
    </div>
  );
}
