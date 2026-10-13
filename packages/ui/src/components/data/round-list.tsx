import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import type { RoundSummary } from './round-summary'

/**
 * Nazwa, zakres dat, licznik kolizji i „zakończone/wszystkie”. Licznik kolizji
 * i ułamek mają stałe sloty, więc ułamek nie skacze, gdy w kolejce pojawi się
 * kolizja (#162, pkt 1).
 */
function RoundLabel({ round }: { round: RoundSummary }) {
  const collisions = round.collisions ?? 0
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{round.name}</span>
        {/* Spacja rozdziela nazwę i daty w nazwie przycisku: nie każde środowisko robi to samo z bloków (jsdom nie). */}{' '}
        <span className="block truncate text-xs font-normal text-muted-foreground">{round.dates}</span>
      </span>
      <span className="flex w-5 shrink-0 justify-center">
        {collisions > 0 && (
          <span
            className="grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground"
            title={`Mecze z kolizją: ${collisions}`}
          >
            {collisions}
          </span>
        )}
      </span>
      <span className="w-10 shrink-0 text-right text-xs font-normal tabular-nums text-muted-foreground">
        <span aria-hidden>
          {round.finished}/{round.total}
        </span>
        <span className="sr-only">
          , zakończone {round.finished} z {round.total}
        </span>
      </span>
    </>
  )
}

export interface RoundListProps {
  rounds: RoundSummary[]
  /** `id` wybranej kolejki. */
  value: number
  onValueChange: (id: number) => void
  className?: string
}

/**
 * Lista kolejek terminarza (#162, wariant D). Od `lg` stoi w kolumnie obok
 * meczów i pokazuje wszystkie kolejki. Niżej zwija się do jednego przycisku
 * z bieżącą kolejką i strzałkami ← →: pełna lista rozwija się po kliknięciu
 * i zwija po wyborze, więc na telefonie 38 kolejek nie spycha meczów w dół.
 * Próg to `lg`, nie `md`: przy `md` wiersz meczu obok listy i sidebaru
 * dostawał ok. 224 px i nazwy drużyn nie miały gdzie się zmieścić (#198).
 */
export function RoundList({ rounds, value, onValueChange, className }: RoundListProps) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const index = rounds.findIndex((round) => round.id === value)
  const current = rounds[index]

  function select(id: number) {
    onValueChange(id)
    setExpanded(false)
  }

  const list = (id?: string) => (
    <ul id={id} aria-label={id ? 'Kolejki' : undefined} className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-xl border bg-card p-1.5 lg:max-h-[70vh]">
      {rounds.map((round) => (
        <li key={round.id}>
          <button
            type="button"
            aria-current={round.id === value ? 'true' : undefined}
            onClick={() => select(round.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              round.id === value && 'bg-muted font-medium',
            )}
          >
            <RoundLabel round={round} />
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={className}>
      <div className="space-y-2 lg:hidden">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Poprzednia kolejka"
            disabled={index <= 0}
            onClick={() => select(rounds[index - 1].id)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            onClick={() => setExpanded(!expanded)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-left text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {current && <RoundLabel round={current} />}
            <ChevronDown aria-hidden className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Następna kolejka"
            disabled={index === -1 || index >= rounds.length - 1}
            onClick={() => select(rounds[index + 1].id)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {expanded && list(listId)}
      </div>
      <nav aria-label="Kolejki" className="hidden lg:block">
        {list()}
      </nav>
    </div>
  )
}
