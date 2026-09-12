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
      // `data-slot` to własny uchwyt design systemu (`components/ui/card.tsx`),
      // stabilniejszy niż struktura znaczników kafla.
      const tile = heading.closest('[data-slot="card"]')
      await expect(tile).toHaveTextContent(t.sport.name)
      await expect(tile).toHaveTextContent(`${t.teamsCount} drużyn`)
    }

    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(tournamentList.length)

    // Liczniki liczą się z tej samej listy, więc nie mogą jej zaprzeczyć.
    await expect(canvas.getByText('Aktywne turnieje').nextElementSibling).toHaveTextContent(
      String(tournamentList.filter((t) => t.status === 'active').length),
    )
  },
}
