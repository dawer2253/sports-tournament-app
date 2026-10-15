import * as React from 'react'
import { cn } from '../../lib/utils'
import { Heading } from './typography'

export interface SettingsSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title: string
  /** Co sekcja ustawia i kiedy się zapisuje. Stoi pod tytułem. */
  description?: string
  /**
   * Przycisk albo odnośnik sekcji. Od `lg` stoi przy prawym brzegu,
   * wyśrodkowany w pionie; niżej pod polami.
   */
  action?: React.ReactNode
}

/**
 * Sekcja ekranu ustawień: tytuł z opisem i pola. Od `lg` w dwóch kolumnach,
 * opis po lewej, pola po prawej; niżej jedno pod drugim. Pola mają górną
 * granicę szerokości, bo pole na całą szerokość szerokiego ekranu trudniej
 * czytać niż wypełnić. Akcja tej granicy nie ma, więc sięga prawego brzegu.
 */
export function SettingsSection({ title, description, action, className, children, ...props }: SettingsSectionProps) {
  const titleId = React.useId()

  return (
    <section
      data-slot="settings-section"
      aria-labelledby={titleId}
      className={cn('grid gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)] lg:gap-8', className)}
      {...props}
    >
      <div className="space-y-1">
        <Heading level="card" id={titleId}>
          {title}
        </Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4 lg:flex lg:items-center lg:gap-8 lg:space-y-0">
        {children && <div className="min-w-0 max-w-2xl flex-1 space-y-4 lg:self-start">{children}</div>}
        {action && <div className="shrink-0 lg:ml-auto">{action}</div>}
      </div>
    </section>
  )
}
