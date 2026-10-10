// PROTOTYP (#162) — wyrzucany kod na gałęzi prototype/terminarz, nie do main.
// `?variant=` przełącza układ ekranu terminarza na trasie /tournaments/:id/schedule.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Kolejka ze strzałkami, wynik na stronie meczu' },
  { key: 'B', name: 'Wszystkie kolejki, wynik w wierszu' },
  { key: 'C', name: 'Tabela z filtrem, mecz w oknie' },
  { key: 'D', name: 'Kolejki z boku, mecz w panelu' },
] as const;

export type ScheduleVariant = (typeof VARIANTS)[number]['key'];

export function useScheduleVariant(): ScheduleVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as ScheduleVariant) : 'A';
}
