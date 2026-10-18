import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AdminTournamentCreate } from './admin-tournament-create'

const meta = {
  title: 'Ekrany/Admin/Kreator turnieju',
  component: AdminTournamentCreate,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminTournamentCreate>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ten sam ekran co pod `/tournaments/new` w panelu: jeden formularz z nazwą,
 * sportem i formatem. Asercje idą po polach formularza, nie po krokach —
 * kreatora w krokach nie ma.
 */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Nazwa turnieju')).toHaveValue('')
    await expect(canvas.getByRole('group', { name: 'Sport' })).toBeInTheDocument()
    await expect(canvas.getByRole('group', { name: 'Format rozgrywek' })).toBeInTheDocument()

    // Nic nie jest zaznaczone za organizera.
    for (const radio of canvas.getAllByRole('radio')) {
      await expect(radio).not.toBeChecked()
    }

    // Kreator w krokach nie istnieje: nie ma steppera ani ustawień ligi.
    await expect(canvas.queryByText('Ustawienia ligi')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Dalej: drużyny')).not.toBeInTheDocument()

    await expect(canvas.getByRole('button', { name: 'Załóż turniej' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Anuluj' })).toBeInTheDocument()
  },
}

/** Wypełniony formularz: nazwa, sport i format wybrane, przycisk gotowy. */
export const Wypelniony: Story = {
  args: { state: 'wypelniony' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Nazwa turnieju')).toHaveValue('Liga Osiedlowa 2026')
    await expect(canvas.getByRole('radio', { name: 'Piłka nożna' })).toBeChecked()
    await expect(canvas.getByRole('radio', { name: 'Liga każdy z każdym' })).toBeChecked()
  },
}

/**
 * Odmowa z API (`422`) siada przy polach: nazwa, sport i format niosą własny
 * komunikat, tak jak w panelu.
 */
export const Blad: Story = {
  args: { state: 'blad' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Podaj nazwę turnieju.')).toBeInTheDocument()
    await expect(canvas.getByText('Wybierz sport.')).toBeInTheDocument()
    await expect(canvas.getByText('Wybierz format rozgrywek.')).toBeInTheDocument()
  },
}
