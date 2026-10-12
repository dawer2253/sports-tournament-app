import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import type { EventTypeOption } from './match-event-data'

export interface EventTypeButtonsProps {
  /** Drużyna, której zdarzenia wpisują przyciski — nazwa grupy dla czytnika ekranu. */
  teamName: string
  /** Typy z konfiguracji sportu, w jej kolejności. */
  types: EventTypeOption[]
  /**
   * Statystyka, która w tym sporcie jest zdobyczą (bramki, punkty): typy
   * wliczane do niej dostają wyróżniony przycisk, bo przy stoliku klika się
   * je najczęściej.
   */
  scoringStat: string
  onSelect: (code: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Przyciski typów zdarzeń jednej drużyny (#191): pierwszy krok szybkiego
 * wpisu przy stoliku. Klik w typ zgłasza jego kod, a wybór zawodnika należy
 * już do `PlayerNumberGrid`. Etykiety idą z konfiguracji sportu, więc koszykówka
 * dostaje „Rzut wolny”, „Rzut za 2”, „Rzut za 3” bez zmian w komponencie.
 */
export function EventTypeButtons({ teamName, types, scoringStat, onSelect, disabled, className }: EventTypeButtonsProps) {
  return (
    <div role="group" aria-label={`Zdarzenia: ${teamName}`} className={cn('grid grid-cols-2 gap-1.5', className)}>
      {types.map((type) => (
        <Button
          key={type.code}
          type="button"
          variant={type.stat === scoringStat ? 'default' : 'outline'}
          className="h-11 whitespace-normal"
          disabled={disabled}
          onClick={() => onSelect(type.code)}
        >
          {type.label}
        </Button>
      ))}
    </div>
  )
}
