import type * as React from 'react'
import type { TiebreakerItem } from './tiebreaker-item'

export interface TiebreakerListProps {
  /** Tiebreaki w kolejności priorytetu: pierwszy rozstrzyga pierwszy. */
  items: TiebreakerItem[]
}

/**
 * Numer kryterium w kwadracie, wspólny dla listy do odczytu i edytora przy
 * tabeli (`TiebreakerEditor`). Bez treści zostaje puste miejsce tej samej
 * szerokości, żeby nieużywane kryteria stały w jednej linii z używanymi.
 */
export function TiebreakerOrdinal({ children }: { children?: React.ReactNode }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
      {children}
    </span>
  )
}

/**
 * Kolejność tiebreaków do odczytu (#91 pkt 8): numerowana lista bez uchwytu.
 * Zmienia się ją przy tabeli (`TiebreakerEditor`, #173), więc odnośnik do
 * niej stawia ekran, który zna adres.
 */
export function TiebreakerList({ items }: TiebreakerListProps) {
  return (
    <ol data-slot="tiebreaker-list" className="grid gap-2">
      {items.map((item, index) => (
        <li key={item.code} className="flex items-center gap-3 rounded-md border border-border p-3">
          <TiebreakerOrdinal>{index + 1}</TiebreakerOrdinal>
          <span className="text-sm font-medium">{item.label}</span>
        </li>
      ))}
    </ol>
  )
}
