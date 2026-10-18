import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PublicStats } from './public-stats'

const meta = {
  title: 'Ekrany/Public/Statystyki',
  component: PublicStats,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicStats>

export default meta
type Story = StoryObj<typeof meta>

/** Piłka: bramki, a po przełączeniu kartki. Nagłówek i kolumna idą za etykietą. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Bez `navHref` zakładki są dekoracją, a nie odnośnikami — szukamy po tekście.
    const nav = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))
    await expect(nav.getByText('Statystyki')).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('heading', { name: 'Bramki' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('tab', { name: 'Czerwone kartki' }))
    await expect(canvas.getByRole('heading', { name: 'Czerwone kartki' })).toBeInTheDocument()
    await expect(canvas.getByRole('columnheader', { name: 'Czerwone kartki' })).toBeInTheDocument()
  },
}

/** Koszykówka: punkty i faule, dwóch liderów ex aequo. */
export const Koszykowka: Story = {
  args: { sport: 'basketball' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Punkty', 'Faule'])
    const [, first, second] = canvas.getAllByRole('row')
    await expect(within(first!).getAllByRole('cell')[0]).toHaveTextContent('1')
    await expect(within(second!).getAllByRole('cell')[0]).toHaveTextContent('1')
  },
}

/** Przed pierwszym meczem zakończonym: pusty stan zamiast tabeli. */
export const PrzedStartem: Story = {
  args: { state: 'przed-startem' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Klasyfikacja ruszy po pierwszym zakończonym meczu')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}
