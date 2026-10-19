import { cn } from '../lib/utils'

/**
 * Wynik meczu w formie drużyny, kodami `FormResult` z kontraktu
 * (`StandingRow.form`). Litery „W”, „R”, „P” są tylko na ekranie: mapuje je
 * ten plik i nikt poza nim.
 */
export type FormResult = 'win' | 'draw' | 'loss'

const FORM_LETTERS: Record<FormResult, string> = { win: 'W', draw: 'R', loss: 'P' }

const FORM_WORDS: Record<FormResult, string> = { win: 'zwycięstwo', draw: 'remis', loss: 'porażka' }

const FORM_STYLE: Record<FormResult, string> = {
  win: 'bg-brand-line text-brand-line-foreground',
  draw: 'bg-muted text-foreground',
  loss: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
}

/**
 * Forma drużyny: ostatnie wyniki, najnowszy na końcu (z prawej), w kolejności
 * z API. „W” na `--brand-line`, „R” na `--muted`, „P” sam obrys. Litery są dla
 * oka; czytnik ekranu dostaje pełne słowa z tekstu `sr-only`.
 */
export function Form({ results, className }: { results: readonly FormResult[]; className?: string }) {
  return (
    <span data-slot="form" className={cn('inline-flex gap-1', className)}>
      <span className="sr-only">Forma: {results.length > 0 ? results.map((result) => FORM_WORDS[result]).join(', ') : 'brak meczów'}</span>
      {results.map((result, index) => (
        <span
          key={index}
          aria-hidden
          data-result={result}
          className={cn('grid size-5 place-items-center rounded-[3px] pub-num text-xs', FORM_STYLE[result])}
        >
          {FORM_LETTERS[result]}
        </span>
      ))}
    </span>
  )
}
