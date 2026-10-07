import type { FormEventHandler, ReactNode } from 'react'

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
  /** Pola formularza. */
  children: ReactNode
}

/**
 * Okno z formularzem dodawania lub edycji. Prezentacyjne: nie zna API ani
 * biblioteki formularzy, dostaje tylko `onSubmit` i stan wysyłania.
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
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={guardWhilePending(pending, onOpenChange)}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogError>{error}</DialogError>
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Anuluj
              </Button>
            </DialogClose>
            <PendingButton type="submit" pending={pending}>
              {submitLabel}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { FormDialog }
export type { FormDialogProps }
