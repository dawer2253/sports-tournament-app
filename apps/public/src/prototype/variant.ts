// PROTOTYP (#205) — wyrzucany kod na gałęzi prototype/strona-meczu, nie do main.
// Trzy układy strony meczu na trasie /t/:slug/mecze/:matchId, przełączane `?variant=`.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Kafel i sekcje' },
  { key: 'B', name: 'Pas i relacja' },
  { key: 'C', name: 'Zestawienie per zawodnik' },
] as const;

export type MatchVariant = (typeof VARIANTS)[number]['key'];

// Ostatnio wybrany wariant przeżywa przejście przez listy, które `?variant=` gubią.
let last: MatchVariant = 'A';

export function useMatchVariant(): MatchVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  if (VARIANTS.some((v) => v.key === raw)) last = raw as MatchVariant;
  return last;
}
