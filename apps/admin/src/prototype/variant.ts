// PROTOTYP (#163) — wyrzucany kod na gałęzi prototype/tabela-i-tiebreaki, nie do main.
//
// Trzy warianty ekranu tabeli i edycji tiebreaków, przełączane `?variant=`:
// A — sekcja „Tabela” tylko do odczytu, edycja w Ustawieniach (przyciski ↑/↓,
//     zapis razem z formularzem przez „Zapisz zmiany”);
// B — sekcja „Tabela” z panelem kryteriów obok (przeciąganie dnd-kit), podgląd
//     skutku na żywo i osobne „Zapisz kolejność”;
// C — zakładka „Tabela” w Terminarzu, kryteria jako zdanie z chipów nad tabelą,
//     każda zmiana zapisuje się od razu (z „Cofnij” w toaście).
import { useSearchParams } from 'react-router';

export const VARIANTS = [
  { key: 'A', name: 'Sekcja + edycja w Ustawieniach' },
  { key: 'B', name: 'Sekcja + panel z podglądem' },
  { key: 'C', name: 'Zakładka w Terminarzu, zapis od razu' },
] as const;

export type Variant = (typeof VARIANTS)[number]['key'];

export function useVariant(): Variant {
  const [params] = useSearchParams();
  const raw = params.get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as Variant) : 'A';
}
