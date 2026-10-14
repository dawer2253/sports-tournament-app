import { cn } from '../../lib/utils'

/**
 * Karne jednej drużyny w nawiasie, „(4)”, w polu wyniku przy jej wyniku
 * (#234): ten sam zapis w kaflu drabinki, w wierszu meczu, w wierszu
 * drabinki panelu i w pasie strony meczu. Karne zwycięzcy są pogrubione.
 * Bez karnych zostaje pusty element, który trzyma miejsce w polu.
 */
export function Penalties({ value, won, className }: { value: number | null | undefined; won: boolean; className?: string }) {
  return (
    <span data-slot="penalties" className={cn('tabular-nums', won ? 'font-bold' : 'font-normal', className)}>
      {value != null && `(${value})`}
    </span>
  )
}
