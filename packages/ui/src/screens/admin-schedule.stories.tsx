import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminSchedule } from './admin-schedule'

const meta = {
  title: 'Ekrany/Admin · Terminarz',
  component: AdminSchedule,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminSchedule>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
