import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminTournamentCreate, AdminTournamentCreateStep1 } from './admin-tournament-create'

const meta = {
  title: 'Ekrany/Admin · Kreator turnieju',
  component: AdminTournamentCreate,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminTournamentCreate>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

export const Krok1Sport: Story = {
  render: () => <AdminTournamentCreateStep1 />,
}
