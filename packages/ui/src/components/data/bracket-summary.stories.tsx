import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { demoBracket, scheduleTimeZone } from '../../lib/demo-data'
import { BracketSummary } from './bracket-summary'

const live = demoBracket({ teams: 16, progress: { round: 2, finished: 2, live: 1 } })

/** Karta „Drabinka” Przeglądu pucharu; odchodzi razem z dzisiejszym Przeglądem w #296. */
const meta = {
  title: 'Strona publiczna/Do przepisania/Karta drabinki',
  component: BracketSummary,
  parameters: { layout: 'padded' },
  args: { matches: live, penaltySlot: true, timeZone: scheduleTimeZone },
} satisfies Meta<typeof BracketSummary>

export default meta
type Story = StoryObj<typeof meta>

/** Karta „Drabinka” Przeglądu: rundy z postępem, bieżąca wyróżniona, drużyny w grze. */
export const KartaPrzegladu: Story = {
  render: () => (
    <div className="max-w-md">
      <BracketSummary matches={live} penaltySlot timeZone={scheduleTimeZone} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('W grze 6 z 16 drużyn')).toBeInTheDocument()
    const current = canvasElement.querySelector('li[aria-current="step"]')!
    await expect(current).toHaveTextContent('Ćwierćfinał')
    await expect(current).toHaveTextContent('2/4')
  },
}

/** Po finale karta pokazuje mistrza i kafel finału. */
export const KartaPoFinale: Story = {
  render: () => (
    <div className="max-w-md">
      <BracketSummary matches={demoBracket({ teams: 8, progress: 'done' })} penaltySlot timeZone={scheduleTimeZone} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Zwycięzca pucharu')
    await expect(canvas.getByRole('group', { name: /^Finał:/ })).toBeInTheDocument()
    // Po finale bieżąca jest ostatnia runda, ta sama, na której kończy się okno Drabinki.
    await expect(canvasElement.querySelector('li[aria-current="step"]')).toHaveTextContent('Finał')
  },
}
