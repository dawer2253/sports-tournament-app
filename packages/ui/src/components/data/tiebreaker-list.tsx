export interface TiebreakerItem {
  /** Kod z `Tournament.tiebreakers`, np. `head_to_head`. */
  code: string
  /** Etykieta z `SportConfig.tiebreakerLabels` (#117). */
  label: string
}

export interface TiebreakerListProps {
  /** Tiebreaki w kolejności priorytetu: pierwszy rozstrzyga pierwszy. */
  items: TiebreakerItem[]
}

/**
 * Kolejność tiebreaków do odczytu (#91 pkt 8): numerowana lista bez uchwytu.
 * Przeciąganie przyjdzie w S2, więc lista mówi o tym wprost.
 */
export function TiebreakerList({ items }: TiebreakerListProps) {
  return (
    <div data-slot="tiebreaker-list" className="grid gap-2">
      <ol className="grid gap-2">
        {items.map((item, index) => (
          <li key={item.code} className="flex items-center gap-3 rounded-md border border-border p-3">
            <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
              {index + 1}
            </span>
            <span className="text-sm font-medium">{item.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Zmianę kolejności dodamy w kolejnej wersji panelu.</p>
    </div>
  )
}
