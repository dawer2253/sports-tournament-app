import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { publicFixtures, publicResults, scheduleTimeZone } from '../../lib/demo-data'
import { groupByRound } from './round-groups'
import { RoundMatches } from './round-matches'

const meta = {
  title: 'UI/Mecze po kolejce',
  component: RoundMatches,
  parameters: { layout: 'padded' },
  args: {
    rounds: groupByRound(publicFixtures, { timeZone: scheduleTimeZone }),
    timeZone: scheduleTimeZone,
    progress: false,
    statusDisplay: 'live',
  },
} satisfies Meta<typeof RoundMatches>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Terminarz strony publicznej: kolejki rosnąco, na starcie pierwsza. Mecz
 * trwający ma `LiveMarker`, zaplanowane nie mają plakietki stanu.
 */
export const Terminarz: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const [first, second] = args.rounds
    await expect(canvas.getByRole('region', { name: first!.summary.name })).toBeInTheDocument()
    await expect(canvas.getAllByText('Na żywo')).toHaveLength(1)
    await expect(canvas.queryByText('Zaplanowany')).not.toBeInTheDocument()

    const list = within(canvas.getByRole('navigation', { name: 'Kolejki' }))
    await userEvent.click(list.getByRole('button', { name: new RegExp(second!.summary.name) }))
    await expect(canvas.getByRole('region', { name: second!.summary.name })).toBeInTheDocument()
  },
}

/** Wyniki strony publicznej: kolejki od najnowszej, na starcie najnowsza. */
export const Wyniki: Story = {
  args: { rounds: groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = within(canvas.getByRole('navigation', { name: 'Kolejki' }))
    const numbers = list
      .getAllByRole('button')
      .map((button) => Number(button.textContent?.match(/^Kolejka (\d+)/)?.[1]))
    await expect(numbers.length).toBeGreaterThan(1)
    await expect(numbers).toEqual(numbers.toSorted((a, b) => b - a))
    await expect(canvas.getByRole('region', { name: `Kolejka ${numbers[0]}` })).toBeInTheDocument()
  },
}
