// Części wspólne `FormDialog` i `ConfirmDeleteDialog`. Plik celowo poza
// barrel-em: to szczegół tych dwóch okien, nie prymityw dla aplikacji.
import type { ComponentProps, ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'

import { Button } from './button'

/** Błąd ogólny nad treścią okna (np. odpowiedź serwera bez przypisanego pola). */
function DialogError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      data-slot="dialog-error"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </div>
  )
}

/**
 * Przycisk akcji okna. Przy `pending` pokazuje spinner i ignoruje aktywację,
 * ale jest wyłączony przez `aria-disabled`, nie `disabled`: przeglądarka zdejmuje
 * fokus z wyłączonego przycisku, więc fokus wypadałby z okna do `body` w chwili
 * wysłania (review #133). Wygląd `aria-disabled` daje `buttonVariants`.
 */
function PendingButton({
  pending,
  onClick,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button
      {...props}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
    >
      {pending && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
      {children}
    </Button>
  )
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

export { DialogError, PendingButton, guardWhilePending }
