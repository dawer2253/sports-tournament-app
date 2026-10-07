import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { venueRows } from '../lib/demo-data'
import { AdminVenues } from './admin-venues'

const meta = {
  title: 'Ekrany/Admin · Obiekty',
  component: AdminVenues,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminVenues>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Sekcję pokazuje aktywna karta (#104), jak na liście drużyn.
    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Obiekty').closest('a')).toHaveAttribute('aria-current', 'page')

    await expect(canvas.getAllByRole('row')).toHaveLength(venueRows.length + 1)
    // Kontrakt nie ma liczby meczów obiektu (#90).
    await expect(canvas.queryByRole('columnheader', { name: 'Mecze' })).not.toBeInTheDocument()
  },
}

/** Obiekt bez adresu: w kolumnie Adres stoi „–". */
export const BezAdresu: Story = {
  args: { venues: venueRows.filter((venue) => venue.address === null) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const venue = venueRows.find((row) => row.address === null)!
    const row = canvas.getByText(venue.name).closest('tr')!
    await expect(within(row).getByText('–', { exact: true })).toBeInTheDocument()
  },
}

export const Pusta: Story = {
  args: { venues: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Turniej nie ma jeszcze obiektów')).toBeInTheDocument()
    // Akcję niesie wtedy pusty stan, bez drugiego przycisku w nagłówku.
    await expect(canvas.getAllByRole('button', { name: 'Dodaj obiekt' })).toHaveLength(1)
  },
}

export const Wczytywanie: Story = {
  args: { venues: [], status: 'pending' },
}

export const Blad: Story = {
  args: { venues: [], status: 'error' },
}
