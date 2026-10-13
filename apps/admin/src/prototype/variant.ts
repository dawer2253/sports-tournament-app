// PROTOTYP (#217) — wyrzucany kod na gałęzi prototype/drabinka-panel, nie do main.
//
// Cztery warianty ekranu drabinki w panelu na /tournaments/:id/bracket,
// przełączane `?variant=`. Całe dane fazy pucharowej żyją w pamięci
// (`bracket-store.ts`), a turniej w nagłówku jest z mocka — na tej gałęzi
// każdy turniej udaje puchar, także na karcie Terminarz.
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Kolumny rund, rozstawienie ↑/↓ w oknie, osobny Terminarz' },
  { key: 'B', name: 'Runda po rundzie, losowanie z podglądem, Drabinka zamiast Terminarza' },
  { key: 'C', name: 'Drabinka z dwóch stron, rozstawienie wprost w slotach' },
  { key: 'D', name: 'Lista po rundach z mapą drabinki, losowanie z rozstawionymi' },
] as const;

export type BracketVariant = (typeof VARIANTS)[number]['key'];

export function useBracketVariant(): BracketVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as BracketVariant) : 'A';
}

/** Czy w wariancie „Drabinka” zastępuje kartę „Terminarz” (B, D), czy stoją obok siebie (A, C). */
export function replacesSchedule(variant: BracketVariant): boolean {
  return variant === 'B' || variant === 'D';
}

/** Wariant z adresu poza Reactem — do odnośników kart w `AdminPage`. */
export function currentVariant(): BracketVariant {
  const raw = new URLSearchParams(window.location.search).get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as BracketVariant) : 'A';
}
