import * as React from 'react'
import { cn } from '../../lib/utils'
import { Separator } from '../ui/separator'

// Ciąg niezależnych faktów o tym samym obiekcie (sezon / liczba drużyn / sport).
// Rozdziela je prawdziwa kreska (Separator), nie znak interpunkcyjny — kropka
// „·" nie niesie żadnej informacji, a przy trzech faktach zlewa się z treścią.
export interface MetaListProps extends React.ComponentProps<'div'> {
  /** Kolejne fakty. `null`/`false` są pomijane razem z sąsiednią kreską. */
  children: React.ReactNode
}

export function MetaList({ className, children, ...props }: MetaListProps) {
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <div className={cn('flex items-center gap-2.5', className)} {...props}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Separator
              orientation="vertical"
              className="h-3 bg-current opacity-40"
            />
          )}
          <span className="truncate">{item}</span>
        </React.Fragment>
      ))}
    </div>
  )
}
