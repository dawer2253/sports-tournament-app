import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '../ui/button'
import { matchInProgress } from '../../lib/demo-data'
import { LiveMatchTile } from './live-match-tile'

const meta = {
  title: 'UI/Kafel meczu na żywo',
  component: LiveMatchTile,
  parameters: { layout: 'padded' },
  args: { match: matchInProgress },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
} satisfies Meta<typeof LiveMatchTile>

export default meta
type Story = StoryObj<typeof meta>

/** Mecz trwający z wynikiem cząstkowym, kolejką i obiektem. */
export const Domyslny: Story = {
  play: async ({ canvasElement, args }) => {
    const tile = within(canvasElement).getByRole('article')
    await expect(tile).toHaveTextContent('Na żywo')
    await expect(tile).toHaveTextContent(args.match.round.name)
    await expect(tile.querySelector('[data-slot="match-score"]')).toHaveTextContent(
      `${args.match.homeScore}:${args.match.awayScore}`,
    )
  },
}

/** Z akcją pod wynikiem, jak na Przeglądzie. */
export const ZAkcja: Story = {
  args: { action: <Button size="sm" className="w-full">Śledź na żywo</Button> },
}

/** Mecz bez obiektu: sam znacznik stanu, bez pustej pinezki. */
export const BezObiektu: Story = {
  args: { match: { ...matchInProgress, venue: null } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg.lucide-map-pin')).toBeNull()
  },
}
