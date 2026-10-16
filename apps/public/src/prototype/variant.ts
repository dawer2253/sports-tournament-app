// PROTOTYP (#252) — wyrzucany kod na gałęzi prototype/grupy-public, nie do main.
// Trzy warianty strony publicznej turnieju grupy + playoff na /t/grupy-demo,
// przełączane `?variant=`. Wariant zmienia zakładki, Tabelę/Grupy, Drabinkę,
// Terminarz, Wyniki i kartę fazy w Przeglądzie naraz, bo to jedna decyzja.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Tabela i Drabinka obok siebie' },
  { key: 'B', name: 'Grupy osobno, Drabinka gdy jest' },
  { key: 'C', name: 'Jedna zakładka Rozgrywki' },
] as const;

export type Variant = (typeof VARIANTS)[number]['key'];

// Wybrany wariant przeżywa przejście przez zakładki i stronę meczu.
let last: Variant = 'A';

export function lastVariant(): Variant {
  return last;
}

export function useVariant(): Variant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  if (VARIANTS.some((v) => v.key === raw)) last = raw as Variant;
  return last;
}
