import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { leaderboardsBySport, publicFixtures, publicResults, scheduleTimeZone, standingsTableRows } from '../../lib/demo-data'
import { PublicOverview } from './public-overview'
import { groupByRound } from './round-groups'

const LONG_TEAM_NAME = 'Klub Sportowy Błyskawica Wawrzyszew Stare Bielany'

const meta = {
  title: 'UI/Przegląd strony publicznej',
  component: PublicOverview,
  parameters: { layout: 'padded' },
  args: {
    fixtures: groupByRound(publicFixtures, { timeZone: scheduleTimeZone }),
    results: groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone }),
    standings: standingsTableRows,
    leaderboard: leaderboardsBySport.football.goals,
    timeZone: scheduleTimeZone,
  },
} satisfies Meta<typeof PublicOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

/**
 * Telefon i drużyna o długiej nazwie w skrócie tabeli (#209): nazwa ucina się
 * wielokropkiem, a Przegląd mieści się w szerokości ekranu. Siatka sekcji bez
 * kolumny `minmax(0,1fr)` rosła do pełnej długości nazwy i strona przewijała
 * się w bok, ucinając kafel „Na żywo” i odnośniki sekcji.
 */
export const DlugaNazwaNaTelefonie: Story = {
  args: {
    standings: standingsTableRows.map((row, index) =>
      index === 0 ? { ...row, team: { ...row.team, name: LONG_TEAM_NAME } } : row,
    ),
  },
  decorators: [(Story) => <div data-testid="phone" className="w-[343px]"><Story /></div>],
  play: async ({ canvasElement }) => {
    const phone = canvasElement.querySelector<HTMLElement>('[data-testid="phone"]')!
    await expect(phone.scrollWidth).toBeLessThanOrEqual(phone.clientWidth)
  },
}
