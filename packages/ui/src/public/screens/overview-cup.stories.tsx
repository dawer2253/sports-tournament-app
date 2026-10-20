import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { emptyLeaderboard, leaderboardsBySport, publicCupSeason, publicCupTournament } from '../../lib/demo-data'
import { boardStateText, expectBoardsStacked, expectRootWithoutSideScroll, stageBoards, stageFacts } from '../../test/overview'
import { desktop1280, phone375 } from '../../test/viewport'
import { OverviewDemo } from './overview-demo'

/**
 * Przegląd pucharu (#296): w pasie runda, w miejscu tabeli drabinka (okno do
 * 4 rund, na telefonie jedna runda), obok najbliższe mecze.
 */
const meta = {
  title: 'Strona publiczna/Ekrany/Przegląd/Puchar',
  component: OverviewDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    mode: 'knockout',
    tournament: publicCupTournament,
    lists: publicCupSeason.inProgress.lists,
    bracket: publicCupSeason.inProgress.matches,
    leaderboard: leaderboardsBySport.football.goals!,
  },
} satisfies Meta<typeof OverviewDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Przed losowaniem drabinki: same drużyny pucharu. */
export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { teams: publicCupSeason.teams, lists: undefined, bracket: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Drużyny' })).getAllByRole('listitem')).toHaveLength(8)
    await expect(canvas.queryByRole('region', { name: 'Drabinka' })).not.toBeInTheDocument()
  },
}

export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: { lists: publicCupSeason.beforeStart.lists, bracket: publicCupSeason.beforeStart.matches, leaderboard: emptyLeaderboard('goals', 'Bramki') },
  play: async ({ canvasElement }) => {
    const band = within(within(canvasElement).getByRole('region', { name: 'Ćwierćfinał' }))
    await expect(band.getByText('Pierwsza runda')).toBeInTheDocument()
    await expect(stageFacts(canvasElement)).toEqual(['sob., 5 wrz', '0 z 4 rozegrane'])
  },
}

/** Półfinały: pierwszy zakończony, drugi trwa; obok finał i mecz o 3. miejsce z pustymi slotami. */
export const WTrakcie: Story = {
  name: 'W trakcie',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Półfinał' })).getByText('Bieżąca runda')).toBeInTheDocument()
    await expect(stageBoards(canvasElement)).toHaveLength(2)
    await expect(boardStateText(canvasElement, 'finished')).toBe('Koniec')
    await expect(boardStateText(canvasElement, 'live')).toBe('Na żywo')
    const next = within(canvas.getByRole('region', { name: 'Najbliższe mecze' }))
    await expect(next.getAllByRole('link', { name: / – / }).map((link) => link.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/Półfinał 2$/),
      expect.stringMatching(/Półfinał 2$/),
    ])
    await expect(canvas.getByRole('region', { name: 'Drabinka' }).querySelectorAll('[data-slot="bracket-tile"]').length).toBeGreaterThan(0)
  },
}

/** Po finale rozstrzygniętym karnymi: „Mistrz” to drużyna z wyższymi karnymi. */
export const Zakonczony: Story = {
  name: 'Zakończony',
  args: {
    tournament: { ...publicCupTournament, status: 'finished' },
    finished: true,
    lists: publicCupSeason.finished.lists,
    bracket: publicCupSeason.finished.matches,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const final = publicCupSeason.finished.matches.find((match) => match.round.name === 'Finał' && match.matchNumber === 1)!
    // Demo: finał 2:2, karne 5:4 dla gospodarza.
    await expect(canvas.getByRole('region', { name: 'Mistrz' })).toHaveTextContent(final.homeTeam!.name)
    // Jeden mistrz: pas nad drabinką, bez drugiego kafla w drabince (#303).
    await expect(canvas.getAllByRole('region', { name: 'Mistrz' })).toHaveLength(1)
    await expect(canvas.queryByRole('status', { name: 'Mistrz' })).not.toBeInTheDocument()
    await expect(canvas.getByText('Ostatnia runda')).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Najbliższe mecze' })).not.toBeInTheDocument()
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
