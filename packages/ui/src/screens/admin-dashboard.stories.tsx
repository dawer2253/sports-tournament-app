import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminDashboard } from './admin-dashboard'

const meta = {
  title: 'Ekrany/Admin · Dashboard',
  component: AdminDashboard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
