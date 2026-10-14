import { useId } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'

export interface ScoreInputsProps {
  /** Wartości trzymane jako napisy: pusty napis to „brak wyniku". */
  homeValue: string
  awayValue: string
  onHomeChange: (value: string) => void
  onAwayChange: (value: string) => void
  /** Nazwy pól dla czytnika ekranu, np. „Wynik Wilki Bemowo". */
  homeLabel: string
  awayLabel: string
  /**
   * Błąd pary wyników. Kontrakt sadza wszystkie błędy pary pod `homeScore`
   * (#159), więc jeden komunikat stoi pod całym blokiem `__ : __`, nie przy
   * pojedynczym polu.
   */
  error?: string
  /**
   * Id komunikatu błędu, który rysuje rodzic poza blokiem. Blok wtedy go nie
   * rysuje, tylko wiąże z nim pola. Długi komunikat pod blokiem rozpycha jego
   * szerokość, więc w rzędzie z czymś obok (przełącznik stanu w oknie meczu)
   * przesuwałby pola i spychał sąsiada do nowej linii.
   */
  errorId?: string
  disabled?: boolean
  className?: string
}

/**
 * Blok wyniku meczu: dwa pola `0–999` rozdzielone dwukropkiem, z jednym
 * komunikatem błędu pod całością. Oba pola dzielą opis błędu
 * (`aria-describedby`), więc czytnik ekranu przeczyta go przy każdym z nich.
 */
export function ScoreInputs({
  homeValue,
  awayValue,
  onHomeChange,
  onAwayChange,
  homeLabel,
  awayLabel,
  error,
  errorId: externalErrorId,
  disabled,
  className,
}: ScoreInputsProps) {
  const id = useId()
  const errorId = externalErrorId ?? `${id}-error`
  const describedBy = error ? errorId : undefined
  const inputClassName = 'h-14 w-16 text-center text-2xl font-bold tabular-nums'

  return (
    <div className={cn('grid content-start gap-2', className)}>
      <div className="flex items-center justify-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={homeValue}
          onChange={(event) => onHomeChange(event.target.value)}
          aria-label={homeLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={inputClassName}
        />
        <span aria-hidden="true" className="text-2xl font-bold text-muted-foreground">
          :
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={awayValue}
          onChange={(event) => onAwayChange(event.target.value)}
          aria-label={awayLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={inputClassName}
        />
      </div>
      {error && !externalErrorId && (
        <p id={errorId} className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
