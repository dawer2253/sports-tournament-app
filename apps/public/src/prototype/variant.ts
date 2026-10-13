// PROTOTYP (#218) — wyrzucany kod na gałęzi prototype/drabinka-publiczna, nie do main.
// Trzy warianty drabinki na /t/puchar-demo/drabinka, przełączane `?variant=`.
// Wspólny warunek: na telefonie drabinka nie przewija się w bok, tylko w dół.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Runda po rundzie (lista jak w panelu)' },
  { key: 'B', name: 'Drzewo w oknie rund' },
  { key: 'C', name: 'Mapa całej drabinki i część' },
] as const;

export type BracketVariant = (typeof VARIANTS)[number]['key'];

// Ostatnio wybrany wariant przeżywa przejście przez zakładki, które `?variant=` gubią.
let last: BracketVariant = 'A';

export function lastVariant(): BracketVariant {
  return last;
}

export function useBracketVariant(): BracketVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  if (VARIANTS.some((v) => v.key === raw)) last = raw as BracketVariant;
  return last;
}
