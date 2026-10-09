import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
import { expectDarkPortal } from '../../test/theme'
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

    // `aria-disabled`, nie `disabled`: wyłączony przycisk gubi fokus (patrz `FokusPrzyWysylaniu`).
    await expect(screen.getByRole('button', { name: 'Dodaj' })).toHaveAttribute('aria-disabled', 'true')
    await expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled()

    // Enter w polu wysyła formularz niejawnie; przy `pending` nie może wysłać drugi raz.
    await userEvent.click(screen.getByLabelText('Nazwa'))
    await userEvent.keyboard('{Enter}')
    await expect(args.onSubmit).not.toHaveBeenCalled()

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

/** Wysłanie z aplikacji: `onSubmit` włącza `pending`, jak zrobi to hook mutacji. */
function SubmitSetsPending(args: ComponentProps<typeof FormDialog>) {
  const [pending, setPending] = useState(false)
  return (
    <FormDialog
      {...args}
      pending={pending}
      onSubmit={(event) => {
        args.onSubmit(event)
        setPending(true)
      }}
    />
  )
}

/**
 * Fokus zostaje na przycisku akcji, gdy ten przechodzi w `pending`. Atrybut
 * `disabled` zdejmowałby go do `body`: czytnik ekranu traci miejsce, a błąd
 * z serwera przychodzi do okna, w którym nic nie ma fokusu (review #133).
 */
export const FokusPrzyWysylaniu: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => <SubmitSetsPending {...args} />,
  play: async ({ args }) => {
    await screen.findByRole('dialog')
    const submit = screen.getByRole('button', { name: 'Dodaj' })

    await userEvent.click(submit)
    await waitFor(() => expect(submit).toHaveAttribute('aria-disabled', 'true'))
    await expect(document.activeElement).toBe(submit)

    // Enter na przycisku z fokusem nie wysyła drugi raz.
    await userEvent.keyboard('{Enter}')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

function overlay() {
  return document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!
}

/** Kontrola do `KlikObokPrzyWysylaniu`: bez `pending` klik obok zamyka okno. */
export const KlikObokZamyka: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    await screen.findByRole('dialog')
    await userEvent.click(overlay())
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

/** Przy `pending` klik obok nie zamyka okna. */
export const KlikObokPrzyWysylaniu: Story = {
  args: { pending: true },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(overlay())
    await expect(args.onOpenChange).not.toHaveBeenCalled()
    await expect(dialog).toBeInTheDocument()
  },
}

/**
 * Blokada siedzi na formularzu, nie tylko na przycisku akcji. Przycisk w polach
 * bez `type="button"` (np. wyzwalacz pickera) też wysyła formularz, a Enter
 * w polu wysyła przez pierwszy przycisk `submit` w kolejności drzewa.
 */
export const InnyPrzyciskPrzyWysylaniu: Story = {
  args: {
    pending: true,
    children: (
      <div className="grid gap-2">
        <Label htmlFor="venue-name">Nazwa</Label>
        <Input id="venue-name" name="name" defaultValue="Orlik przy SP 12" />
        <button>Wybierz z mapy</button>
      </div>
    ),
  },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ args }) => {
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByLabelText('Nazwa'))
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Wybierz z mapy' }))

    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * Okno renderuje się w portalu Radixa, poza drzewem story, więc ciemny motyw
 * musi leżeć na `<html>` (#136). Zdjęcie klasy na chwilę pokazuje, że tło okna
 * naprawdę od niej zależy. Bez snapshotu: ciemne snapshoty to osobna decyzja.
 */
export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async () => {
    await screen.findByRole('dialog')
    await expectDarkPortal('[data-slot="dialog-content"]')
  },
}
