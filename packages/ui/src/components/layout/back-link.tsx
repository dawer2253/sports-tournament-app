import { ChevronLeft } from 'lucide-react'
import type * as React from 'react'
import { cn, isModifiedClick } from '../../lib/utils'

export interface BackLinkProps {
  href: string
  /** Przejęcie kliknięcia, np. przez router — wzorem `Shell.onNavigate` strony publicznej. */
  onNavigate?: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Powrót do listy nad treścią podstrony, np. „‹ Wyniki” nad stroną meczu
 * (#210). Zwykły odnośnik pod konkretny adres, a nie historia przeglądarki:
 * kibic z zewnętrznego linku nie ma dokąd „wrócić”.
 */
export function BackLink({ href, onNavigate, children, className }: BackLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (!onNavigate || isModifiedClick(event)) return
        event.preventDefault()
        onNavigate()
      }}
      className={cn(
        'inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground hover:underline',
        className,
      )}
    >
      <ChevronLeft aria-hidden className="size-4" />
      {children}
    </a>
  )
}
