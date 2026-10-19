import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { leaderboardsBySport } from '../lib/demo-data'
import { phone375 } from '../test/viewport'
import { StatLeaders } from './stats'

const goals = leaderboardsBySport.football.goals!
const points = leaderboardsBySport.basketball.points!

const meta = {
  title: 'Strona publiczna/Komponenty/Statystyki/Lider',
  component: StatLeaders,
  parameters: { layout: 'padded' },
  args: { leaderboard: goals },
} satisfies Meta<typeof StatLeaders>

export default meta
type Story = StoryObj<typeof meta>

const cards = (canvasElement: HTMLElement) => [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="stat-leader"]')]

/** Jeden lider: duża karta z „Lider”, a pod liczbą `label` odpowiedzi małymi literami. */
export const Jeden: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(cards(canvasElement)).toHaveLength(1)
    await expect(canvas.getByText('Lider')).toBeInTheDocument()
    await expect(canvas.queryByText('Liderzy ex aequo')).not.toBeInTheDocument()
    await expect(cards(canvasElement)[0]).toHaveTextContent(/Jan Kowalski.*Górka.*8.*bramki/)
  },
}

/** Dwóch z `position: 1` (koszykówka, 64 punkty): dwie karty obok siebie, „Liderzy ex aequo”. */
export const DwochExAequo: Story = {
  name: 'Dwóch ex aequo',
  args: { leaderboard: points },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const leaders = cards(canvasElement)
    await expect(leaders).toHaveLength(2)
    await expect(canvas.getAllByText('Liderzy ex aequo')).toHaveLength(2)
    await expect(canvas.queryByText('Lider')).not.toBeInTheDocument()
    await expect(leaders.map((card) => card.textContent)).toEqual([
      expect.stringMatching(/Oskar Dąb.*64punkty/),
      expect.stringMatching(/Bruno Klon.*64punkty/),
    ])
    // Od `sm` karty stoją obok siebie, nie jedna pod drugą.
    await expect(Math.round(leaders[0]!.getBoundingClientRect().top)).toBe(Math.round(leaders[1]!.getBoundingClientRect().top))
  },
}

/** Nazwisko z 25 znaków na telefonie 375 px: łamie się, a strona nie przewija się w bok. */
export const DlugieNazwisko: Story = {
  name: 'Długie nazwisko',
  parameters: phone375.parameters,
  globals: phone375.globals,
  args: {
    leaderboard: {
      ...goals,
      rows: [{ ...goals.rows[0]!, player: { id: 1, name: 'Krzysztof Brzęczyszczykie' } }, ...goals.rows.slice(1)],
    },
  },
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    await expect('Krzysztof Brzęczyszczykie').toHaveLength(25)
    await expect(within(canvasElement).getByText('Krzysztof Brzęczyszczykie')).toBeInTheDocument()
    await expect(window.innerWidth).toBe(375)
    const overflowing = [...canvasElement.querySelectorAll<HTMLElement>('*')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
    await expect(overflowing.map((el) => el.textContent)).toEqual([])
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}
