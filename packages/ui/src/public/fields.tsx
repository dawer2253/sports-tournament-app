import * as React from 'react'
import { cn } from '../lib/utils'

const CONTROL =
  'min-h-11 w-full rounded-md bg-sunken px-3 text-pub-16 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line aria-invalid:ring-2 aria-invalid:ring-destructive'

/** Błąd pod polem: kolor błędu i powiązanie przez `aria-describedby`. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} data-slot="field-error" className="text-pub-14 text-destructive">
      {children}
    </p>
  )
}

export interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string
  /** Podpis „(opcjonalnie)” przy etykiecie. */
  optional?: boolean
  hint?: React.ReactNode
  /** Komunikat pod polem, np. z `errors` odpowiedzi `422`. */
  error?: string
}

/**
 * Pole tekstowe strony publicznej (#300): etykieta nad polem, podpowiedź
 * i błąd pod nim. Pole we wnęce (`--pub-sunken`) jak tablica, obrys błędu
 * w `--destructive`, fokus w `--brand-line`. Klocki strony nie biorą
 * `Input` z panelu (reguła lintera dla `src/public/**`).
 */
export function TextField({ label, optional, hint, error, className, ...props }: TextFieldProps) {
  const id = React.useId()
  const hintId = hint ? `${id}-podpowiedz` : undefined
  const errorId = error ? `${id}-blad` : undefined

  return (
    <div data-slot="text-field" className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (opcjonalnie)</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={CONTROL}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-pub-14 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  )
}

/** Pole wyboru z etykietą zdaniem obok i błędem pod spodem (zgoda w formularzu). */
export function CheckboxField({
  children,
  error,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'id'> & { children: React.ReactNode; error?: string }) {
  const id = React.useId()
  const errorId = error ? `${id}-blad` : undefined

  return (
    <div data-slot="checkbox-field" className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-brand-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line"
          {...props}
        />
        <label htmlFor={id}>{children}</label>
      </div>
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  )
}
