import { useId } from 'react'
import { firstRoundPairs } from '../../lib/bracket'
import { cn } from '../../lib/utils'
import type { SeedingTeam } from './seeding-list'

export interface FirstRoundPreviewProps {
  /** Drużyny w kolejności rozstawienia, jak w `SeedingList`. */
  seeding: SeedingTeam[]
  className?: string
}

/**
 * Podgląd par pierwszej rundy liczony na żywo z rozstawienia (#217,
 * ustalenie 2), według tej samej reguły co generator (`firstRoundPairs`).
 * Numer to pozycja meczu w pełnej drabince, więc przy wolnych losach ma
 * dziury tak jak `matchNumber`. Wolny los to wiersz przerywany „wolny los →
 * 2. runda” zamiast rywala.
 */
export function FirstRoundPreview({ seeding, className }: FirstRoundPreviewProps) {
  const titleId = useId()
  const pairs = firstRoundPairs(seeding)

  return (
    <div data-slot="first-round-preview" className={cn('grid content-start gap-2', className)}>
      <span id={titleId} className="text-sm font-medium">
        Podgląd 1. rundy
      </span>
      <ol aria-labelledby={titleId} className="grid max-h-[25rem] gap-1 overflow-y-auto text-sm">
        {pairs.map(({ matchNumber, home, away }) => (
          <li
            key={matchNumber}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1',
              !away && 'border-dashed text-muted-foreground',
            )}
          >
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{matchNumber}</span>
            <span className="min-w-0 flex-1 truncate">{home.name}</span>
            <span aria-hidden className="text-xs text-muted-foreground">
              {away ? '–' : '→'}
            </span>
            <span className="min-w-0 flex-1 truncate text-right">
              {away ? away.name : <span className="text-xs italic">wolny los → 2. runda</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
