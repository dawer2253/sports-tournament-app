import { useId, useState, type ReactNode } from 'react'

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
import { Input } from './input'
import { Label } from './label'

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
  /**
   * Usunięcie tak dotkliwe, że trzeba przepisać nazwę (cały turniej). Przycisk
   * działa dopiero przy zgodności po `trim()`, z rozróżnianiem wielkości liter.
   */
  confirmByName?: boolean
  pending?: boolean
} & (
  | { blocked?: false; error?: ReactNode }
  /**
   * Odmowa z guarda: usuwania nie ma co ponawiać, więc znika przycisk akcji,
   * a „Anuluj" staje się „Zamknij". Powód w `error` jest wtedy obowiązkowy.
   */
  | { blocked: true; error: ReactNode }
)

/**
 * Potwierdzenie usunięcia bytu z listy albo całego turnieju (z `confirmByName`).
 * Prezentacyjne, jak `FormDialog`.
 */
function ConfirmDeleteDialog({ open, onOpenChange, pending, ...props }: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={guardWhilePending(pending, onOpenChange)}>
      <DialogContent role="alertdialog" showCloseButton={false}>
        {/* Treść jest w osobnym komponencie, bo `DialogContent` znika po
            zamknięciu: wpisana nazwa nie wraca przy następnym otwarciu. */}
        <ConfirmDeleteContent pending={pending} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDeleteContent({
  onConfirm,
  entity,
  name,
  description,
  confirmByName,
  error,
  blocked,
  pending,
}: Omit<ConfirmDeleteDialogProps, 'open' | 'onOpenChange'>) {
  const fieldId = useId()
  const [typed, setTyped] = useState('')
  const confirmed = !confirmByName || typed.trim() === name

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Usunąć {entity} „{name}”?
        </DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogError>{error}</DialogError>
      {/* Przy blokadzie nie ma czego potwierdzać. */}
      {confirmByName && !blocked && (
        <div className="grid gap-2">
          <Label htmlFor={fieldId}>Wpisz „{name}”, aby potwierdzić</Label>
          <Input
            id={fieldId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {blocked ? 'Zamknij' : 'Anuluj'}
          </Button>
        </DialogClose>
        {!blocked && (
          <PendingButton
            type="button"
            variant="destructive"
            pending={pending}
            disabled={!confirmed}
            onClick={onConfirm}
          >
            Usuń {entity}
          </PendingButton>
        )}
      </DialogFooter>
    </>
  )
}

export { ConfirmDeleteDialog }
export type { ConfirmDeleteDialogProps }
