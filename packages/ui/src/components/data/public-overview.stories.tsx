import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { leaderboardsBySport, publicFixtures, publicResults, scheduleTimeZone, standingsTableRows } from '../../lib/demo-data'
import { PublicOverview } from './public-overview'
import { groupByRound } from './round-groups'

const LONG_TEAM_NAME = 'Klub Sportowy Błyskawica Wawrzyszew Stare Bielany'

/** Drużyna gospodarzy meczu trwającego: jej nazwa stoi w każdej sekcji Przeglądu. */
const longTeamId = publicFixtures.find((match) => match.status === 'live')!.homeTeam!.id

/** Drużyna `longTeamId` pod długą nazwą, gdziekolwiek występuje. */
function withLongName<T extends { id: number; name: string } | null | undefined>(team: T): T {
  return team?.id === longTeamId ? { ...team, name: LONG_TEAM_NAME } : team
}

const longFixtures = publicFixtures.map((match) => ({ ...match, homeTeam: withLongName(match.homeTeam), awayTeam: withLongName(match.awayTeam) }))
const longResults = publicResults.map((match) => ({ ...match, homeTeam: withLongName(match.homeTeam), awayTeam: withLongName(match.awayTeam) }))
const goals = leaderboardsBySport.football.goals!

const meta = {
  title: 'UI/Przegląd strony publicznej',
  component: PublicOverview,
  parameters: { layout: 'padded' },
  args: {
    fixtures: groupByRound(publicFixtures, { timeZone: scheduleTimeZone }),
    results: groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone }),
    standings: standingsTableRows,
    leaderboard: goals,
    timeZone: scheduleTimeZone,
  },
} satisfies Meta<typeof PublicOverview>

export default meta
type Story = StoryObj<typeof meta>

/** Sezon w trakcie: mecz na żywo, najbliższe mecze, ostatnie wyniki, skrót tabeli i lider klasyfikacji. */
export const Domyslny: Story = {}

/**
 * Telefon i drużyna o długiej nazwie we wszystkich sekcjach (#209): nazwa ucina
 * się wielokropkiem, a Przegląd mieści się w szerokości ekranu. Siatka sekcji
 * bez kolumny `minmax(0,1fr)` rosła do pełnej długości nazwy w skrócie tabeli
 * i strona przewijała się w bok, ucinając kafel „Na żywo” i odnośniki sekcji.
 *
 * 343 px to treść `PublicShell` na telefonie 375 px: `main` ma `px-4`.
 */
export const DlugaNazwaNaTelefonie: Story = {
  args: {
    fixtures: groupByRound(longFixtures, { timeZone: scheduleTimeZone }),
    results: groupByRound(longResults, { direction: 'desc', timeZone: scheduleTimeZone }),
    standings: standingsTableRows.map((row) => ({ ...row, team: withLongName(row.team) })),
    leaderboard: { ...goals, rows: goals.rows.map((row) => ({ ...row, team: withLongName(row.team) })) },
  },
  decorators: [(Story) => <div data-testid="telefon" className="w-[343px]"><Story /></div>],
  play: async ({ canvasElement }) => {
    const phone = within(canvasElement).getByTestId('telefon')
    await expect(phone.scrollWidth).toBeLessThanOrEqual(phone.clientWidth)
    const snippetName = within(within(canvasElement).getByRole('region', { name: 'Tabela (skrót)' })).getByText(LONG_TEAM_NAME)
    await expect(snippetName.scrollWidth).toBeGreaterThan(snippetName.clientWidth)
  },
}
