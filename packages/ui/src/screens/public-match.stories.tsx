import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PublicMatch } from './public-match'

const meta = {
  title: 'Strona publiczna/Do przepisania/Ekrany/Mecz',
  component: PublicMatch,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['pilka', 'na-zywo', 'zaplanowany', 'kosz'] },
    color: { control: 'inline-radio', options: ['#1F7A45', '#FFD400'] },
  },
} satisfies Meta<typeof PublicMatch>

export default meta
type Story = StoryObj<typeof meta>

/** Piłka po meczu, kolor ciemny: biały tekst na ciemnym gradiencie. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Wyniki' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Przebieg meczu' })).toBeInTheDocument()
    // Strona meczu nie jest zakładką: shell niczego nie podświetla.
    await expect(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }).querySelector('[aria-current]')).toBeNull()
  },
}

export const PilkaKolorJasny: Story = { args: { color: '#FFD400' } }

export const NaZywo: Story = {
  args: { variant: 'na-zywo' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Relacja na żywo' })).toBeInTheDocument()
  },
}

export const Zaplanowany: Story = {
  args: { variant: 'zaplanowany' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Terminarz' })).toBeInTheDocument()
    await expect(canvas.getByText('Mecz jeszcze się nie zaczął.')).toBeInTheDocument()
  },
}

export const KoszKolorJasny: Story = { args: { variant: 'kosz', color: '#FFD400' } }

export const KoszKolorCiemny: Story = { args: { variant: 'kosz' } }
