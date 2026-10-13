import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { leaderboardsBySport } from '../../lib/demo-data'
import { LeaderboardLeaders } from './leaderboard-leaders'
import { LEADERBOARD_LEADERS_ROWS, type LeaderboardRow } from './leaderboard-data'

const goals = leaderboardsBySport.football.goals!

/** Sześciu zawodników z dwiema bramkami dzieli pierwsze miejsce, siódmy ma jedną. */
const sixLeaders: LeaderboardRow[] = [
  ...Array.from({ length: 6 }, (_, index) => ({ ...goals.rows[index]!, position: 1, value: 2 })),
  { ...goals.rows[6]!, position: 7, value: 1 },
]

const meta = {
  title: 'UI/Lider klasyfikacji',
  component: LeaderboardLeaders,
  parameters: { layout: 'padded' },
  args: { label: goals.label, rows: goals.rows },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof LeaderboardLeaders>

export default meta
type Story = StoryObj<typeof meta>

function items(canvasElement: HTMLElement) {
  return within(canvasElement).getAllByRole('listitem')
}

/** Lider z liczbą i etykietą statystyki pod nią, za nim czterech kolejnych. */
export const Domyslny: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(items(canvasElement)).toHaveLength(LEADERBOARD_LEADERS_ROWS)
    await expect(items(canvasElement)[0]).toHaveTextContent(`${args.rows[0]!.player.name}`)
    await expect(items(canvasElement)[0]).toHaveTextContent(args.label)
  },
}

/** Koszykówka: dwóch liderów ex aequo, etykieta „Punkty”. */
export const Koszykowka: Story = {
  args: { label: leaderboardsBySport.basketball.points!.label, rows: leaderboardsBySport.basketball.points!.rows },
}

/** Więcej niż pięciu liderów: karta ma ich wszystkich i nikogo więcej. */
export const SzesciuLiderow: Story = {
  args: { rows: sixLeaders },
  play: async ({ canvasElement }) => {
    await expect(items(canvasElement)).toHaveLength(6)
  },
}

/** Przed pierwszym meczem zakończonym klasyfikacja nie ma wierszy. */
export const Pusta: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Klasyfikacja ruszy po pierwszym zakończonym meczu/)).toBeInTheDocument()
  },
}
