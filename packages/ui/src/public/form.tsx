import { cn } from '../lib/utils'

/**
 * Wynik meczu w formie drużyny: zwycięstwo, remis, porażka. Typ tymczasowy:
 * #291 dopasuje go do kształtu `StandingRow.form` z kontraktu.
 */
export type FormResult = 'W' | 'R' | 'P'

const FORM_WORDS: Record<FormResult, string> = { W: 'zwycięstwo', R: 'remis', P: 'porażka' }

const FORM_STYLE: Record<FormResult, string> = {
  W: 'bg-brand-line text-brand-line-foreground',
  R: 'bg-muted text-foreground',
  P: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
}

/**
 * Forma drużyny: ostatnie wyniki, najnowszy na końcu. „W” na `--brand-line`,
 * „R” na `--muted`, „P” sam obrys. Litery są dla oka; czytnik ekranu dostaje
 * pełne słowa z tekstu `sr-only`.
 */
export function Form({ results, className }: { results: readonly FormResult[]; className?: string }) {
  return (
    <span data-slot="form" className={cn('inline-flex gap-1', className)}>
      <span className="sr-only">Forma: {results.map((result) => FORM_WORDS[result]).join(', ')}</span>
      {results.map((result, index) => (
        <span
          key={index}
          aria-hidden
          data-result={result}
          className={cn('grid size-5 place-items-center rounded-[3px] pub-num text-xs', FORM_STYLE[result])}
        >
          {result}
        </span>
      ))}
    </span>
  )
}
