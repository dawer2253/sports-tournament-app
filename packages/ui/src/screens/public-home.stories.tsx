import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PublicHome } from './public-home'

const meta = {
  title: 'Ekrany/Public · Przegląd',
  component: PublicHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicHome>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

/**
 * Przed pierwszym meczem: sekcji meczów trwających i wyników nie ma, tabela
 * stoi z zerami, a karta klasyfikacji mówi, kiedy ruszy.
 */
export const PrzedStartem: Story = {
  args: { state: 'przed-startem' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('region', { name: 'Na żywo' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Ostatnie wyniki' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Najbliższe mecze' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Tabela (skrót)' })).toBeInTheDocument()
    await expect(
      within(canvas.getByRole('region', { name: 'Bramki' })).getByText(/Klasyfikacja ruszy po pierwszym zakończonym meczu/),
    ).toBeInTheDocument()
  },
}
