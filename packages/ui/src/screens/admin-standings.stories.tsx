import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AdminStandings } from './admin-standings'

const meta = {
  title: 'Ekrany/Admin · Tabela',
  component: AdminStandings,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminStandings>

export default meta
type Story = StoryObj<typeof meta>

/** Piłka: tabela po lewej, karta kryteriów po prawej, bez szkicu. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Tabela').closest('a')).toHaveAttribute('aria-current', 'page')

    await expect(canvas.getByRole('columnheader', { name: 'Bramki' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Rozstrzyganie remisów' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Zapisz kolejność' })).not.toBeInTheDocument()
    await expect(canvas.getByText(/^Kolejność: punkty w tabeli → bezpośredni mecz/)).toBeInTheDocument()
  },
}

/** Koszykówka: bez kolumny R, zdobycze to „Punkty”. */
export const Koszykowka: Story = {
  args: { sport: 'basketball' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument()
  },
}

/** Szkic różny od zapisanego: podgląd ze zmianą miejsc i przyciski zapisu. */
export const PodgladZeZmianaMiejsc: Story = {
  args: { preview: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Podgląd: 4 drużyny zmieniają miejsce.')
    await expect(canvas.getByRole('button', { name: 'Zapisz kolejność' })).toBeInTheDocument()
    await expect(canvas.getAllByText(/wcześniej/)).toHaveLength(4)
  },
}
