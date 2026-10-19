import { cn } from '../lib/utils'

/**
 * Cyfra wyniku w okienku wyświetlacza (`--pub-sunken`), ze stałą minimalną
 * szerokością, więc wyniki w kolumnie stoją równo. Bez wyniku „–”. `dim`
 * przygasza stronę przegraną.
 */
export function ScoreCell({ value, dim = false, className }: { value: number | null; dim?: boolean; className?: string }) {
  return (
    <span
      data-slot="score-cell"
      className={cn('grid min-w-9 place-items-center rounded-sm bg-sunken px-1.5 pub-num text-pub-28 leading-9', dim && 'text-muted-foreground', className)}
    >
      {value ?? '–'}
    </span>
  )
}
