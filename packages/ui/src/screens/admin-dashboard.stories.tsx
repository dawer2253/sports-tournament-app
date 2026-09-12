import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { tournamentList } from '../lib/demo-data'
import { AdminDashboard } from './admin-dashboard'

const meta = {
  title: 'Ekrany/Admin · Dashboard',
  component: AdminDashboard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Kafle biorą nazwę, sport i liczbę drużyn z `tournamentList` — te same
    // trzy turnieje co `UI/Tabela turniejów`, bez ręcznego dublowania wartości.
    for (const t of tournamentList) {
      const heading = canvas.getByRole('heading', { level: 3, name: t.name })
      const tile = heading.closest('[data-slot="card"]')
      // Sport i liczba drużyn z listy, pomiędzy nimi format — jedyne pole
      // prezentacyjne w tym wierszu.
      await expect(tile).toHaveTextContent(
        new RegExp(`${t.sport.name} · .+ · ${t.teamsCount} drużyn`),
      )
      await expect(tile).toHaveTextContent(`/t/${t.slug}`)
    }

    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(tournamentList.length)
  },
}
