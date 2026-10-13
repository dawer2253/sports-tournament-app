// PROTOTYP (#217) — pływający przełącznik wariantów i panel stanu drabinki. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SCENARIOS, sim, TEAM_COUNTS, useBracket, type ScenarioKey, type Sport } from './bracket-store';
import { VARIANTS, useBracketVariant } from './variant';

export function PrototypeSwitcher() {
  const variant = useBracketVariant();
  const navigate = useNavigate();
  const location = useLocation();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  function go(step: number) {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    const params = new URLSearchParams(location.search);
    params.set('variant', next.key);
    params.delete('round');
    void navigate(`${location.pathname}?${params}`, { replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable], [role="combobox"], [role="radiogroup"], [role="tablist"], [role="dialog"]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <>
      <div data-prototype className="pointer-events-auto fixed bottom-4 left-1/2 z-[100] max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} aria-label="Poprzedni wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-semibold">
            PROTOTYP {variant} · {VARIANTS[index].name}
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
  const s = useBracket();
  const [open, setOpen] = useState(true);
  const started = s.matches.filter((m) => m.status !== 'scheduled').length;

  return (
    <div data-prototype className="pointer-events-auto fixed bottom-16 left-2 z-[100] w-64 rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500 sm:bottom-4">
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP · stan drabinki <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Scenariusz
            <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.scenario} onChange={(e) => sim.scenario(e.target.value as ScenarioKey)}>
              {SCENARIOS.map((sc) => (
                <option key={sc.key} value={sc.key}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              Drużyn
              <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.teamCount} onChange={(e) => sim.teamCount(Number(e.target.value))}>
                {TEAM_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              Sport
              <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.sport} onChange={(e) => sim.sport(e.target.value as Sport)}>
                <option value="football">piłka (karne)</option>
                <option value="basketball">kosz (bez remisu)</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex items-center gap-1">
              opóźnienie
              <select className="rounded bg-zinc-800 px-1" value={s.latencyMs} onChange={(e) => sim.latency(Number(e.target.value))}>
                {[0, 300, 1500].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms} ms
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              następny zapis
              <select className="rounded bg-zinc-800 px-1" value={s.failNext} onChange={(e) => sim.failNext(e.target.value as 'none' | '500')}>
                <option value="none">OK</option>
                <option value="500">500</option>
              </select>
            </label>
          </div>
          <div className="flex gap-1">
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={sim.addTeam}>
              + drużyna
            </button>
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={sim.reset}>
              reset
            </button>
          </div>
          <div className="font-mono text-zinc-400">
            drużyn {s.teams.length} · meczów {s.matches.length} · rozpoczętych {started}
            <br />
            ostatnie rozstawienie: {s.lastSeeding ? s.lastSeeding.map((id) => id - 100).join(',') : '—'}
          </div>
          <div className="max-h-28 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-zinc-300">
            {s.log.length === 0 ? '— brak żądań —' : s.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
