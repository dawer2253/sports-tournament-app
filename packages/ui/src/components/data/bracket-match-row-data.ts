import type { BracketScore } from '../../lib/bracket'

/**
 * Slot meczu drabinki: drużyna albo, dopóki jej nie ma, podpis źródła
 * („Zwycięzca: Półfinał 1”, „Przegrany: Półfinał 2”).
 */
export type BracketSlot = {
  team: { id: number; name: string } | null
  /** Skąd przyjdzie drużyna; liczy go ekran z krawędzi, bo zna cały komplet meczów. */
  source?: string
}

/**
 * Mecz w wierszu drabinki. Etykiety pozycji i krawędzi to gotowe napisy:
 * wylicza je ekran z kompletu meczów fazy (ADR-0004), bo pakiet UI nie zna
 * kontraktu ani pozostałych meczów.
 *
 * Typ mieszka osobno z tego samego powodu co `MatchRowData`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type BracketMatchRowData = BracketScore & {
  id: number
  /** Etykieta pozycji: „Półfinał 1”, „Mecz o 3. miejsce”, „Finał”. */
  label: string
  /** ISO 8601 z offsetem; `null` to „Termin do ustalenia”. */
  kickoffAt: string | null
  home: BracketSlot
  away: BracketSlot
  /** Dokąd idzie zwycięzca, po strzałce: „Finał”, „Półfinał 2”. */
  winnerTo?: string
  /** Dokąd idzie przegrany, po strzałce: „o 3. miejsce”. */
  loserTo?: string
}
