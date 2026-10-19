import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { publicFixtures, publicResults, scheduleTimeZone } from '../../lib/demo-data'
import { groupByRound } from './round-groups'
import { RoundSections } from './round-sections'
import { ROUNDS_PER_PAGE } from './round-groups'

const meta = {
  title: 'Strona publiczna/Do przepisania/Mecze po kolejce',
  component: RoundSections,
  parameters: { layout: 'padded' },
  args: {
    rounds: groupByRound(publicFixtures, { timeZone: scheduleTimeZone }),
    timeZone: scheduleTimeZone,
    statusDisplay: 'live',
  },
} satisfies Meta<typeof RoundSections>

export default meta
type Story = StoryObj<typeof meta>

/** Nazwy pokazanych kolejek w kolejności z DOM-u (nagłówek sekcji kolejki to h2). */
function shownRounds(canvasElement: HTMLElement) {
  return within(canvasElement)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
}

/**
 * Długa liga, Terminarz: kolejki rosnąco, na start trzy pierwsze, a „Pokaż
 * więcej” dokłada po trzy. Mecz trwający ma `LiveMarker`, zaplanowane nie mają
 * plakietki stanu.
 */
export const DlugaLiga: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const names = args.rounds.map((round) => round.summary.name)
    await expect(names.length).toBeGreaterThan(2 * ROUNDS_PER_PAGE)
    await expect(shownRounds(canvasElement)).toEqual(names.slice(0, ROUNDS_PER_PAGE))
    await expect(canvas.getAllByText('Na żywo')).toHaveLength(1)
    await expect(canvas.queryByText('Zaplanowany')).not.toBeInTheDocument()

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
  args: {
    rounds: groupByRound(
      publicFixtures.map((match) =>
        match.status === 'live' ? { ...match, round: { id: 999, name: 'Kolejka 9', order: 9 } } : match,
      ),
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

/** Wyniki: kolejki od najnowszej, ze strzelcami pod wynikiem (#208). */
export const Wyniki: Story = {
  args: { rounds: groupByRound(publicResults, { direction: 'desc', timeZone: scheduleTimeZone }) },
  play: async ({ canvasElement }) => {
    const numbers = shownRounds(canvasElement).map((name) => Number(name?.match(/^Kolejka (\d+)/)?.[1]))
    await expect(numbers).toHaveLength(ROUNDS_PER_PAGE)
    await expect(numbers).toEqual(numbers.toSorted((a, b) => b - a))
  },
}

/** Telefon: ta sama lista, nagłówek nad meczami, bez listy kolejek z boku. */
export const Telefon: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeLessThan(1024)
    const canvas = within(canvasElement)
    await expect(shownRounds(canvasElement)).toHaveLength(ROUNDS_PER_PAGE)
    await expect(canvas.queryByRole('navigation', { name: 'Kolejki' })).not.toBeInTheDocument()
  },
}
