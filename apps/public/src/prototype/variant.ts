// PROTOTYP (#205) — wyrzucany kod na gałęzi prototype/strona-meczu, nie do main.
// Warianty strony meczu na trasie /t/:slug/mecze/:matchId, przełączane `?variant=`.
import { useSearchParams } from 'react-router';

// Runda 2: wszystkie trzy wychodzą z B z rundy 1 (pas + relacja). A „Kafel
// i sekcje” i C „Zestawienie” odpadły; są w historii gałęzi (e14c522).
export const VARIANTS = [
  { key: 'B1', name: 'Ciemniejszy pas, powrót nad pasem' },
  { key: 'B2', name: 'Dane pod pasem, powrót pod relacją' },
  { key: 'B3', name: 'Płaski pas, powrót w przyklejonym pasku' },
] as const;

export type MatchVariant = (typeof VARIANTS)[number]['key'];

// Ostatnio wybrany wariant przeżywa przejście przez listy, które `?variant=` gubią.
let last: MatchVariant = 'B1';

export function useMatchVariant(): MatchVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  if (VARIANTS.some((v) => v.key === raw)) last = raw as MatchVariant;
  return last;
}
