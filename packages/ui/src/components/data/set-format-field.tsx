import type { SetFormat } from '../../lib/sets'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

/** Błędy pól formatu seta, po kluczach `setFormat.<pole>` odpowiedzi `422`. */
export type SetFormatErrors = Partial<Record<keyof SetFormat, string>>

export interface SetFormatFieldProps {
  value: SetFormat
  onChange: (value: SetFormat) => void
  /**
   * Format zamknięty (ADR-0012): w turnieju wpisano już set. Pola są wtedy
   * wyłączone, a pod nimi stoi zdanie o blokadzie, to samo co `422` serwera.
   */
  locked?: boolean
  errors?: SetFormatErrors
  className?: string
}

/** Zdanie blokady formatu seta, dosłownie jak `422` z serwera. */
const LOCKED = 'Format seta zmienisz tylko przed pierwszym wynikiem.'

const SETS_TO_WIN = [
  { value: 2, label: '2 wygranych setów' },
  { value: 3, label: '3 wygranych setów' },
]

const MIN_LEAD = [
  { value: 2, label: '2 punkty (gra na przewagi)' },
  { value: 1, label: '1 punkt' },
]

/**
 * Format seta w ustawieniach turnieju sportu z setami (#301): mecz do 2 albo
 * 3 wygranych setów, próg seta, próg seta decydującego i przewaga. Jeden
 * komponent dla panelu i ekranu w Storybooku, wzorem `MatchPeriodsField`.
 * Pola liczb oddają `NaN`, gdy są puste, żeby walidacja formularza dała swój
 * komunikat.
 */
export function SetFormatField({ value, onChange, locked = false, errors = {}, className }: SetFormatFieldProps) {
  const choice = (key: 'setsToWin' | 'minLead', label: string, options: { value: number; label: string }[]) => {
    const id = `set-format-${key}`
    return (
      <div className="grid w-48 content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Select value={String(value[key])} onValueChange={(next) => onChange({ ...value, [key]: Number(next) })} disabled={locked}>
          <SelectTrigger id={id} aria-label={label} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}
      </div>
    )
  }

  const points = (key: 'setPoints' | 'decidingSetPoints', label: string) => {
    const id = `set-format-${key}`
    const error = errors[key]
    return (
      <div className="grid w-48 content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={5}
          max={50}
          value={Number.isNaN(value[key]) ? '' : value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.valueAsNumber })}
          disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby="set-format-label" data-slot="set-format-field" className={cn('grid content-start gap-3', className)}>
      <p id="set-format-label" className="text-sm font-medium">
        Format seta
      </p>
      <div className="flex flex-wrap items-start gap-4">
        {choice('setsToWin', 'Mecz do', SETS_TO_WIN)}
        {points('setPoints', 'Set do (pkt)')}
        {points('decidingSetPoints', 'Set decydujący do (pkt)')}
        {choice('minLead', 'Przewaga', MIN_LEAD)}
      </div>
      {locked && <p className="text-sm text-muted-foreground">{LOCKED}</p>}
    </div>
  )
}
