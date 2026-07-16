import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicScorers } from './public-scorers'

const meta = {
  title: 'Ekrany/Public · Strzelcy',
  component: PublicScorers,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicScorers>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
