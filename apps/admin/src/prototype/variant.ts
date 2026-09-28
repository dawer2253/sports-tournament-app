// PROTOTYP (#86) — wyrzucany kod na gałęzi prototype/edycja-list, nie do main.
// Gałąź wyrasta z prototype/nawigacja-turnieju (#85), więc nawigacja jest
// na sztywno wariantem D, który tam wygrał. `?variant=` przełącza teraz
// warianty edycji list (#86) na ekranie obiektów.
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Dialog' },
  { key: 'B', name: 'Panel boczny (sheet)' },
  { key: 'C', name: 'Edycja w wierszu' },
] as const;

export type EditVariant = (typeof VARIANTS)[number]['key'];

export function useEditVariant(): EditVariant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as EditVariant) : 'A';
}

/** Nawigacja z #85: na sztywno wariant D. */
export type VariantKey = 'A' | 'B' | 'C' | 'D';
export function useVariant(): VariantKey {
  return 'D';
}

/** Przejście, które nie gubi `?variant=` wariantu edycji. */
export function useGo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return useCallback(
    (path: string) => {
      const [base, hash] = path.split('#');
      void navigate(`${base}?${params}${hash ? `#${hash}` : ''}`);
    },
    [navigate, params],
  );
}

export function href(path: string, _variant?: VariantKey): string {
  const [base, hash] = path.split('#');
  return `${base}${window.location.search}${hash ? `#${hash}` : ''}`;
}
