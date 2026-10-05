import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
import { FormDialog } from './form-dialog'
import { Input } from './input'
import { Label } from './label'

/**
 * Okno trzyma stan `open` jak aplikacja, żeby funkcje `play` widziały, czy Esc
 * naprawdę zamyka dialog, a nie tylko czy woła `onOpenChange`.
 */
function Stateful(args: ComponentProps<typeof FormDialog>) {
  const [open, setOpen] = useState(args.open)
  return (
    <FormDialog
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
  title: 'UI/Okno formularza',
  component: FormDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn((event) => event.preventDefault()),
    title: 'Nowy obiekt',
    description: 'Miejsce rozgrywania meczów w turnieju.',
    submitLabel: 'Dodaj',
    children: (
      <div className="grid gap-2">
        <Label htmlFor="venue-name">Nazwa</Label>
        <Input id="venue-name" name="name" defaultValue="Orlik przy SP 12" />
      </div>
    ),
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof FormDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog', { name: 'Nowy obiekt' })
    await expect(screen.queryByRole('alert')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(dialog).toBeInTheDocument()
  },
}

/**
 * Kontrola do `Wysylanie`: bez `pending` Esc zamyka okno. Gdyby nie zamykał,
 * test blokady przechodziłby niezależnie od tego, czy blokada działa.
 */
export const EscZamyka: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const Wysylanie: Story = {
  args: { pending: true },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog')

    await expect(screen.getByRole('button', { name: 'Dodaj' })).toBeDisabled()
    await expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled()

    await userEvent.keyboard('{Escape}')
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(dialog).toBeInTheDocument()
  },
}

export const BladOgolny: Story = {
  args: { error: 'Nie udało się zapisać obiektu. Spróbuj ponownie.' },
  play: async () => {
    await screen.findByRole('dialog')
    await expect(screen.getByRole('alert')).toHaveTextContent(
      'Nie udało się zapisać obiektu. Spróbuj ponownie.',
    )
  },
}
