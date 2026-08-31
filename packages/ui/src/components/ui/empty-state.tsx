import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { headingVariants } from './typography'

const emptyStateIconVariants = cva(
  'grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5',
  {
    variants: {
      variant: {
        empty: 'bg-muted text-muted-foreground',
        error: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'empty' },
  },
)

export interface EmptyStateProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof emptyStateIconVariants> {
  /** Ikona `lucide-react`. Rozmiar nadaje wariant, nie komponent wywołujący. */
  icon?: React.ReactNode
  title: string
  description?: string
  /** Akcja wyprowadzająca ze stanu: „Nowy turniej", „Spróbuj ponownie". */
  action?: React.ReactNode
}

/**
 * Komunikat zastępujący treść, gdy nie ma czego pokazać (`empty`) albo gdy
 * pobranie danych się nie powiodło (`error`).
 */
export function EmptyState({
  className,
  variant,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
      {...props}
    >
      {icon && <span className={cn(emptyStateIconVariants({ variant }))}>{icon}</span>}
      <div className="space-y-1">
        {/* Styl nagłówka karty bierzemy z `headingVariants`, ale znacznik zostaje
            nienagłówkowy: pusty stan siedzi wewnątrz karty i nie powinien
            wstrzykiwać <h3> w outline strony. Komponent `Heading` renderuje
            nagłówki — nie zmuszamy go do udawania akapitu. */}
        <p className={cn(headingVariants({ level: 'card' }))}>{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
