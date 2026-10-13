import { cn } from '../../lib/utils'
import type { RoundSummary } from './round-summary'

export interface RoundTabsProps {
  rounds: RoundSummary[]
  /** `id` wybranej rundy. */
  value: number
  onValueChange: (id: number) => void
  /** Nazwa paska dla czytnika ekranu. */
  'aria-label'?: string
  className?: string
}

/**
 * Poziomy pasek rund drabinki (#217, ustalenie 3): nazwa, zakres dat
 * i „zakończone/wszystkie”, a wybrana runda wyróżniona kolorem marki. Pasek
 * przewija się w poziomie, więc sześć rund mieści się także na telefonie.
 *
 * To nie jest `RoundList`: tamta stoi pionowo obok kolejek ligi, których bywa
 * 38, a rund jest najwyżej siedem i lista meczów dostaje całą szerokość.
 * Karta to `tab`, a lista meczów pod paskiem jest jej panelem po stronie
 * ekranu.
 */
export function RoundTabs({ rounds, value, onValueChange, 'aria-label': ariaLabel = 'Rundy', className }: RoundTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-slot="round-tabs"
      className={cn('-mx-1 flex gap-2 overflow-x-auto px-1 pb-1', className)}
    >
      {rounds.map((round) => {
        const active = round.id === value
        return (
          <button
            key={round.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(round.id)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-2 text-left text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            <span className="block font-medium">{round.name}</span>{' '}
            <span className={cn('block text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              {round.dates} ·{' '}
              <span aria-hidden className="tabular-nums">
                {round.finished}/{round.total}
              </span>
              <span className="sr-only">
                zakończone {round.finished} z {round.total}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
