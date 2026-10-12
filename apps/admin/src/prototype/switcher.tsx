// PROTOTYP (#191) — pływający przełącznik wariantów, panel stanu i okno meczu wg wariantu. Nie do main.
import type { AdminMatch } from '@tournament/api-client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { matchEvents, sim, useProto, useSport, type FailMode } from './events-store';
import { VARIANTS, useEventsVariant } from './variant';
import { VariantA, VariantB, VariantC, VariantD, VariantE } from './variants';

export function PrototypeMatchDialog(props: { match: AdminMatch; tournamentId: number; sportCode: string; onClose: () => void }) {
  const variant = useEventsVariant();
  const sport = useSport(props.sportCode);
  const common = { match: props.match, tournamentId: props.tournamentId, sport, onClose: props.onClose };
  // `key` z wariantem i sportem: przełączenie składa okno od nowa.
  const key = `${variant}-${sport}`;
  if (variant === 'B') return <VariantB key={key} {...common} />;
  if (variant === 'C') return <VariantC key={key} {...common} />;
  if (variant === 'D') return <VariantD key={key} {...common} />;
  if (variant === 'E') return <VariantE key={key} {...common} />;
  return <VariantA key={key} {...common} />;
}

export function PrototypeSwitcher({ openMatchId }: { openMatchId: number | null }) {
  const variant = useEventsVariant();
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
      // Strzałki działają też przy otwartym oknie meczu, byle nie w polu.
      if (el?.closest('input, textarea, select, [contenteditable], [role="combobox"], [role="radiogroup"], [role="tablist"]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* z-[100]: nad nakładką okna, żeby przełączać wariant przy otwartym meczu. */}
      <div data-prototype className="pointer-events-auto fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
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
      <StatePanel openMatchId={openMatchId} />
    </>
  );
}

function StatePanel({ openMatchId }: { openMatchId: number | null }) {
  const s = useProto();
  const [open, setOpen] = useState(true);
  const current = openMatchId === null ? [] : matchEvents(s.events, openMatchId);

  return (
    <div data-prototype className="pointer-events-auto fixed bottom-4 left-2 z-[100] w-60 rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500">
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP · stan zdarzeń <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Sport (konfiguracja z #188)
            <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.sport} onChange={(e) => sim.sport(e.target.value as typeof s.sport)}>
              <option value="auto">jak turniej</option>
              <option value="football">piłka nożna</option>
              <option value="basketball">koszykówka (rzuty 1/2/3)</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={s.mismatchHint} onChange={sim.toggleHint} /> podpowiedź „ze zdarzeń vs wynik”
            </label>
            <label className="flex items-center gap-1">
              zegar meczu
              <input
                type="number"
                className="w-12 rounded bg-zinc-800 px-1"
                value={s.clock}
                onChange={(e) => sim.clock(Number(e.target.value))}
              />
              ′
            </label>
            <label className="flex items-center gap-1">
              następny zapis
              <select className="rounded bg-zinc-800 px-1" value={s.failNext} onChange={(e) => sim.failNext(e.target.value as FailMode)}>
                <option value="none">OK</option>
                <option value="playerId">422 playerId</option>
                <option value="500">500</option>
              </select>
            </label>
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
          </div>
          <div className="flex gap-1">
            {openMatchId !== null && (
              <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={() => sim.clearMatch(openMatchId)}>
                wyczyść zdarzenia meczu
              </button>
            )}
            <button type="button" className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={sim.reset}>
              reset
            </button>
          </div>
          <div className="font-mono text-zinc-400">
            mecz {openMatchId ?? '—'} · zdarzeń {current.length} · zapisany stan {openMatchId !== null ? (s.statusOverride[openMatchId] ?? 'z API') : '—'}
          </div>
          <div className="max-h-28 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-zinc-300">
            {s.log.length === 0 ? '— brak żądań —' : s.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
