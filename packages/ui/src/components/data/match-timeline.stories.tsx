import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { eventTypesBySport } from '../../lib/demo-data'
import type { MatchEventRow } from './match-event-data'
import { MatchTimeline } from './match-timeline'

const wilki = { id: 1, name: 'Wilki Bemowo' }
const sokoly = { id: 2, name: 'Sokoły Ursus' }

/** Mecz 1 z seeda demo (przykład `pilka` w kontrakcie), z samobójem. */
const events: MatchEventRow[] = [
  { id: 1, team: wilki, player: { id: 1, name: 'Marek Nowak' }, type: 'goal', typeLabel: 'Bramka', minute: 12 },
  { id: 3, team: sokoly, player: { id: 5, name: 'Adam Zieliński' }, type: 'goal', typeLabel: 'Bramka', minute: 34 },
  { id: 2, team: sokoly, player: { id: 4, name: 'Tomasz Lis' }, type: 'own_goal', typeLabel: 'Bramka samobójcza', minute: 58 },
  { id: 4, team: sokoly, player: { id: 4, name: 'Tomasz Lis' }, type: 'yellow_card', typeLabel: 'Żółta kartka', minute: 71 },
  { id: 5, team: wilki, player: { id: 3, name: 'Jakub Wrona' }, type: 'yellow_card', typeLabel: 'Żółta kartka', minute: null },
]

const meta = {
  title: 'UI/Oś meczu',
  component: MatchTimeline,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
  args: {
    events,
    homeTeamId: wilki.id,
    types: eventTypesBySport.football,
    onSelect: fn(),
  },
} satisfies Meta<typeof MatchTimeline>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Gospodarz z lewej, gość z prawej, minuta pośrodku, bez minuty na końcu.
 * Samobój ma dopisek, a klik w zdarzenie zgłasza je do edycji.
 */
export const Domyslna: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const rows = within(canvas.getByRole('list', { name: 'Oś meczu' })).getAllByRole('listitem')

    await expect(rows.map((row) => row.children[1].textContent)).toEqual(['12′', '34′', '58′', '71′', '—'])
    // Gospodarz w pierwszej kolumnie, gość w trzeciej.
    await expect(rows[0].children[0]).toHaveTextContent('Marek Nowak')
    await expect(rows[1].children[2]).toHaveTextContent('Adam Zieliński')
    await expect(rows[2]).toHaveTextContent('nie wlicza się do klasyfikacji')
    await expect(rows[0]).not.toHaveTextContent('nie wlicza się')

    await userEvent.click(canvas.getByRole('button', { name: 'Edytuj: 58′ Bramka samobójcza, Tomasz Lis (Sokoły Ursus)' }))
    await expect(args.onSelect).toHaveBeenLastCalledWith(args.events[2])
  },
}

/** Bez `onSelect` oś jest tylko do odczytu: zdarzenia nie są przyciskami. */
export const TylkoOdczyt: Story = {
  args: { onSelect: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

/** Typ i zawodnika rozdziela odstęp, a nie kropka „·” (#192). */
export const BezKropki: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Oś meczu' })
    await expect(list.textContent).not.toContain('·')
    await expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Bramka Marek Nowak')
  },
}

/** Bez `types` oś nie wie, co się nie wlicza, więc dopisku nie ma. */
export const BezTypow: Story = {
  args: { types: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('list', { name: 'Oś meczu' })).not.toHaveTextContent('nie wlicza się')
  },
}

export const Pusta: Story = {
  args: { events: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Brak zdarzeń.')).toBeInTheDocument()
  },
}
