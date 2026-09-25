import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TournamentStatusBadge } from './tournament-status-badge'

const meta = {
  title: 'UI/Odznaka statusu turnieju',
  component: TournamentStatusBadge,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TournamentStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Trzy stany obok siebie: komponent jest jedynym właścicielem etykiet statusu
 * dla całej aplikacji, więc baseline wizualny ma je widzieć razem, a nie
 * przypadkiem, przy okazji tabeli albo dashboardu.
 */
export const Wszystkie: Story = {
  args: { status: 'draft' },
  render: () => (
    <div className="flex gap-2">
      <TournamentStatusBadge status="draft" />
      <TournamentStatusBadge status="active" />
      <TournamentStatusBadge status="finished" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Szkic')).toBeInTheDocument()
    await expect(canvas.getByText('Trwa')).toBeInTheDocument()
    await expect(canvas.getByText('Zakończony')).toBeInTheDocument()
  },
}

export const Szkic: Story = { args: { status: 'draft' } }
export const Trwa: Story = { args: { status: 'active' } }
export const Zakonczony: Story = { args: { status: 'finished' } }
