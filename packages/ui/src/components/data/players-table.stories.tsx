import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { teamPlayers } from '../../lib/demo-data'
import { PlayersTable } from './players-table'

const meta = {
  title: 'UI/Tabela zawodników',
  component: PlayersTable,
  parameters: { layout: 'padded' },
  args: { players: teamPlayers, onEdit: fn(), onDelete: fn() },
} satisfies Meta<typeof PlayersTable>

export default meta
type Story = StoryObj<typeof meta>

const rowOf = (canvas: ReturnType<typeof within>, name: string) =>
  canvas.getByText(name).closest('tr')!

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('row')).toHaveLength(teamPlayers.length + 1)

    // Zawodnik bez numeru ma w kolumnie „Nr" kreskę, a bez pozycji pustą komórkę.
    const withoutNumber = teamPlayers.find((p) => p.number === null && p.position === null)!
    const cells = within(rowOf(canvas, withoutNumber.name)).getAllByRole('cell')
    await expect(cells[0]).toHaveTextContent(/^–$/)
    await expect(cells[2]).toHaveTextContent(/^$/)

    const withNumber = teamPlayers.find((p) => p.number !== null && p.position !== null)!
    const filled = within(rowOf(canvas, withNumber.name)).getAllByRole('cell')
    await expect(filled[0]).toHaveTextContent(new RegExp(`^${withNumber.number}$`))
    await expect(filled[2]).toHaveTextContent(withNumber.position!)
  },
}

/**
 * Ołówek i kosz mają w nazwie dostępnej imię zawodnika: dwanaście przycisków
 * „Edytuj" brzmiałoby dla czytnika ekranu identycznie.
 */
export const Akcje: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const player = teamPlayers[2]!

    await expect(canvas.getAllByRole('button', { name: /^Edytuj zawodnika / })).toHaveLength(teamPlayers.length)

    await userEvent.click(canvas.getByRole('button', { name: `Edytuj zawodnika ${player.name}` }))
    await expect(args.onEdit).toHaveBeenCalledWith(player)

    await userEvent.click(canvas.getByRole('button', { name: `Usuń zawodnika ${player.name}` }))
    await expect(args.onDelete).toHaveBeenCalledWith(player)
  },
}

export const Ladowanie: Story = {
  args: { players: [], status: 'pending' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveAccessibleName('Wczytywanie zawodników')
  },
}

/** Pusty skład bez przykładowych pozycji (#89 pkt 10): te udawały prawdziwe dane. */
export const PustySklad: Story = {
  args: { players: [], onCreate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Brak zawodników')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Dodaj zawodnika' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const Blad: Story = {
  args: {
    players: [],
    status: 'error',
    errorMessage: 'Nie udało się pobrać składu.',
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie udało się wczytać zawodników')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Nie udało się pobrać składu.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
