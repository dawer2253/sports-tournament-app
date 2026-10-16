// PROTOTYP (#251) — pływający przełącznik wariantów i panel stanu fazy grupowej. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  SCENARIOS,
  TEAM_COUNTS,
  groupCountOptions,
  sim,
  useGroups,
  type ScenarioKey,
  type Sport,
} from './groups-store';
import { VARIANTS, useVariant } from './variant';

export function PrototypeSwitcher() {
  const variant = useVariant();
  const navigate = useNavigate();
  const location = useLocation();
  const index = VARIANTS.findIndex((v) => v.key === variant);

  function go(step: number) {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    const params = new URLSearchParams(location.search);
    params.set('variant', next.key);
    void navigate(`${location.pathname}?${params}`, { replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (
        el?.closest(
          'input, textarea, select, [contenteditable], [role="combobox"], [role="radiogroup"], [role="tablist"], [role="dialog"]',
        )
      )
        return;
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
        className="pointer-events-auto fixed bottom-4 left-1/2 z-[100] max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500"
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} aria-label="Poprzedni wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-semibold">
            PROTOTYP {variant}
            <span className="hidden sm:inline"> · {VARIANTS[index]!.name}</span>
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
  const s = useGroups();
  // Na telefonie panel zasłaniałby pół ekranu, więc startuje zwinięty.
  const [open, setOpen] = useState(() => window.innerWidth >= 640);
  const played = s.matches.filter((match) => match.status === 'finished').length;
  const qualified = s.groups.reduce((sum, group) => sum + group.qualifiers, 0);

  return (
    <div
      data-prototype
      className="pointer-events-auto fixed bottom-16 left-2 z-[100] w-64 rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500 sm:bottom-4"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between font-semibold text-white"
        onClick={() => setOpen(!open)}
      >
        PROTOTYP · stan fazy grupowej <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Scenariusz
            <select
              className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
              value={s.scenario}
              onChange={(event) => sim.scenario(event.target.value as ScenarioKey)}
            >
              {SCENARIOS.map((scenario) => (
                <option key={scenario.key} value={scenario.key}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              Drużyn
              <select
                className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
                value={s.teamCount}
                onChange={(event) => sim.teamCount(Number(event.target.value))}
              >
                {TEAM_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              Grup
              <select
                className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
                value={s.groupCount}
                onChange={(event) => sim.groupCount(Number(event.target.value))}
              >
                {groupCountOptions(s.teams.length).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex-1">
              Sport
              <select
                className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
                value={s.sport}
                onChange={(event) => sim.sport(event.target.value as Sport)}
              >
                <option value="football">piłka</option>
                <option value="basketball">kosz (bez remisu)</option>
              </select>
            </label>
            <label className="flex-1">
              Opóźnienie
              <select
                className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
                value={s.latencyMs}
                onChange={(event) => sim.latency(Number(event.target.value))}
              >
                {[0, 300, 1500].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms} ms
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex items-center gap-1">
              następny zapis
              <select
                className="rounded bg-zinc-800 px-1"
                value={s.failNext}
                onChange={(event) => sim.failNext(event.target.value as 'none' | '500')}
              >
                <option value="none">OK</option>
                <option value="500">500</option>
              </select>
            </label>
          </div>
          <div className="flex gap-1">
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={() => sim.draw(s.groupCount)}>
              losuj grupy
            </button>
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={sim.addTeam}>
              + drużyna
            </button>
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={sim.reset}>
              reset
            </button>
          </div>
          <div className="font-mono break-all text-zinc-400">
            drużyn {s.teams.length} · grup {s.groups.length} · meczów {s.matches.length} (grane {played})
            <br />
            wychodzi z grup: {qualified || '—'} · drabinka: {s.knockout.length || '—'}
            <br />
            {s.draftDirty && <span className="text-amber-400">szkic składu niezapisany</span>}
            {s.extraTeam && <span className="text-amber-400"> · {s.extraTeam.name} bez grupy</span>}
          </div>
          <div className="max-h-28 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-zinc-300">
            {s.log.length === 0 ? '— brak żądań —' : s.log.map((line, index) => <div key={index}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
