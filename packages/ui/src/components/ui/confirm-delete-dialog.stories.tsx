import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
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

    await expect(screen.getByRole('button', { name: 'Usuń obiekt' })).toBeDisabled()
    await expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled()

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
