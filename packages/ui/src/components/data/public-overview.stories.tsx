import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { demoBracket, groupStandings, leaderboardsBySport, publicFixtures, publicResults, scheduleTimeZone, standingsTableRows } from '../../lib/demo-data'
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

/** Drabinka playoffu z wyjścia z grup: jeden półfinał rozegrany, jak przykład `grupy`. */
const playoff = demoBracket({
  teams: 4,
  progress: { round: 1, finished: 1 },
  names: ['Sokoły Ursus', 'Żubry Praga', 'Wilki Bemowo', 'Lwy Ochota'],
})

/** Sekcje grup w skrócie, w kolejności z DOM-u. */
function groupSections(canvasElement: HTMLElement) {
  const snippet = within(canvasElement).getByRole('region', { name: 'Tabele grup (skrót)' })
  return ['Grupa A', 'Grupa B'].map((name) => within(snippet).getByRole('region', { name }))
}

/** W każdej grupie wychodzą dwa pierwsze miejsca, a linia stoi pod drugim. */
async function expectQualifiersLine(section: HTMLElement) {
  const rows = within(section).getAllByRole('row').slice(1)
  await expect(rows.map((row) => row.hasAttribute('data-qualifies'))).toEqual([true, true, false, false])
  await expect(rows[1]).toHaveClass('border-dashed')
  await expect(within(section).getByText('Wychodzą 2 z 4')).toBeInTheDocument()
}

/**
 * Turniej z grupami po wygenerowaniu drabinki (#268, wariant A z #252): karta
 * „Drabinka” nad skrótem wszystkich tabel grup, a w każdej grupie linia
 * wyjścia i zdanie, ile drużyn wychodzi. Na komputerze grupy stoją w dwóch
 * kolumnach.
 */
export const GrupyIPlayoff: Story = {
  args: {
    standings: undefined,
    groups: groupStandings,
    bracket: { matches: playoff, penaltySlot: true },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [bracket, groups] = [canvas.getByRole('region', { name: 'Drabinka' }), canvas.getByRole('region', { name: 'Tabele grup (skrót)' })]
    await expect(bracket.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(canvas.queryByRole('region', { name: 'Tabela (skrót)' })).not.toBeInTheDocument()

    const [a, b] = groupSections(canvasElement) as [HTMLElement, HTMLElement]
    await expectQualifiersLine(a)
    await expectQualifiersLine(b)
    await expect(a.getBoundingClientRect().top).toBeCloseTo(b.getBoundingClientRect().top, 0)
    await expect(b.getBoundingClientRect().left).toBeGreaterThan(a.getBoundingClientRect().right)
  },
}

/** Telefon: grupy jedna pod drugą, nazwa drużyny cała, strona nie przewija się w bok. */
export const GrupyNaTelefonie: Story = {
  ...GrupyIPlayoff,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    const [a, b] = groupSections(canvasElement) as [HTMLElement, HTMLElement]
    await expectQualifiersLine(a)
    await expect(b.getBoundingClientRect().top).toBeGreaterThan(a.getBoundingClientRect().bottom)
    const name = within(b).getByText('Niedźwiedzie Mokotów')
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  },
}
