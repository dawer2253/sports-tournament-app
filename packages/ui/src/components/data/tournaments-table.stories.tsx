import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { tournamentList } from '../../lib/demo-data'
import { TournamentsTable } from './tournaments-table'

const meta = {
  title: 'UI/Tabela turniejów',
  component: TournamentsTable,
  parameters: { layout: 'padded' },
  args: { tournaments: tournamentList, total: tournamentList.length },
} satisfies Meta<typeof TournamentsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Każdy turniej ma wiersz z nazwą, sportem, liczbą drużyn i adresem.
    await expect(canvas.getByText('Liga Osiedlowa 2026')).toBeInTheDocument()
    await expect(canvas.getByText('Koszykówka')).toBeInTheDocument()
    await expect(canvas.getByText('/t/liga-osiedlowa')).toBeInTheDocument()
    await expect(canvas.getAllByRole('row')).toHaveLength(tournamentList.length + 1)

    // Licznik pokazuje się też wtedy, gdy lista nie jest ucięta.
    await expect(canvas.getByText('Pokazano 3 z 3 turniejów.')).toBeInTheDocument()
  },
}

/** Kontrakt stronicuje listę: pierwsza strona to nie wszystko, co jest. */
export const UcietaLista: Story = {
  args: { total: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pokazano 3 z 12 turniejów.')).toBeInTheDocument()
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
