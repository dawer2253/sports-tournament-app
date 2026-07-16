import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminVenues } from './admin-venues'

const meta = {
  title: 'Ekrany/Admin · Obiekty',
  component: AdminVenues,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminVenues>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
