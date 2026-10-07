import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { teamRows } from '../lib/demo-data'
import { AdminTeams } from './admin-teams'

const meta = {
  title: 'Ekrany/Admin · Drużyny',
  component: AdminTeams,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminTeams>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Tytuł to nazwa turnieju, a sekcję pokazuje aktywna karta (#104). Bez
    // `navHref` karty są w Storybooku dekoracją bez `href`, więc nie mają roli
    // linku i szukamy ich po tekście.
    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Drużyny').closest('a')).toHaveAttribute('aria-current', 'page')

    for (const team of teamRows) {
      await expect(canvas.getByRole('link', { name: team.name })).toBeInTheDocument()
    }
  },
}

export const Pusta: Story = {
  args: { teams: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Turniej nie ma jeszcze drużyn')).toBeInTheDocument()
    // Akcję niesie wtedy pusty stan, bez drugiego przycisku w nagłówku.
    await expect(canvas.getAllByRole('button', { name: 'Dodaj drużynę' })).toHaveLength(1)
  },
}

export const Wczytywanie: Story = {
  args: { teams: [], status: 'pending' },
}

export const Blad: Story = {
  args: { teams: [], status: 'error' },
}
