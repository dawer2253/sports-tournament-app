// PROTOTYP (#252) — pływający przełącznik wariantów i panel stanu turnieju. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CONFIGS, SCENARIOS, phase, proto, useDemo, useProto, type ConfigKey, type ScenarioKey, type Sport } from './demo';
import { VARIANTS, useVariant } from './variant';

export function PrototypeSwitcher() {
  const variant = useVariant();
  const navigate = useNavigate();
  const location = useLocation();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  function go(step: number) {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!;
    const params = new URLSearchParams(location.search);
    params.set('variant', next.key);
    // Parametry wariantu nie przechodzą między wariantami.
    for (const key of ['grupa', 'czesc', 'od']) params.delete(key);
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
            {variant}: {VARIANTS[index]!.name}
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
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const select = 'mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white';
  const live = [...demo.groupMatches, ...demo.knockout].filter((m) => m.status === 'live').length;

  return (
    <div
      data-prototype
      className="fixed right-2 bottom-14 z-[100] w-64 max-w-[calc(100vw-1rem)] rounded-xl bg-zinc-900 p-2 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500"
    >
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP #252: stan turnieju <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Moment turnieju
            <select className={select} value={s.scenario} onChange={(e) => proto.set({ scenario: e.target.value as ScenarioKey })}>
              {SCENARIOS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Grupy
            <select className={select} value={s.config} onChange={(e) => proto.set({ config: e.target.value as ConfigKey })}>
              {CONFIGS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Sport
            <select className={select} value={s.sport} onChange={(e) => proto.set({ sport: e.target.value as Sport })}>
              <option value="football">piłka nożna (remisy, karne w playoffie)</option>
              <option value="basketball">koszykówka (bez remisów)</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={s.longNames} onChange={(e) => proto.set({ longNames: e.target.checked })} />
            długie nazwy drużyn
          </label>
          <div className="rounded bg-black/40 p-1.5 font-mono text-[10px] leading-snug text-zinc-300">
            faza: {phase(demo)}, grupy: {demo.groups.map((g) => `${g.name.replace('Grupa ', '')}(${g.teamIds.length}→${g.qualifiers})`).join(' ')}
            <br />
            mecze grup: {demo.groupMatches.filter((m) => m.status === 'finished').length}/{demo.groupMatches.length}, playoff:{' '}
            {demo.knockout.filter((m) => m.status === 'finished').length}/{demo.knockout.length}
            <br />
            na żywo: {live}, karne: {demo.knockout.filter((m) => m.homePenalties !== null).length}, rozjazd z tabelą: {demo.divergence.length}
          </div>
        </div>
      )}
    </div>
  );
}
