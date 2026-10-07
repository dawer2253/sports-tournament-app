import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { rosterTeam, teamPlayers, teamRows } from '../lib/demo-data'
import { AdminTeam } from './admin-team'

const meta = {
  title: 'Ekrany/Admin · Skład drużyny',
  component: AdminTeam,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminTeam>

export default meta
type Story = StoryObj<typeof meta>

/** Pełny skład drużyny z wgranym herbem. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Karta sekcji „Drużyny" nie ma w Storybooku `href`, więc jedynym linkiem
    // o tej nazwie jest link powrotny do listy.
    await expect(canvas.getByRole('link', { name: 'Drużyny' })).toHaveAttribute('href', '#/tournaments/1/teams')
    await expect(canvas.getByRole('heading', { level: 2, name: rosterTeam.name })).toBeInTheDocument()
    await expect(canvas.getAllByRole('row')).toHaveLength(teamPlayers.length + 1)

    await expect(canvas.getByRole('button', { name: 'Zmień herb' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Usuń herb' })).toBeInTheDocument()
  },
}

/** Bez herbu: herb zastępczy, „Wgraj herb" i brak „Usuń herb". */
export const BezHerbu: Story = {
  args: { team: teamRows.find((team) => team.logoUrl === null) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Wgraj herb' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Usuń herb' })).not.toBeInTheDocument()
  },
}

export const PustySklad: Story = {
  args: { team: { ...teamRows.find((team) => team.logoUrl === null)!, playersCount: 0 }, players: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Brak zawodników')).toBeInTheDocument()
    // Akcję niesie wtedy pusty stan, bez drugiego przycisku nad tabelą.
    await expect(canvas.getAllByRole('button', { name: 'Dodaj zawodnika' })).toHaveLength(1)
  },
}
