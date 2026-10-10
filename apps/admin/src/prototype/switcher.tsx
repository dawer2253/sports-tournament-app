// PROTOTYP (#163) — pływający przełącznik wariantów. Nie do main.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
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
    void navigate(`${location.pathname}?${params}${location.hash}`, { replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      // Edytory kryteriów używają strzałek (dnd-kit, przyciski ↑/↓), więc w nich przełącznik milczy.
      if (el?.closest('input, textarea, [contenteditable], [data-proto-keys]') || event.defaultPrevented) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-2 ring-fuchsia-500">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Poprzedni wariant"
          className="rounded p-1 hover:bg-white/10"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="font-semibold">
          PROTOTYP {variant} · {VARIANTS[index].name}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Następny wariant"
          className="rounded p-1 hover:bg-white/10"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-zinc-400">
        {location.pathname}
        {location.hash}
      </div>
    </div>
  );
}
