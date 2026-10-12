import { ChevronLeft } from 'lucide-react'
import { useId } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import type { RosterPlayer } from './match-event-data'

export interface PlayerNumberGridProps {
  /** Pytanie nad siatką, np. „Bramka — kto?”. */
  title: string
  players: RosterPlayer[]
  onSelect: (playerId: number) => void
  onBack: () => void
  /** Minuta jako napis z pola; pusty napis to „bez minuty”. */
  minute: string
  onMinuteChange: (minute: string) => void
  disabled?: boolean
  className?: string
}

/** Nazwisko na kafelek: ostatni człon pełnej nazwy, bo numer stoi obok. */
function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name
}

/**
 * Drugi krok szybkiego wpisu (#191): siatka zawodników drużyny z dużym
 * numerem. Klik w kafelek zgłasza zawodnika — zapis należy do ekranu. Zawodnik
 * bez numeru ma „—”.
 *
 * Pole minuty stoi nad siatką i jest kontrolowane z zewnątrz: okno pamięta
 * ostatnią wartość między wpisami, więc przy kolejnym zdarzeniu organizator
 * tylko ją podbija. Pole przyjmuje same cyfry; zakres 1–150 sprawdza API.
 */
export function PlayerNumberGrid({
  title,
  players,
  onSelect,
  onBack,
  minute,
  onMinuteChange,
  disabled,
  className,
}: PlayerNumberGridProps) {
  const minuteId = useId()
  const hintId = useId()

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center gap-2">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Wróć do typów zdarzeń" onClick={onBack} disabled={disabled}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <Label htmlFor={minuteId} className="text-xs text-muted-foreground">
          Minuta
        </Label>
        <Input
          id={minuteId}
          inputMode="numeric"
          aria-describedby={hintId}
          className="h-8 w-14"
          value={minute}
          disabled={disabled}
          onChange={(event) => onMinuteChange(event.target.value.replace(/\D/g, '').slice(0, 3))}
        />
      </div>
      <p id={hintId} className="text-right text-xs text-muted-foreground">
        Doliczony czas „90+3” wpisz jako 93.
      </p>
      <ul className="grid grid-cols-3 gap-1.5">
        {players.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              disabled={disabled}
              aria-label={player.number === null ? player.name : `${player.number}. ${player.name}`}
              onClick={() => onSelect(player.id)}
              className={cn(
                'grid min-h-14 w-full place-items-center rounded-md border px-1 py-1.5 text-center transition-colors',
                'hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                'disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              <span className="text-lg leading-none font-bold tabular-nums">{player.number ?? '—'}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{surname(player.name)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
