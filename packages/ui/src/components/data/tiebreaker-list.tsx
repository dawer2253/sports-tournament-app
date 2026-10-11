import type { TiebreakerItem } from './tiebreaker-item'

export interface TiebreakerListProps {
  /** Tiebreaki w kolejności priorytetu: pierwszy rozstrzyga pierwszy. */
  items: TiebreakerItem[]
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
          <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
            {index + 1}
          </span>
          <span className="text-sm font-medium">{item.label}</span>
        </li>
      ))}
    </ol>
  )
}
