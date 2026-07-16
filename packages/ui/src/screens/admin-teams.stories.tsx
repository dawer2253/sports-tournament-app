import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminTeams } from './admin-teams'

const meta = {
  title: 'Ekrany/Admin · Drużyny',
  component: AdminTeams,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminTeams>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
