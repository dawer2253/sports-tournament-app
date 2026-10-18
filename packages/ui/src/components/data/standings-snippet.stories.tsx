import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { standingsTableRows } from '../../lib/demo-data'
import { STANDINGS_SNIPPET_ROWS, StandingsSnippet } from './standings-snippet'

const meta = {
  title: 'UI/Dane/Skrót tabeli',
  component: StandingsSnippet,
  parameters: { layout: 'padded' },
  args: { rows: standingsTableRows },
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
} satisfies Meta<typeof StandingsSnippet>

export default meta
type Story = StoryObj<typeof meta>

/** Pierwsze pięć drużyn z tabeli, w kolejności z API. */
export const Domyslny: Story = {
  play: async ({ canvasElement, args }) => {
    const items = within(within(canvasElement).getByRole('list', { name: 'Czołówka tabeli' })).getAllByRole('listitem')
    await expect(items).toHaveLength(STANDINGS_SNIPPET_ROWS)
    await expect(items[0]).toHaveTextContent(args.rows[0]!.team.name)
  },
}
