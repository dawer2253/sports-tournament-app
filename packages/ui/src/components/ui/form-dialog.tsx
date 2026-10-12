import { useId, type FormEventHandler, type ReactNode } from 'react'

import { Button } from './button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { DialogError, PendingButton, guardWhilePending } from './dialog-parts'

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  title: ReactNode
  description?: ReactNode
  /** Etykieta przycisku akcji, np. „Dodaj" albo „Zapisz". */
  submitLabel: ReactNode
  /** Błąd ogólny formularza; błędy pól zostają przy polach. */
  error?: ReactNode
  pending?: boolean
  /** Dodatkowe klasy treści okna, np. szerszy `sm:max-w-lg` dla formularzy z dwiema kolumnami. */
  contentClassName?: string
  /** Pola formularza. */
  children: ReactNode
  /**
   * Treść okna **poza** formularzem, między polami a przyciskami — sekcja,
   * która zapisuje się sama, osobno od „Zapisz” (zdarzenia w oknie meczu, #200).
   * Enter w jej polach nie wysyła formularza, a `submit` okna otwartego z niej
   * nie dopływa do `onSubmit` tego okna (zdarzenia Reacta idą drzewem
   * komponentów, także przez portal).
   */
  aside?: ReactNode
}

/**
 * Okno z formularzem dodawania lub edycji. Prezentacyjne: nie zna API ani
 * biblioteki formularzy, dostaje tylko `onSubmit` i stan wysyłania.
 *
 * Z `aside` formularz obejmuje tylko nagłówek i pola, a przyciski stoją pod
 * sekcją z `aside` i wysyłają formularz przez atrybut `form`.
 */
function FormDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  submitLabel,
  error,
  pending,
  contentClassName,
  children,
  aside,
}: FormDialogProps) {
  const formId = useId()

  const footer = (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={pending}>
          Anuluj
        </Button>
      </DialogClose>
      <PendingButton type="submit" form={formId} pending={pending}>
        {submitLabel}
      </PendingButton>
    </DialogFooter>
  )

  return (
    <Dialog open={open} onOpenChange={guardWhilePending(pending, onOpenChange)}>
      <DialogContent showCloseButton={false} className={contentClassName}>
        <form
          id={formId}
          // Blokada na formularzu, nie tylko na przycisku akcji: wysłać go może
          // też Enter w polu albo przycisk z `children` bez `type="button"`.
          onSubmit={(event) => {
            if (pending) {
              event.preventDefault()
              return
            }
            onSubmit(event)
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogError>{error}</DialogError>
          {children}
          {aside === undefined && footer}
        </form>
        {aside !== undefined && (
          <>
            {aside}
            {footer}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { FormDialog }
export type { FormDialogProps }
