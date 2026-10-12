// PROTOTYP (#191) — wyrzucany kod na gałęzi prototype/zdarzenia-meczu, nie do main.
// `?variant=` przełącza układ sekcji zdarzeń w oknie meczu na /tournaments/:id/schedule.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Lista pod wynikiem, formularz w wierszu' },
  { key: 'B', name: 'Zakładka „Zdarzenia”, dodawanie w pod-oknie' },
  { key: 'C', name: 'Stolik: najpierw typ, potem zawodnik' },
  { key: 'D', name: 'Składy: najpierw zawodnik, potem typ' },
] as const;

export type EventsVariant = (typeof VARIANTS)[number]['key'];

export function useEventsVariant(): EventsVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as EventsVariant) : 'A';
}
