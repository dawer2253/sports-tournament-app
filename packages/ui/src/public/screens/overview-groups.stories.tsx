import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { emptyLeaderboard, leaderboardsBySport, publicGroupsSeason, publicTournament } from '../../lib/demo-data'
import { expectBoardsStacked, expectRootWithoutSideScroll, stageFacts } from '../../test/overview'
import { desktop1280, phone375 } from '../../test/viewport'
import type { PublicShellTournament } from '../public-shell-tournament'
import { OverviewDemo } from './overview-demo'

const groupsTournament: PublicShellTournament = { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }

const groups = (moment: typeof publicGroupsSeason.inProgress) =>
  moment.tables.map((group) => ({ ...group, stageName: 'Faza grupowa', scoreLabel: 'Bramki', allowsDraw: true }))

/**
 * Przegląd turnieju z grupami w fazie grupowej (#296): w miejscu tabeli
 * tabele wszystkich grup w dwóch kolumnach, bez bramek i formy, z linią
 * wyjścia.
 */
const meta = {
  title: 'Strona publiczna/Ekrany/Przegląd/Grupy w fazie grupowej',
  component: OverviewDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    mode: 'groups',
    tournament: groupsTournament,
    lists: publicGroupsSeason.inProgress.lists,
    groups: groups(publicGroupsSeason.inProgress),
    leaderboard: leaderboardsBySport.football.goals!,
  },
} satisfies Meta<typeof OverviewDemo>

export default meta
type Story = StoryObj<typeof meta>

export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { teams: publicGroupsSeason.teams, lists: undefined, groups: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Drużyny' })).getAllByRole('listitem')).toHaveLength(8)
    await expect(canvas.queryByRole('region', { name: 'Grupa A' })).not.toBeInTheDocument()
  },
}

export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: {
    lists: publicGroupsSeason.beforeStart.lists,
    groups: groups(publicGroupsSeason.beforeStart),
    leaderboard: emptyLeaderboard('goals', 'Bramki'),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Pierwsza kolejka')).toBeInTheDocument()
    // Kolejka grup ma mecze obu grup.
    await expect(stageFacts(canvasElement)).toEqual(['sob., 5 wrz', '0 z 4 rozegrane'])
  },
}

/** Trzecia kolejka: Grupa A rozegrana, Grupa B jeszcze gra; tabele w dwóch kolumnach od `lg`. */
export const WTrakcie: Story = {
  name: 'W trakcie',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Kolejka 3' })).toBeInTheDocument()
    const a = canvas.getByRole('region', { name: 'Grupa A' })
    const b = canvas.getByRole('region', { name: 'Grupa B' })
    await expect(Math.round(b.getBoundingClientRect().top)).toBe(Math.round(a.getBoundingClientRect().top))
    // Bez bramek i formy: tabela grupy jest wąska.
    await expect(within(a).queryByRole('columnheader', { name: 'Forma' })).not.toBeInTheDocument()
    await expect(within(a).queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument()
    await expect(a.querySelector('[data-slot="qualifiers-line"]')).not.toBeNull()
    await expect(canvas.queryByRole('region', { name: 'Drabinka' })).not.toBeInTheDocument()
  },
}

export const WTrakcieTelefon: Story = {
  name: 'W trakcie, telefon',
  parameters: phone375.parameters,
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectBoardsStacked(canvasElement)
    await expectRootWithoutSideScroll()
    // Na telefonie grupy stoją jedna pod drugą.
    const a = canvas.getByRole('region', { name: 'Grupa A' })
    const b = canvas.getByRole('region', { name: 'Grupa B' })
    await expect(b.getBoundingClientRect().top).toBeGreaterThan(a.getBoundingClientRect().bottom - 1)
  },
}
