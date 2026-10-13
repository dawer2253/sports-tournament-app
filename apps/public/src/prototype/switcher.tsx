// PROTOTYP (#218) — pływający przełącznik wariantów i panel stanu. Nie do main.
import { bracketSize } from '@tournament/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TEAM_COUNTS, proto, stageOptions, teamsAlive, useBracket, useProto, type Sport } from './demo';
import { VARIANTS, useBracketVariant } from './variant';

export function PrototypeSwitcher() {
  const variant = useBracketVariant();
  const navigate = useNavigate();
  const location = useLocation();
  const index = VARIANTS.findIndex((v) => v.key === variant);
  const onBracket = location.pathname.endsWith('/drabinka');

  function go(step: number) {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    const params = new URLSearchParams(location.search);
    params.set('variant', next.key);
    // Parametry wariantu (runda, okno, część) nie przechodzą między wariantami.
    for (const key of ['runda', 'od', 'czesc', 'druzyna']) params.delete(key);
    void navigate(`${location.pathname}?${params}`, { replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable], [role="tablist"]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <>
      <div
        data-prototype
        className="fixed bottom-3 left-1/2 z-[100] max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-zinc-900 px-2 py-1.5 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500"
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Poprzedni wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronLeft className="size-4" />
          </button>
          <span className="truncate font-semibold">
            {variant}: {VARIANTS[index].name}
            {!onBracket && <span className="font-normal text-zinc-400"> (widać w Drabince)</span>}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Następny wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <StatePanel />
    </>
  );
}

function StatePanel() {
  const s = useProto();
  const bracket = useBracket();
  const [open, setOpen] = useState(false);
  const select = 'mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white';

  return (
    <div data-prototype className="fixed right-2 bottom-14 z-[100] w-60 rounded-xl bg-zinc-900 p-2 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500">
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP #218: {s.teams} drużyn <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Liczba drużyn
            <select className={select} value={s.teams} onChange={(e) => proto.set({ teams: Number(e.target.value) })}>
              {TEAM_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count} (drabinka na {bracketSize(count)}
                  {bracketSize(count) > count ? `, ${bracketSize(count) - count} wolnych losów` : ''})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Stan turnieju
            <select className={select} value={s.stage} onChange={(e) => proto.set({ stage: e.target.value })}>
              {stageOptions(s.teams).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Sport
            <select className={select} value={s.sport} onChange={(e) => proto.set({ sport: e.target.value as Sport })}>
              <option value="football">piłka nożna (remis → karne)</option>
              <option value="basketball">koszykówka (bez remisów)</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={s.thirdPlace} onChange={(e) => proto.set({ thirdPlace: e.target.checked })} />
            mecz o 3. miejsce
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={s.longNames} onChange={(e) => proto.set({ longNames: e.target.checked })} />
            długie nazwy drużyn
          </label>
          <div className="rounded bg-black/40 p-1.5 font-mono text-[10px] leading-snug text-zinc-300">
            rundy: {bracket.rounds.length}, mecze: {bracket.matches.length}
            <br />
            wolne losy: {bracket.byes.length}, w grze: {teamsAlive(bracket)}
            <br />
            na żywo: {bracket.matches.filter((m) => m.status === 'live').length}, karne:{' '}
            {bracket.matches.filter((m) => m.homePenalties !== null).length}
            <br />
            bieżąca runda: {bracket.rounds[bracket.currentOrder - 1].name}
          </div>
        </div>
      )}
    </div>
  );
}
