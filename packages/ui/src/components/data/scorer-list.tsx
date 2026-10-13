import { cn } from '../../lib/utils'
import type { ScorerLine } from './scorer-lines'

export interface ScorerListProps {
  lines: ScorerLine[]
  /** Nazwa drużyny, której zdobycze lista pokazuje — do nazwy listy dla czytnika ekranu. */
  team: string
  /** `end` po stronie gospodarza, żeby lista stała przy jego nazwie. */
  align?: 'start' | 'end'
  className?: string
}

/**
 * Strzelcy jednej strony meczu pod wynikiem (#208): nazwisko, a obok minuty
 * albo suma, przy samobóju dopisek „(sam.)”. Każdy strzelec w osobnej linii,
 * bez separatora z kropką. Miejsce w siatce wiersza daje `className`.
 */
export function ScorerList({ lines, team, align = 'start', className }: ScorerListProps) {
  if (lines.length === 0) return null

  return (
    <ul
      data-slot="match-scorers"
      aria-label={`Strzelcy: ${team}`}
      className={cn('min-w-0 space-y-0.5 self-start text-xs text-muted-foreground', align === 'end' && 'text-right', className)}
    >
      {/* Nic się nie obcina: w wąskiej kolumnie wpis zawija się do kolejnej
          linii, a minuty, suma i „(sam.)” trzymają się razem, bo to one są
          treścią wiersza. */}
      {lines.map((line) => (
        <li key={line.key} className="wrap-break-word">
          <span className="text-foreground">{line.name}</span>{' '}
          <span className="whitespace-nowrap tabular-nums">
            {line.detail}
            {line.ownGoal && ' (sam.)'}
          </span>
        </li>
      ))}
    </ul>
  )
}
