import { useId } from 'react'
import { cn } from '../../lib/utils'
import { MATCH_STATUS_LABELS, type MatchStatus } from './match-row-data'

/** Kolejność stanów w przełączniku: od najmniej do najbardziej „rozegranego”. */
const STATUS_ORDER: MatchStatus[] = ['scheduled', 'live', 'finished']

export interface MatchStatusToggleProps {
  value: MatchStatus
  onChange: (status: MatchStatus) => void
  /** Nazwa grupy radio; bez niej każdy egzemplarz dostaje własną z `useId`. */
  name?: string
  disabled?: boolean
  /** Nazwa grupy dla czytnika ekranu, np. „Stan meczu”. */
  'aria-label'?: string
  className?: string
}

/**
 * Stan meczu jako grupa radio (#159): „Zaplanowany", „Trwa", „Zakończony" —
 * jeden aktywny naraz. Pod spodem siedzą natywne `input[type=radio]` schowane
 * przez `sr-only`, więc strzałki, tabulator i czytnik ekranu działają bez
 * pisania czegokolwiek, a segment jest wyłącznie wyglądem (jak `ChoiceCards`
 * w panelu). Nazwy stanów bierze z jednej mapy z plakietką `MatchRow`.
 *
 * Zmiana stanu na meczu bez wyniku wstawia `0:0` — ta reguła należy do okna
 * w panelu, nie tutaj.
 */
export function MatchStatusToggle({
  value,
  onChange,
  name,
  disabled,
  'aria-label': ariaLabel = 'Stan meczu',
  className,
}: MatchStatusToggleProps) {
  const fallbackName = useId()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded-lg border bg-muted/50 p-0.5', className)}
    >
      {STATUS_ORDER.map((status) => {
        const selected = status === value
        return (
          <label
            key={status}
            className={cn(
              'relative cursor-pointer rounded-md px-3 py-1 text-sm transition-colors',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring',
              selected ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name ?? fallbackName}
              value={status}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(status)}
            />
            {MATCH_STATUS_LABELS[status]}
          </label>
        )
      })}
    </div>
  )
}
