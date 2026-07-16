import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicHome } from './public-home'

const meta = {
  title: 'Ekrany/Public · Przegląd',
  component: PublicHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicHome>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
