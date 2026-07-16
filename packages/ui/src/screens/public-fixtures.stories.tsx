import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicFixtures } from './public-fixtures'

const meta = {
  title: 'Ekrany/Public · Terminarz',
  component: PublicFixtures,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicFixtures>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
