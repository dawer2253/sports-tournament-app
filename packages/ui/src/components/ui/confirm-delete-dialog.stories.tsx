import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
import { expectDarkPortal } from '../../test/theme'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'

/** Stan `open` po stronie story, jak w `form-dialog.stories.tsx`. */
function Stateful(args: ComponentProps<typeof ConfirmDeleteDialog>) {
  const [open, setOpen] = useState(args.open)
  return (
    <ConfirmDeleteDialog
      {...args}
      open={open}
      onOpenChange={(next) => {
        args.onOpenChange(next)
        setOpen(next)
      }}
    />
  )
}

const meta = {
  title: 'UI/Potwierdzenie usunięcia',
  component: ConfirmDeleteDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    entity: 'obiekt',
    name: 'Orlik przy SP 12',
    description: 'Obiekt zniknie z listy i z wyboru przy meczach.',
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof ConfirmDeleteDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ args }) => {
    await screen.findByRole('alertdialog', { name: 'Usunąć obiekt „Orlik przy SP 12”?' })
    await expect(screen.queryByRole('alert')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Usuń obiekt' }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

/** Kontrola do `Wysylanie`, jak `EscZamyka` w `form-dialog.stories.tsx`. */
export const EscZamyka: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  },
}

export const Wysylanie: Story = {
  args: { pending: true },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('alertdialog')

    const confirm = screen.getByRole('button', { name: 'Usuń obiekt' })
    await expect(confirm).toHaveAttribute('aria-disabled', 'true')
    await expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled()

    confirm.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onConfirm).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(dialog).toBeInTheDocument()
  },
}

export const BladOgolny: Story = {
  args: { error: 'Nie udało się usunąć obiektu. Spróbuj ponownie.' },
  play: async () => {
    await screen.findByRole('alertdialog')
    await expect(screen.getByRole('alert')).toHaveTextContent(
      'Nie udało się usunąć obiektu. Spróbuj ponownie.',
    )
    // Zwykły błąd nie blokuje: można spróbować jeszcze raz.
    await expect(screen.getByRole('button', { name: 'Usuń obiekt' })).toBeEnabled()
  },
}

/** Odmowa z guarda: obiekt ma rozegrane mecze, więc usuwania nie ma co ponawiać. */
export const Zablokowany: Story = {
  args: {
    blocked: true,
    error: 'Obiektu nie można usunąć, bo rozegrano na nim mecze.',
  },
  // Bez klikania „Zamknij": zamknięte okno dałoby Chromaticowi pusty kadr.
  play: async () => {
    await screen.findByRole('alertdialog')
    await expect(screen.getByRole('alert')).toHaveTextContent(
      'Obiektu nie można usunąć, bo rozegrano na nim mecze.',
    )
    await expect(screen.queryByRole('button', { name: 'Usuń obiekt' })).toBeNull()
    await expect(screen.queryByRole('button', { name: 'Anuluj' })).toBeNull()
    await expect(screen.getByRole('button', { name: 'Zamknij' })).toBeEnabled()
  },
}

/**
 * Usunięcie całego turnieju: przycisk działa dopiero po przepisaniu nazwy,
 * po `trim()` i z rozróżnianiem wielkości liter.
 */
export const PotwierdzenieNazwa: Story = {
  args: {
    entity: 'turniej',
    name: 'Liga Osiedlowa 2026',
    description: 'Znikną drużyny, zawodnicy, obiekty, mecze i wgrane pliki. Tego nie da się cofnąć.',
    confirmByName: true,
  },
  play: async ({ args }) => {
    await screen.findByRole('alertdialog', { name: 'Usunąć turniej „Liga Osiedlowa 2026”?' })
    const field = screen.getByLabelText('Wpisz „Liga Osiedlowa 2026”, aby potwierdzić')
    const confirm = screen.getByRole('button', { name: 'Usuń turniej' })
    await expect(confirm).toBeDisabled()

    await userEvent.type(field, 'liga osiedlowa 2026')
    await expect(confirm).toBeDisabled()

    await userEvent.clear(field)
    await userEvent.type(field, ' Liga Osiedlowa 2026 ')
    await expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

/**
 * Odmowa przy turnieju z rozegranymi meczami (#103): przycisk zostaje, ale
 * zgaszony, nawet przy zgodnej nazwie.
 */
export const PotwierdzenieNazwaZgaszone: Story = {
  args: {
    ...PotwierdzenieNazwa.args,
    confirmDisabled: true,
    error: 'Nie można usunąć: turniej „Liga Osiedlowa 2026” ma powiązane rozegrane mecze.',
  },
  play: async ({ args }) => {
    await screen.findByRole('alertdialog')
    await userEvent.type(screen.getByRole('textbox'), 'Liga Osiedlowa 2026')
    const confirm = screen.getByRole('button', { name: 'Usuń turniej' })
    await expect(confirm).toHaveAttribute('aria-disabled', 'true')

    confirm.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onConfirm).not.toHaveBeenCalled()
    await expect(screen.getByRole('button', { name: 'Anuluj' })).toBeEnabled()
  },
}

/** `onConfirm` włącza `pending`, jak zrobi to hook mutacji. */
function ConfirmSetsPending(args: ComponentProps<typeof ConfirmDeleteDialog>) {
  const [pending, setPending] = useState(false)
  return (
    <ConfirmDeleteDialog
      {...args}
      pending={pending}
      onConfirm={() => {
        args.onConfirm()
        setPending(true)
      }}
    />
  )
}

/** Jak `FokusPrzyWysylaniu` w `form-dialog.stories.tsx`. */
export const FokusPrzyUsuwaniu: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => <ConfirmSetsPending {...args} />,
  play: async ({ args }) => {
    await screen.findByRole('alertdialog')
    const confirm = screen.getByRole('button', { name: 'Usuń obiekt' })

    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'true'))
    await expect(document.activeElement).toBe(confirm)

    await userEvent.keyboard('{Enter}')
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

function overlay() {
  return document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!
}

/** Kontrola do `KlikObokPrzyUsuwaniu`: bez `pending` klik obok zamyka okno. */
export const KlikObokZamyka: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    await screen.findByRole('alertdialog')
    await userEvent.click(overlay())
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  },
}

/** Przy `pending` klik obok nie zamyka okna. */
export const KlikObokPrzyUsuwaniu: Story = {
  args: { pending: true },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(overlay())
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(dialog).toBeInTheDocument()
  },
}

/** Ciemny motyw w portalu, jak `CiemnyMotyw` w `form-dialog.stories.tsx` (#136). */
export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async () => {
    await screen.findByRole('alertdialog')
    await expectDarkPortal('[data-slot="dialog-content"]')
  },
}
