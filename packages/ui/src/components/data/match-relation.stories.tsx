import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { matchPageBasketball, matchPageFinished, matchPageLive } from '../../lib/demo-data'
import { MatchRelation, RELATION_COLLAPSE_THRESHOLD } from './match-relation'

const meta = {
  title: 'Strona publiczna/Do przepisania/Relacja meczu',
  component: MatchRelation,
  parameters: { layout: 'padded' },
  args: {
    status: matchPageFinished.status,
    homeTeamId: matchPageFinished.homeTeam!.id,
    events: matchPageFinished.events,
    periods: matchPageFinished.periods,
    className: 'max-w-3xl',
  },
} satisfies Meta<typeof MatchRelation>

export default meta
type Story = StoryObj<typeof meta>

/** Po meczu: części chronologicznie, wszystkie otwarte, kartka bez minuty na końcu. */
export const PoMeczu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const headers = canvas.getAllByRole('button', { expanded: true })
    await expect(headers.map((header) => header.textContent)).toEqual([
      expect.stringMatching(/^1\. połowa/),
      expect.stringMatching(/^2\. połowa/),
      expect.stringMatching(/^Bez minuty/),
    ])
    await expect(headers[2]).toHaveTextContent('1 zdarzenie')
  },
}

/** Na żywo: najnowsza część na górze, a w niej najnowsze zdarzenie. */
export const NaZywo: Story = {
  args: {
    status: matchPageLive.status,
    homeTeamId: matchPageLive.homeTeam!.id,
    events: matchPageLive.events,
    periods: matchPageLive.periods,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Relacja na żywo' })).toBeInTheDocument()
    const first = canvas.getAllByRole('listitem')[0]!
    await expect(first).toHaveTextContent(`${matchPageLive.events.at(-1)!.minute}′`)
  },
}

/** Kosz: ponad 20 zdarzeń, więc kwarty startują zwinięte, a klik rozwija jedną. */
export const Kosz: Story = {
  args: {
    homeTeamId: matchPageBasketball.homeTeam!.id,
    events: matchPageBasketball.events,
    periods: matchPageBasketball.periods,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(matchPageBasketball.events.length).toBeGreaterThan(RELATION_COLLAPSE_THRESHOLD)
    const headers = canvas.getAllByRole('button', { name: /kwarta/ })
    await expect(headers).toHaveLength(4)
    for (const header of headers) await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0)

    await userEvent.click(headers[1]!)
    await expect(headers[1]).toHaveAttribute('aria-expanded', 'true')
    const inSecond = matchPageBasketball.events.filter((event) => event.period === 2).length
    await expect(canvas.getAllByRole('listitem')).toHaveLength(inSecond)
  },
}

/** Kosz na żywo: otwarta jest tylko najnowsza kwarta, na górze. */
export const KoszNaZywo: Story = {
  args: { ...Kosz.args, status: 'live' },
  play: async ({ canvasElement }) => {
    const headers = within(canvasElement).getAllByRole('button', { name: /kwarta/ })
    await expect(headers[0]).toHaveTextContent(/^4\. kwarta/)
    await expect(headers.map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false'])
  },
}

/** Turniej bez podziału: płaska lista 20 zdarzeń i przycisk z całą relacją. */
export const BezPodzialu: Story = {
  args: {
    homeTeamId: matchPageBasketball.homeTeam!.id,
    events: matchPageBasketball.events.map((event) => ({ ...event, period: null })),
    periods: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { expanded: true })).not.toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(RELATION_COLLAPSE_THRESHOLD)
    await userEvent.click(canvas.getByRole('button', { name: `Pokaż całą relację (${matchPageBasketball.events.length})` }))
    await expect(canvas.getAllByRole('listitem')).toHaveLength(matchPageBasketball.events.length)
  },
}

/** Zdarzenia niezgodne z wynikiem meczu: bez bieżącego wyniku i bez wyników części. */
export const NiezgodnyZWynikiem: Story = {
  args: {
    events: matchPageFinished.events.map((event) => ({ ...event, scoreAfter: null })),
    periods: matchPageFinished.periods.map((period) => ({ ...period, homeScore: null, awayScore: null })),
  },
  play: async ({ canvasElement }) => {
    for (const cell of canvasElement.querySelectorAll('[data-slot="score-after"]')) await expect(cell).toBeEmptyDOMElement()
    await expect(within(canvasElement).getAllByRole('button', { expanded: true })[0]).not.toHaveTextContent(/\d:\d/)
  },
}

export const BezZdarzen: Story = { args: { events: [], periods: [] } }
