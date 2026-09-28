// PROTOTYP (#85) — wyrzucany kod na gałęzi prototype/nawigacja-turnieju, nie do main.
// Trzy warianty nawigacji panelu wewnątrz turnieju, przełączane `?variant=`
// na istniejących trasach panelu (`/`, `/tournaments/:id/...`).
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Dwie sekcje w sidebarze' },
  { key: 'B', name: 'Dzisiejszy shell, pozycje dostają adresy' },
  { key: 'C', name: 'Turnieje w sidebarze, sekcje jako karty' },
] as const;

export type VariantKey = (typeof VARIANTS)[number]['key'];

export function useVariant(): VariantKey {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as VariantKey) : 'A';
}

/** Nawigacja, która nie gubi `?variant=` przy przejściu między ekranami. */
export function useGo() {
  const navigate = useNavigate();
  const variant = useVariant();
  return useCallback(
    (path: string) => {
      const [base, hash] = path.split('#');
      void navigate(`${base}?variant=${variant}${hash ? `#${hash}` : ''}`);
    },
    [navigate, variant],
  );
}

export function href(path: string, variant: VariantKey): string {
  const [base, hash] = path.split('#');
  return `${base}?variant=${variant}${hash ? `#${hash}` : ''}`;
}
