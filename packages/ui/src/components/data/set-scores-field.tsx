import { Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { isDecidingSet, maxSets, setDraftsToScores, setsWon, type SetDraft, type SetFormat } from '../../lib/sets'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export interface SetScoresFieldProps {
  sets: readonly SetDraft[]
  onChange: (sets: SetDraft[]) => void
  /** Format seta turnieju (`Tournament.setFormat`): liczba setów i set decydujący. */
  format: SetFormat
  homeName: string
  awayName: string
  /** Błędy pod setami po indeksie, z kluczy `sets.{n}` odpowiedzi `422`. */
  setErrors?: Readonly<Record<number, string | undefined>>
  disabled?: boolean
  className?: string
}

/**
 * Wpis wyników setów w oknie meczu sportu z setami (#301), zamiast dwóch pól
 * wyniku: kolejne sety „N. set __ : __”, „Dodaj set” do ostatniego możliwego
 * (decydującego) i „Usuń ostatni set”. Nad setami stoi wynik w setach liczony
 * na bieżąco tymi samymi regułami co na serwerze (`setsWon`), a błąd seta
 * z `422` stoi pod jego rzędem.
 */
export function SetScoresField({ sets, onChange, format, homeName, awayName, setErrors = {}, disabled, className }: SetScoresFieldProps) {
  const id = useId()
  const [home, away] = setsWon(setDraftsToScores(sets), format)
  const limit = maxSets(format)

  function change(index: number, side: keyof SetDraft, value: string) {
    onChange(sets.map((set, at) => (at === index ? { ...set, [side]: value } : set)))
  }

  const inputClassName = 'h-10 w-14 text-center text-lg font-semibold tabular-nums'

  return (
    <div data-slot="set-scores-field" className={cn('grid content-start gap-3', className)}>
      <p className="text-sm" aria-live="polite">
        <span className="text-muted-foreground">Wynik w setach</span>{' '}
        <span data-slot="sets-won" className="text-lg font-bold tabular-nums">
          {home} : {away}
        </span>
      </p>
      {sets.length > 0 && (
        <ol aria-label="Sety" className="grid content-start gap-2">
          {sets.map((set, index) => {
            const error = setErrors[index]
            const errorId = `${id}-set-${index}`
            const label = `${index + 1}. set`
            return (
              <li key={index} className="grid content-start gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-28 text-sm text-muted-foreground">
                    {label}
                    {isDecidingSet(index, format) && <span className="block text-xs">decydujący, do {format.decidingSetPoints}</span>}
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={set.home}
                    onChange={(event) => change(index, 'home', event.target.value)}
                    aria-label={`${label}, ${homeName}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    disabled={disabled}
                    className={inputClassName}
                  />
                  <span aria-hidden className="text-lg font-bold text-muted-foreground">
                    :
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={set.away}
                    onChange={(event) => change(index, 'away', event.target.value)}
                    aria-label={`${label}, ${awayName}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    disabled={disabled}
                    className={inputClassName}
                  />
                </div>
                {error && (
                  <p id={errorId} className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || sets.length >= limit}
          onClick={() => onChange([...sets, { home: '', away: '' }])}
        >
          <Plus aria-hidden className="size-4" />
          Dodaj set
        </Button>
        {sets.length > 0 && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(sets.slice(0, -1))}>
            <Trash2 aria-hidden className="size-4" />
            Usuń ostatni set
          </Button>
        )}
      </div>
    </div>
  )
}
