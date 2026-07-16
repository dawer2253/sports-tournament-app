import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicBracket } from './public-bracket'

const meta = {
  title: 'Ekrany/Public · Drabinka',
  component: PublicBracket,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicBracket>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
