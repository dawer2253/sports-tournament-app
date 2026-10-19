import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TiebreakerList } from './tiebreaker-list'

const meta = {
  title: 'Panel/UI/Dane/Lista tiebreaków',
  component: TiebreakerList,
  parameters: { layout: 'padded' },
  args: {
    items: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
      { code: 'score_diff', label: 'Różnica bramek' },
      { code: 'score_for', label: 'Bramki zdobyte' },
    ],
  },
} satisfies Meta<typeof TiebreakerList>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Do odczytu: numeracja od 1, bez uchwytu. Zapowiedź edycji zniknęła, bo
 * edycja stoi przy tabeli (#173), a odnośnik do niej dokłada ekran.
 */
export const Domyslna: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const items = canvas.getAllByRole('listitem')
    await expect(items).toHaveLength(args.items.length)
    await expect(items[0]).toHaveTextContent('1Punkty w tabeli')
    await expect(items[3]).toHaveTextContent('4Bramki zdobyte')
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
    await expect(canvas.queryByText(/kolejnej wersji/)).not.toBeInTheDocument()
  },
}
