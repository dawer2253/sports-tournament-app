import * as React from 'react'
import { Card, CardAction, CardContent, CardHeader } from '../ui/card'
import { Heading } from '../ui/typography'

export interface PublicSectionProps {
  title: string
  /** Ikona przed tytułem, np. `<CalendarClock />`. */
  icon?: React.ReactNode
  /** Odnośnik w nagłówku, np. „Cały terminarz”. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Sekcja Przeglądu strony publicznej: karta z nagłówkiem `h2`, od którego
 * sekcja bierze nazwę (`aria-labelledby`), i odnośnikiem do pełnego widoku.
 */
export function PublicSection({ title, icon, action, children, className }: PublicSectionProps) {
  const headingId = React.useId()
  return (
    <section aria-labelledby={headingId} className={className}>
      <Card className="h-full">
        <CardHeader>
          <Heading level="card" as="h2" id={headingId} className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
            {icon}
            {title}
          </Heading>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    </section>
  )
}
