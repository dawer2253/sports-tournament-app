import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { groupByRound } from '../components/data/round-groups'
import { publicCupLists, publicLeagueSeason, scheduleTimeZone } from '../lib/demo-data'
import { overviewRounds } from './overview-stage'
import { StageBand } from './stage-band'

const league = overviewRounds(
  groupByRound(publicLeagueSeason.inProgress.lists.fixtures, { timeZone: scheduleTimeZone }),
  groupByRound(publicLeagueSeason.inProgress.lists.results, { direction: 'desc', timeZone: scheduleTimeZone }),
  scheduleTimeZone,
)

const cupMatches = [...publicCupLists.results, ...publicCupLists.fixtures]
/** Ćwierćfinał rozstrzygnięty karnymi i finał z pustymi slotami: dwie skrajności tablicy pucharu. */
const cupBoards = [cupMatches.find((match) => match.homePenalties != null)!, cupMatches.find((match) => match.bracket?.label === 'Finał')!]

const meta = {
  title: 'Strona publiczna/Komponenty/Pas etapu',
  component: StageBand,
  parameters: { layout: 'padded' },
  args: {
    round: league.stage!.round,
    position: league.stage!.position,
    unit: 'round',
    roundsTotal: league.roundsTotal,
    timeZone: scheduleTimeZone,
    matchHref: (match) => `/t/liga-osiedlowa/mecze/${match.id}`,
  },
} satisfies Meta<typeof StageBand>

export default meta
type Story = StoryObj<typeof meta>

/** Kolejka w trakcie: tablica zakończona, trwająca ze strzelcami i zaplanowana z godziną. */
export const Kolejka: Story = {
  play: async ({ canvasElement }) => {
    const live = canvasElement.querySelector<HTMLElement>('[data-slot="stage-board"][data-status="live"]')!
    await expect(within(live).getByText('Na żywo')).toBeInTheDocument()
    await expect(live.querySelector('[data-slot="stage-board-scorers"]')).not.toBeNull()
    // Bez kropek między faktami: każdy fakt to osobny element.
    await expect(canvasElement.querySelector('[data-slot="stage-band"]')!.textContent).not.toContain('·')
  },
}

/**
 * Puchar: karne w nawiasie z „w karnych” dla czytnika, przegrany po karnych
 * przygaszony, a pusty slot ze źródłem kursywą, jak w wierszu meczu.
 */
export const PucharKarneIPustySlot: Story = {
  name: 'Puchar: karne i pusty slot',
  args: {
    round: { summary: { id: 0, name: 'Ćwierćfinał', dates: 'sob., 5 wrz', finished: 1, total: 2 }, matches: cupBoards },
    position: 'current',
    unit: 'knockout',
    roundsTotal: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Bieżąca runda')).toBeInTheDocument()
    const [penalties, final] = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="stage-board"]')]
    await expect(penalties!.querySelectorAll('[data-slot="penalties"]')).toHaveLength(2)
    await expect(penalties!.querySelectorAll('[data-dim]')).toHaveLength(1)
    // Pierwszy półfinał zakończony, drugi trwa: gość finału czeka na zwycięzcę.
    await expect(final).toHaveAccessibleName(/ – Zwycięzca: Półfinał 2$/)
  },
}
