import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ROUNDS_PER_PAGE, groupByRound } from '../components/data/round-groups'
import { formatShortDay } from '../lib/kickoff'
import { publicBasketballLists, publicFixtures, publicResults, scheduleTimeZone } from '../lib/demo-data'
import { expectNoSideScroll } from '../test/match-list'
import { desktop1280, phone375 } from '../test/viewport'
import { RoundSections } from './round-sections'

const meta = {
  title: 'Strona publiczna/Komponenty/Mecze po kolejce',
  component: RoundSections,
  parameters: { layout: 'padded', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    rounds: groupByRound(publicFixtures, { timeZone: scheduleTimeZone }),
    mode: 'fixtures',
    timeZone: scheduleTimeZone,
    matchHref: (match) => `/t/liga-osiedlowa/mecze/${match.id}`,
  },
} satisfies Meta<typeof RoundSections>

export default meta
type Story = StoryObj<typeof meta>

/** Nazwy pokazanych kolejek w kolejności z DOM-u (kolejka to sekcja nazwana nagłówkiem h2). */
function shownRounds(canvasElement: HTMLElement) {
  return within(canvasElement)
    .getAllByRole('region')
    .map((region) => within(region).getByRole('heading', { level: 2 }).textContent)
}

/**
 * Długa liga, Terminarz: kolejki rosnąco, na start trzy pierwsze, a „Pokaż
 * więcej” dokłada po trzy. Belka niesie postęp kolejki, a „Na żywo” stoi
 * tylko przy meczu trwającym.
 */
export const DlugaLiga: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const names = args.rounds.map((round) => round.summary.name)
    await expect(names.length).toBeGreaterThan(2 * ROUNDS_PER_PAGE)
    await expect(shownRounds(canvasElement)).toEqual(names.slice(0, ROUNDS_PER_PAGE))
    await expect(canvas.getAllByText('Na żywo')).toHaveLength(1)
    await expect(canvas.getByRole('region', { name: names[0] })).toHaveTextContent(/\d+ z \d+ rozegrane/)

    await userEvent.click(canvas.getByRole('button', { name: 'Pokaż więcej' }))
    await expect(shownRounds(canvasElement)).toEqual(names.slice(0, 2 * ROUNDS_PER_PAGE))
  },
}

/**
 * Wcześniejsze kolejki mają jeszcze mecze zaplanowane (np. przełożone), a mecz
 * trwa w kolejce 9: pierwsza porcja sięga do niej włącznie, więc „Śledź na
 * żywo” z Przeglądu trafia na mecz bez klikania.
 */
export const MeczNaZywoPozaPierwszaTrojka: Story = {
  name: 'Mecz na żywo poza pierwszą trójką',
  args: {
    rounds: groupByRound(
      publicFixtures.map((match) => (match.status === 'live' ? { ...match, round: { id: 999, name: 'Kolejka 9', order: 9 } } : match)),
      { timeZone: scheduleTimeZone },
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const live = args.rounds.findIndex((round) => round.summary.id === 999)
    await expect(live).toBeGreaterThanOrEqual(ROUNDS_PER_PAGE)

    const round = within(canvas.getByRole('region', { name: 'Kolejka 9' }))
    await expect(round.getByText('Na żywo')).toBeInTheDocument()
    await expect(shownRounds(canvasElement)).toHaveLength(live + 1)
    await expect(canvas.getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument()
  },
}

/** Wyniki: kolejki od najnowszej, krótki dzień w wierszu, bez postępu na belce. */
export const Wyniki: Story = {
  args: { rounds: groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone }), mode: 'results' },
  play: async ({ canvasElement }) => {
    const numbers = shownRounds(canvasElement).map((name) => Number(name?.match(/^Kolejka (\d+)/)?.[1]))
    await expect(numbers).toHaveLength(ROUNDS_PER_PAGE)
    await expect(numbers).toEqual(numbers.toSorted((a, b) => b - a))
    await expect(canvasElement).not.toHaveTextContent(/rozegrane/)
  },
}

/**
 * Kolejka rozłożona na dwa dni pokazuje dzień w wierszu pod godziną,
 * a jednodniowa ma sam zakres dat na belce.
 */
export const KolejkaNaDwaDni: Story = {
  name: 'Kolejka na dwa dni',
  args: { rounds: groupByRound(publicBasketballLists.fixtures, { timeZone: scheduleTimeZone }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const [twoDays, oneDay] = args.rounds as [(typeof args.rounds)[number], (typeof args.rounds)[number]]
    await expect(twoDays.summary.dates).toContain('–')
    await expect(oneDay.summary.dates).not.toContain('–')

    // Mecz trwający ma w tym miejscu plakietkę „Na żywo”, więc dzień niosą mecze zaplanowane.
    const days = (round: typeof twoDays) =>
      round.matches.filter((match) => match.status === 'scheduled').map((match) => formatShortDay(match.kickoffAt, scheduleTimeZone)!)
    const twoDaysRegion = canvas.getByRole('region', { name: twoDays.summary.name })
    for (const day of days(twoDays)) await expect(twoDaysRegion).toHaveTextContent(day)
    const oneDayRegion = canvas.getByRole('region', { name: oneDay.summary.name })
    for (const day of days(oneDay)) await expect(oneDayRegion).not.toHaveTextContent(day)
  },
}

/** Telefon: ta sama lista, belka nad meczami, bez listy kolejek z boku i bez przewijania w bok. */
export const Telefon: Story = {
  ...phone375,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    const canvas = within(canvasElement)
    await expect(shownRounds(canvasElement)).toHaveLength(ROUNDS_PER_PAGE)
    await expect(canvas.queryByRole('navigation', { name: 'Kolejki' })).not.toBeInTheDocument()
    await expectNoSideScroll()
  },
}
