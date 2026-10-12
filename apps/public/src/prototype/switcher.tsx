// PROTOTYP (#205) — pływający przełącznik wariantów i panel stanu. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { proto, useProto, type BackMode, type EntryMode, type ProtoMatch, type Sport } from './demo';
import { useSlug } from './shared';
import { VARIANTS, useMatchVariant } from './variant';

const STATUS: Record<ProtoMatch['status'], string> = { scheduled: 'zaplanowany', live: 'na żywo', finished: 'zakończony' };

export function PrototypeSwitcher({ match, matches }: { match: ProtoMatch | null; matches: ProtoMatch[] }) {
  const variant = useMatchVariant();
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
      <div data-prototype className="fixed bottom-3 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} aria-label="Poprzedni wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronLeft className="size-4" />
          </button>
          <span className="whitespace-nowrap font-semibold">
            PROTOTYP {variant}: {VARIANTS[index].name}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Następny wariant" className="rounded p-1 hover:bg-white/10">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <StatePanel match={match} matches={matches} />
    </>
  );
}

function StatePanel({ match, matches }: { match: ProtoMatch | null; matches: ProtoMatch[] }) {
  const s = useProto();
  const slug = useSlug();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div data-prototype className="fixed right-2 top-2 z-[100] w-64 rounded-xl bg-zinc-900 p-2.5 text-[11px] text-zinc-200 shadow-2xl ring-2 ring-fuchsia-500">
      <button type="button" className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setOpen(!open)}>
        PROTOTYP: stan <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block">
            Sport turnieju
            <select
              className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white"
              value={s.sport}
              onChange={(e) => {
                const sport = e.target.value as Sport;
                proto.set({ sport });
                // Mecze kosza mają inne id; przeskocz na odpowiednik w tym samym stanie.
                if (match) {
                  const twin = (sport === 'football' ? [1, 4, 3] : [11, 12, 13])[['finished', 'live', 'scheduled'].indexOf(match.status)];
                  void navigate(`/t/${slug}/mecze/${twin}`);
                }
              }}
            >
              <option value="football">piłka nożna</option>
              <option value="basketball">koszykówka (rzuty 1/2/3, faule)</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={s.longNames} onChange={(e) => proto.set({ longNames: e.target.checked })} />
            długie nazwy drużyn
          </label>
          <label className="block">
            Wejście z listy
            <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.entry} onChange={(e) => proto.set({ entry: e.target.value as EntryMode })}>
              <option value="row">cały wiersz jest linkiem</option>
              <option value="button">osobny link „Szczegóły” / „Relacja”</option>
            </select>
          </label>
          <label className="block">
            Powrót ze strony meczu
            <select className="mt-0.5 w-full rounded bg-zinc-800 px-1.5 py-1 text-white" value={s.back} onChange={(e) => proto.set({ back: e.target.value as BackMode })}>
              <option value="state">link według stanu (Terminarz / Wyniki)</option>
              <option value="history">„Wróć” historią przeglądarki</option>
            </select>
          </label>
          <div>
            <p className="mb-1">Mecze:</p>
            <ul className="space-y-0.5">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-1.5 py-0.5 text-left hover:bg-zinc-800 ${m.id === match?.id ? 'bg-zinc-700 text-white' : ''}`}
                    onClick={() => void navigate(`/t/${slug}/mecze/${m.id}`)}
                  >
                    {m.id}: {STATUS[m.status]}, {m.events.length} zdarzeń
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {match && (
            <div className="rounded bg-black/40 p-1.5 font-mono text-[10px] leading-tight text-zinc-300">
              GET /public/t/{slug}/matches/{match.id}
              <br />
              status: {match.status}, wynik: {match.homeScore ?? 'null'}:{match.awayScore ?? 'null'}
              <br />
              scorers: {match.scorers.length}, events: {match.events.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
