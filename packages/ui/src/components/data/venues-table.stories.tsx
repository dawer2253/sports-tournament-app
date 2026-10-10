import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { venueRows } from '../../lib/demo-data'
import { VenuesTable } from './venues-table'

const meta = {
  title: 'UI/Tabela obiektów',
  component: VenuesTable,
  parameters: { layout: 'padded' },
  args: {
    venues: venueRows,
    onEdit: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof VenuesTable>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('row')).toHaveLength(venueRows.length + 1)

    // Nie pierwszy wiersz: błąd, który zawsze oddaje pierwszy obiekt, też by
    // przeszedł.
    const venue = venueRows[1]!
    await userEvent.click(canvas.getByRole('button', { name: `Edytuj obiekt ${venue.name}` }))
    await expect(args.onEdit).toHaveBeenCalledTimes(1)
    await expect(args.onEdit).toHaveBeenCalledWith(venue)

    await userEvent.click(canvas.getByRole('button', { name: `Usuń obiekt ${venue.name}` }))
    await expect(args.onDelete).toHaveBeenCalledTimes(1)
    await expect(args.onDelete).toHaveBeenCalledWith(venue)
  },
}

/** Obiekt bez adresu ma w kolumnie Adres kreskę, a nie pustą komórkę. */
export const BezAdresu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const venue = venueRows.find((row) => row.address === null)!
    const row = canvas.getByRole('button', { name: `Edytuj obiekt ${venue.name}` }).closest('tr')!
    const addressHeader = canvas.getByRole('columnheader', { name: 'Adres' })
    const addressIndex = Array.from(addressHeader.parentElement!.children).indexOf(addressHeader)
    await expect(row.children[addressIndex]).toHaveTextContent(/^–$/)
  },
}

export const Ladowanie: Story = {
  args: { venues: [], status: 'pending' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveAccessibleName('Wczytywanie obiektów')
  },
}

export const Pusty: Story = {
  args: { venues: [], onCreate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Turniej nie ma jeszcze obiektów')).toBeInTheDocument()
    await expect(
      canvas.getByText('Dodaj boiska i hale, żeby przypisywać do nich mecze w terminarzu.'),
    ).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Dodaj obiekt' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const Blad: Story = {
  args: {
    venues: [],
    status: 'error',
    errorMessage: 'Nie udało się pobrać obiektów.',
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie udało się wczytać obiektów')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Nie udało się pobrać obiektów.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
