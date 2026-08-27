import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { tournamentList } from '../../lib/demo-data'
import { TournamentsTable } from './tournaments-table'

const meta = {
  title: 'UI/Tabela turniejów',
  component: TournamentsTable,
  parameters: { layout: 'padded' },
  args: { tournaments: tournamentList },
} satisfies Meta<typeof TournamentsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Każdy turniej ma wiersz z nazwą, sportem, liczbą drużyn i adresem.
    await expect(canvas.getByText('Liga Osiedlowa 2026')).toBeInTheDocument()
    await expect(canvas.getByText('Koszykówka')).toBeInTheDocument()
    await expect(canvas.getByText('/t/liga-osiedlowa-2026')).toBeInTheDocument()
    await expect(canvas.getAllByRole('row')).toHaveLength(tournamentList.length + 1)
  },
}

export const Ladowanie: Story = {
  args: { tournaments: [], status: 'pending' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveAccessibleName('Wczytywanie turniejów')
  },
}

export const Pusty: Story = {
  args: { tournaments: [], onCreate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie masz jeszcze turniejów')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Nowy turniej' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const Blad: Story = {
  args: {
    tournaments: [],
    status: 'error',
    errorMessage: 'Nie udało się pobrać turniejów.',
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie udało się pobrać turniejów.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
