import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { Leaderboard, LeaderboardRow } from '../components/data/leaderboard-data'
import { leaderboardsBySport } from '../lib/demo-data'
import { desktop1280, phone375 } from '../test/viewport'
import { StatRanking } from './stats'

const row = (id: number, position: number, value: number, team = 'Sparta'): LeaderboardRow => ({
  position,
  player: { id, name: `Zawodnik ${id}` },
  team: { id: 10 + id, name: team, logoUrl: null },
  value,
})

/**
 * Wartości 4, 2, 1, 1, 1: pasek wartości 2 to połowa paska lidera, a 3. miejsce
 * dzieli trzech zawodników. Kolejność i pozycje jak z API (ex aequo po
 * `player.id`, którego widok nie poprawia).
 */
const shared: Leaderboard = {
  stat: 'goals',
  label: 'Bramki',
  rows: [row(1, 1, 4, 'FC Górka'), row(2, 2, 2), row(3, 3, 1, 'Orły'), row(5, 3, 1, 'Wilki'), row(4, 3, 1, 'Dragons')],
}

const meta = {
  title: 'Strona publiczna/Komponenty/Statystyki/Klasyfikacja',
  component: StatRanking,
  parameters: { layout: 'padded', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { leaderboard: shared },
} satisfies Meta<typeof StatRanking>

export default meta
type Story = StoryObj<typeof meta>

const bars = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="stat-bar"]')].map((bar) => bar.getBoundingClientRect().width)

/** Tekst komórki, który widać na ekranie: bez tekstu w pudełku ściętym do 1 px (`sr-only`). */
function visibleText(cell: HTMLElement): string {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement!.getBoundingClientRect().width > 2) text += node.textContent
  }
  return text
}

/** Dzielone miejsce: widać je raz, przy pierwszym z grupy, a czytnik dostaje je w każdym wierszu. */
export const DzieloneMiejsce: Story = {
  name: 'Dzielone miejsce',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole('table', { name: 'Klasyfikacja: Bramki' })
    await expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['#', 'Zawodnik', 'Bramki'])

    const [, ...rows] = within(table).getAllByRole('row')
    const cells = rows.map((tr) => within(tr).getAllByRole('cell'))
    // Pozycja dla czytnika w każdym wierszu, zgodna z API.
    await expect(cells.map(([position]) => position!.textContent)).toEqual(['1', '2', '3', '3', '3'])
    await expect(cells.map(([, player]) => player!.textContent)).toEqual([
      expect.stringMatching(/^Zawodnik 1.*FC Górka$/),
      expect.stringMatching(/^Zawodnik 2.*Sparta$/),
      expect.stringMatching(/^Zawodnik 3.*Orły$/),
      expect.stringMatching(/^Zawodnik 5.*Wilki$/),
      expect.stringMatching(/^Zawodnik 4.*Dragons$/),
    ])
    // Na ekranie „3” stoi raz: tekst pozycji dla samego czytnika ma pudełko 1 px.
    await expect(cells.map(([position]) => visibleText(position!))).toEqual(['1', '2', '3', '', ''])

    const [leader, second] = bars(canvasElement)
    await expect(leader).toBeGreaterThan(0)
    await expect(Math.abs(second! - leader! / 2)).toBeLessThanOrEqual(1)
  },
}

/** Nagłówek kolumny wartości to `label` danych, np. „Punkty” w koszykówce. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: { leaderboard: leaderboardsBySport.basketball.points! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument()
  },
}

/** Na telefonie bez paska wartości: miejsce, zawodnik z drużyną i wartość. */
export const Telefon: Story = {
  parameters: phone375.parameters,
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expect(bars(canvasElement).every((width) => width === 0)).toBe(true)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}
