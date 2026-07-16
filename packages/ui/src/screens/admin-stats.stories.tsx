import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminStats } from './admin-stats'

const meta = {
  title: 'Ekrany/Admin · Statystyki',
  component: AdminStats,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminStats>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
