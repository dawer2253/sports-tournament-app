// Części wspólne `FormDialog` i `ConfirmDeleteDialog`. Plik celowo poza
// barrel-em: to szczegół tych dwóch okien, nie prymityw dla aplikacji.
import type { ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'

import { cn } from '../../lib/utils'

/** Błąd ogólny nad treścią okna (np. odpowiedź serwera bez przypisanego pola). */
function DialogError({ className, children }: { className?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      data-slot="dialog-error"
      className={cn(
        'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Spinner na przycisku akcji w trakcie wysyłania. */
function PendingSpinner({ pending }: { pending?: boolean }) {
  return pending ? <Loader2Icon aria-hidden className="size-4 animate-spin" /> : null
}

/**
 * W trakcie wysyłania okna nie da się zamknąć: Esc, klik obok i „Anuluj"
 * przechodzą przez `onOpenChange`, więc wystarczy go wtedy nie wołać.
 */
function guardWhilePending(pending: boolean | undefined, onOpenChange: (open: boolean) => void) {
  return (open: boolean) => {
    if (!pending) onOpenChange(open)
  }
}

export { DialogError, PendingSpinner, guardWhilePending }
