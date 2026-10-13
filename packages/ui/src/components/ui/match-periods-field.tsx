import { Input } from './input'
import { Label } from './label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

/** Podział meczu (`MatchPeriods` z kontraktu): liczba części i minuty jednej, `null` przy jednej części. */
export type MatchPeriodsValue = { count: number; minutes: number | null }

/** Liczby części do wyboru, z etykietą z liczby, jak na stronie meczu (#210). */
const OPTIONS: { count: number; label: string }[] = [
  { count: 1, label: 'Bez podziału' },
  { count: 2, label: '2 połowy' },
  { count: 3, label: '3 tercje' },
  { count: 4, label: '4 kwarty' },
]

export interface MatchPeriodsFieldProps {
  value: MatchPeriodsValue
  onChange: (value: MatchPeriodsValue) => void
  /**
   * Minuty wpisane po przejściu z „Bez podziału” na części, np. domyślne
   * sportu. Bez nich pole minut startuje puste.
   */
  fallbackMinutes?: number | null
  /** Błędy pod `periods.count` i `periods.minutes`, z klienta albo z `422`. */
  errors?: { count?: string; minutes?: string }
  disabled?: boolean
}

/**
 * Pole „Podział meczu” w ustawieniach turnieju (#210): wybór liczby części
 * i „Minuty na część”, ukryte przy „Bez podziału”. Pola równają się do góry,
 * więc błąd pod jednym nie przesuwa drugiego. Podpis mówi, że zmiana
 * przeliczy relacje meczów na stronie publicznej, bo część zdarzenia liczy
 * się przy odczycie.
 *
 * Liczba części spoza listy (API przyjmuje 1–10) dostaje własną opcję
 * „n części”, żeby zapisane ustawienie dało się zobaczyć i zostawić.
 */
export function MatchPeriodsField({ value, onChange, fallbackMinutes = null, errors = {}, disabled }: MatchPeriodsFieldProps) {
  const options = OPTIONS.some((option) => option.count === value.count)
    ? OPTIONS
    : [...OPTIONS, { count: value.count, label: `${value.count} części` }]

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid w-44 content-start gap-2">
          <Label htmlFor="periods-count">Podział meczu</Label>
          <Select
            value={String(value.count)}
            disabled={disabled}
            onValueChange={(next) => {
              const count = Number(next)
              onChange({ count, minutes: count === 1 ? null : (value.minutes ?? fallbackMinutes) })
            }}
          >
            <SelectTrigger
              id="periods-count"
              className="w-full"
              aria-invalid={errors.count ? true : undefined}
              aria-describedby={['periods-hint', errors.count && 'periods-count-error'].filter(Boolean).join(' ')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.count} value={String(option.count)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.count && (
            <p id="periods-count-error" className="text-sm text-destructive">
              {errors.count}
            </p>
          )}
        </div>
        {value.count > 1 && (
          <div className="grid w-36 content-start gap-2">
            <Label htmlFor="periods-minutes">Minuty na część</Label>
            <Input
              id="periods-minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={150}
              disabled={disabled}
              value={value.minutes ?? ''}
              aria-invalid={errors.minutes ? true : undefined}
              aria-describedby={errors.minutes ? 'periods-minutes-error' : undefined}
              onChange={(event) => {
                const minutes = event.target.value === '' ? null : event.target.valueAsNumber
                onChange({ ...value, minutes })
              }}
            />
            {errors.minutes && (
              <p id="periods-minutes-error" className="text-sm text-destructive">
                {errors.minutes}
              </p>
            )}
          </div>
        )}
      </div>
      <p id="periods-hint" className="text-sm text-muted-foreground">
        Zmiana przeliczy relacje wszystkich meczów na stronie publicznej.
      </p>
    </div>
  )
}
