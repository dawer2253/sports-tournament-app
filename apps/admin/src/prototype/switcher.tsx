// PROTOTYP (#162) — pływający przełącznik wariantów i panel stanu. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SCENARIOS, sim, useScheduleState, type ScenarioKey } from './schedule-store';
import { VARIANTS, useScheduleVariant } from './variant';

export function PrototypeSwitcher() {
  const variant = useScheduleVariant();
  const navigate = useNavigate();
  const location = useLocation();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  function go(step: number) {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    const params = new URLSearchParams(location.search);
    params.set('variant', next.key);
    // Strona meczu istnieje tylko w A, więc przełączenie wraca na listę.
    const path = location.pathname.replace(/\/matches\/\d+$/, '');
    void navigate(`${path}?${params}`, { replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
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
  const s = useScheduleState();
  const [open, setOpen] = useState(false);
  const played = s.matches.filter((m) => m.status === 'finished').length;
  const live = s.matches.filter((m) => m.status === 'live').length;
  const undated = s.matches.filter((m) => !m.kickoffAt).length;

  return (
    <div className="fixed bottom-4 left-2 z-50 w-56 rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500">
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP · {SCENARIOS.find((x) => x.key === s.scenario)?.name} <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Scenariusz
            <select
              className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
              value={s.scenario}
              onChange={(e) => sim.scenario(e.target.value as ScenarioKey)}
            >
              {SCENARIOS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={!s.allowsDraw} onChange={sim.toggleDraw} /> sport bez remisów
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={s.failNext} onChange={sim.toggleFail} /> następny zapis → 500
            </label>
            <label className="flex items-center gap-1">
              opóźnienie
              <select className="rounded bg-zinc-800 px-1" value={s.latencyMs} onChange={(e) => sim.latency(Number(e.target.value))}>
                {[0, 600, 2000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms} ms
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="font-mono text-zinc-400">
            faza {s.stage.type} · drużyn {s.teams.length} · kolejek {s.rounds.length} · meczów {s.matches.length}
            <br />
            zakończ. {played} · trwa {live} · bez terminu {undated} · matchDuration {s.matchDuration}′
          </div>
          <div className="max-h-28 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-zinc-300">
            {s.log.length === 0 ? '— brak żądań —' : s.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
