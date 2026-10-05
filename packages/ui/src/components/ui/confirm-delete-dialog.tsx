import type { ReactNode } from 'react'

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
import { DialogError, PendingSpinner, guardWhilePending } from './dialog-parts'

type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** Rodzaj bytu w bierniku: „obiekt", „drużynę", „zawodnika". */
  entity: string
  /** Nazwa usuwanego bytu, cytowana w pytaniu. */
  name: string
  /** Skutek usunięcia. */
  description?: ReactNode
  error?: ReactNode
  /**
   * Odmowa z guarda: usuwania nie ma co ponawiać, więc znika przycisk akcji,
   * a „Anuluj" staje się „Zamknij". Powód podaje `error`.
   */
  blocked?: boolean
  pending?: boolean
}

/** Potwierdzenie usunięcia bytu z listy. Prezentacyjne, jak `FormDialog`. */
function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  entity,
  name,
  description,
  error,
  blocked,
  pending,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={guardWhilePending(pending, onOpenChange)}>
      <DialogContent role="alertdialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            Usunąć {entity} „{name}”?
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogError>{error}</DialogError>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {blocked ? 'Zamknij' : 'Anuluj'}
            </Button>
          </DialogClose>
          {!blocked && (
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              <PendingSpinner pending={pending} />
              Usuń {entity}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDeleteDialog }
export type { ConfirmDeleteDialogProps }
