import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { emptyLeaderboard, leaderboardsBySport, publicBasketballSeason, publicBasketballTournament } from '../../lib/demo-data'
import { boardStateText, expectBoardsStacked, expectRootWithoutSideScroll, stageFacts } from '../../test/overview'
import { desktop1280, phone375 } from '../../test/viewport'
import { OverviewDemo } from './overview-demo'

const table = (rows: (typeof publicBasketballSeason.inProgress)['rows']) => ({ rows, scoreLabel: 'Punkty', allowsDraw: false })

/** Przegląd ligi koszykówki (#296): zdobycze to „Punkty”, wyniki trzycyfrowe, bez remisów. */
const meta = {
  title: 'Strona publiczna/Ekrany/Przegląd/Liga koszykówki',
  component: OverviewDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    mode: 'league',
    tournament: publicBasketballTournament,
    lists: publicBasketballSeason.inProgress.lists,
    table: table(publicBasketballSeason.inProgress.rows),
    leaderboard: leaderboardsBySport.basketball.points!,
  },
} satisfies Meta<typeof OverviewDemo>

export default meta
type Story = StoryObj<typeof meta>

export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { teams: publicBasketballSeason.teams, lists: undefined, table: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Drużyny' })).getAllByRole('listitem')).toHaveLength(4)
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}

export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: {
    lists: publicBasketballSeason.beforeStart.lists,
    table: table(publicBasketballSeason.beforeStart.rows),
    leaderboard: emptyLeaderboard('points', 'Punkty'),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Pierwsza kolejka')).toBeInTheDocument()
    await expect(stageFacts(canvasElement)).toEqual(['sob., 5 wrz', '0 z 2 rozegrane', 'z 6 kolejek'])
  },
}

/** Czwarta kolejka: mecz trwa, drugi gra następnego dnia, więc przy godzinie stoi dzień. */
export const WTrakcie: Story = {
  name: 'W trakcie',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Kolejka 4' })).toBeInTheDocument()
    await expect(boardStateText(canvasElement, 'live')).toBe('Na żywo')
    await expect(canvasElement.querySelector('[data-slot="stage-board-kickoff"]')).toHaveTextContent(/^\d{2}:\d{2}\D+\d/)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument()
  },
}

export const Zakonczony: Story = {
  name: 'Zakończony',
  args: {
    tournament: { ...publicBasketballTournament, status: 'finished' },
    finished: true,
    lists: publicBasketballSeason.finished.lists,
    table: table(publicBasketballSeason.finished.rows),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ostatnia kolejka')).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Mistrz' })).toHaveTextContent(publicBasketballSeason.finished.rows[0]!.team.name)
    // Trzycyfrowe wyniki mieszczą się w tablicy: nic nie wystaje poza nią.
    for (const board of canvasElement.querySelectorAll<HTMLElement>('[data-slot="stage-board"]')) {
      await expect(board.scrollWidth).toBeLessThanOrEqual(board.clientWidth)
    }
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
