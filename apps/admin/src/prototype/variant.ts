// PROTOTYP (#251) — wyrzucany kod na gałęzi prototype/grupy-panel, nie do main.
//
// Trzy warianty prowadzenia turnieju „grupy + playoff" w panelu, przełączane
// `?variant=`, na trasach /tournaments/:id/{drużyny,grupy,terminarz,tabela,drabinka}.
// Cała faza grupowa i playoff żyją w pamięci (`groups-store.ts`); turniej
// w nagłówku jest z mocka.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  {
    key: 'A',
    name: 'Grupy osobną kartą, Terminarz z filtrem po grupie, rozstawienie w oknie',
  },
  {
    key: 'B',
    name: 'Skład grup krokami w Terminarzu, kolejki sekcjami per grupa, rozstawienie na Drabince',
  },
  {
    key: 'C',
    name: 'Grupy przy drużynach, tabela zbiorcza z linią wyjścia, rozstawienie kolumnami',
  },
] as const;

export type Variant = (typeof VARIANTS)[number]['key'];

export function useVariant(): Variant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as Variant) : 'A';
}

/**
 * Wariant z adresu albo `null`, gdy adresu nie niesie. Strony prototypu pytają
 * nim, czy w ogóle włączyć warianty: bez `?variant=` renderują zwykły ekran
 * panelu, więc gałąź nie zmienia domyślnego zachowania.
 */
export function useVariantParam(): Variant | null {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as Variant) : null;
}

/** Wariant z adresu poza Reactem — do odnośników nawigacji w `AdminPage`. */
export function currentVariant(): Variant | null {
  const raw = new URLSearchParams(window.location.search).get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as Variant) : null;
}

/** Gdzie w tym wariancie ustala się skład grup. */
export function compositionHome(variant: Variant): 'groups' | 'schedule' | 'teams' {
  if (variant === 'B') return 'schedule';
  if (variant === 'C') return 'teams';
  return 'groups';
}
