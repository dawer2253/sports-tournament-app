import { ChevronDown, ChevronUp, Lock, Shuffle } from 'lucide-react'
import { useId } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { SeedingTeam } from './seeding-team'
import { TiebreakerOrdinal } from './tiebreaker-list'

/** Ile pierwszych pozycji da się zablokować przed losowaniem (#217, ustalenie 2). */
const SEEDING_LOCK_OPTIONS = [0, 1, 2, 4, 8] as const

function lockLabel(count: number): string {
  if (count === 0) return 'Bez rozstawionych'
  if (count === 1) return 'Zablokuj 1 pierwszą'
  return count < 5 ? `Zablokuj ${count} pierwsze` : `Zablokuj ${count} pierwszych`
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** Fisher–Yates na kopii; `random` jak `Math.random`, wstrzykiwalne w testach. */
function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

export interface SeedingListProps {
  /** Drużyny w kolejności rozstawienia: pierwsza jest najwyżej rozstawiona. */
  value: SeedingTeam[]
  onChange: (next: SeedingTeam[]) => void
  /** Ile pierwszych pozycji losowanie zostawia na miejscu. */
  locked: number
  onLockedChange: (locked: number) => void
  /** Źródło losowości dla „Wylosuj”; domyślnie `Math.random`. */
  random?: () => number
  /** Blokuje listę na czas zapisu. */
  disabled?: boolean
  className?: string
}

/**
 * Rozstawienie przed generowaniem drabinki (#217, ustalenie 2): pozycje
 * z numerem i ↑/↓ jak w edytorze kryteriów (#163), wybór liczby
 * zablokowanych pozycji i losowanie, które miesza tylko resztę. Opcje blokady
 * są mniejsze od liczby drużyn, bo zablokowanie wszystkich nie zostawia nic
 * do losowania. Zablokowane pozycje są wyróżnione, a ↑/↓ działają na całej
 * liście, także na nich.
 */
export function SeedingList({
  value,
  onChange,
  locked,
  onLockedChange,
  random = Math.random,
  disabled = false,
  className,
}: SeedingListProps) {
  const lockId = useId()
  const listId = useId()
  const options = SEEDING_LOCK_OPTIONS.filter((count) => count < value.length)

  return (
    <div data-slot="seeding-list" className={cn('grid content-start gap-2', className)}>
      <Label id={listId}>Rozstawienie (od najwyżej rozstawionej)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(locked)} onValueChange={(next) => onLockedChange(Number(next))} disabled={disabled}>
          <SelectTrigger id={lockId} aria-label="Zablokowane pozycje" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {lockLabel(count)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...value.slice(0, locked), ...shuffled(value.slice(locked), random)])}
        >
          <Shuffle className="size-4" /> {locked > 0 ? 'Wylosuj resztę' : 'Wylosuj wszystko'}
        </Button>
      </div>
      <ol aria-labelledby={listId} className="grid max-h-[22rem] gap-1 overflow-y-auto pr-1">
        {value.map((team, index) => {
          const isLocked = index < locked
          return (
            <li
              key={team.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1',
                isLocked && 'border-primary/50 bg-primary/5',
              )}
            >
              <TiebreakerOrdinal>{index + 1}</TiebreakerOrdinal>
              <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
              {isLocked && (
                <span className="flex items-center text-primary" title="Zablokowana przy losowaniu">
                  <Lock aria-hidden className="size-3.5" />
                  <span className="sr-only">zablokowana</span>
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Przesuń „${team.name}” wyżej`}
                disabled={disabled || index === 0}
                onClick={() => onChange(move(value, index, index - 1))}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Przesuń „${team.name}” niżej`}
                disabled={disabled || index === value.length - 1}
                onClick={() => onChange(move(value, index, index + 1))}
              >
                <ChevronDown className="size-4" />
              </Button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
