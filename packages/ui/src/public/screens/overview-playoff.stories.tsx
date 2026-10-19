import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { leaderboardsBySport, publicGroupsSeason, publicTournament } from '../../lib/demo-data'
import { boardStateText, expectBoardsStacked, expectRootWithoutSideScroll } from '../../test/overview'
import { desktop1280, phone375 } from '../../test/viewport'
import type { PublicShellTournament } from '../public-shell-tournament'
import { OverviewDemo } from './overview-demo'

const groupsTournament: PublicShellTournament = { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }

/**
 * Przegląd turnieju z grupami po wygenerowaniu drabinki (#296): w pasie
 * runda playoffu, w miejscu tabeli drabinka, a tabele grup schodzą pod
 * odnośnik „Tabele grup”.
 */
const meta = {
  title: 'Strona publiczna/Ekrany/Przegląd/Grupy w playoffie',
  component: OverviewDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    mode: 'playoff',
    tournament: groupsTournament,
    lists: publicGroupsSeason.playoff.lists,
    bracket: publicGroupsSeason.playoff.matches,
    leaderboard: leaderboardsBySport.football.goals!,
  },
} satisfies Meta<typeof OverviewDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Półfinały playoffu: drabinka i odnośnik „Tabele grup”, bez tabel. */
export const WTrakcie: Story = {
  name: 'W trakcie',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Półfinał' })).getByText('Bieżąca runda')).toBeInTheDocument()
    await expect(boardStateText(canvasElement, 'live')).toBe('Na żywo')
    await expect(canvas.getByRole('region', { name: 'Drabinka' }).querySelectorAll('[data-slot="bracket-tile"]').length).toBeGreaterThan(0)
    await expect(canvas.getByRole('link', { name: 'Tabele grup' })).toHaveAttribute('href', '/t/grupy-osiedlowe-2026/tabela')
    await expect(canvas.queryByRole('region', { name: 'Grupa A' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}

export const Zakonczony: Story = {
  name: 'Zakończony',
  args: {
    tournament: { ...groupsTournament, status: 'finished' },
    finished: true,
    lists: publicGroupsSeason.playoffFinished.lists,
    bracket: publicGroupsSeason.playoffFinished.matches,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Mistrz' })).toBeInTheDocument()
    await expect(canvas.getByText('Ostatnia runda')).toBeInTheDocument()
  },
}

export const WTrakcieTelefon: Story = {
  name: 'W trakcie, telefon',
  parameters: phone375.parameters,
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expectBoardsStacked(canvasElement)
    await expectRootWithoutSideScroll()
  },
}
