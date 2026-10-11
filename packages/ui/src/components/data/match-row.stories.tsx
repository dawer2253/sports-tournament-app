import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { scheduleInProgress, scheduleTimeZone, scheduleUndated } from '../../lib/demo-data'
import { MatchRow } from './match-row'
import type { MatchRowData } from './match-row-data'

const meta = {
  title: 'UI/Wiersz meczu',
  component: MatchRow,
  parameters: { layout: 'padded' },
  args: { match: scheduleInProgress[0], timeZone: scheduleTimeZone },
} satisfies Meta<typeof MatchRow>

export default meta
type Story = StoryObj<typeof meta>

const finished = scheduleInProgress.find((match) => match.status === 'finished')!
const live = scheduleInProgress.find((match) => match.status === 'live')!
const scheduled = scheduleInProgress.find((match) => match.round.order === 6)!
const colliding = scheduleInProgress.find((match) => (match.collisions?.length ?? 0) > 0)!

/** Mecz z długimi nazwami: nazwa się obcina, a nie przesuwa wyniku. */
const longNames: MatchRowData = {
  ...scheduled,
  id: 999,
  homeTeam: { id: 901, name: 'Międzyszkolny Klub Sportowy Huragan Bemowo' },
  awayTeam: { id: 902, name: 'Orły' },
}

const undated: MatchRowData = { ...scheduleUndated[0], id: 998 }

const rows: MatchRowData[] = [finished, live, colliding, scheduled, longNames, undated]

/**
 * Pomiar w przeglądarce, nie w jsdom: kolumny po bokach mają stałą szerokość,
 * więc wynik stoi w tej samej pozycji poziomej w każdym wierszu, niezależnie
 * od plakietki stanu i długości nazw (#174, DoD).
 */
async function expectScoresAligned(canvasElement: HTMLElement) {
  const scores = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-score"]')]
  await expect(scores).toHaveLength(rows.length)
  const boxes = scores.map((score) => score.getBoundingClientRect())
  for (const box of boxes) {
    await expect(box.width).toBeGreaterThan(0)
    await expect(box.left).toBeCloseTo(boxes[0].left, 1)
    await expect(box.width).toBeCloseTo(boxes[0].width, 1)
  }
}

function Rows({ timeZone }: { timeZone?: string }) {
  return (
    <div className="max-w-3xl space-y-2">
      {rows.map((match) => (
        <MatchRow key={match.id} match={match} timeZone={timeZone} />
      ))}
    </div>
  )
}

/** Zakończony, trwający, zaplanowany, z długą nazwą i bez terminu. */
export const RoznePlakietki: Story = {
  render: (args) => <Rows timeZone={args.timeZone} />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    // Pięć kolumn stoi od `sm`; węższy podgląd sprawdzałby układ telefonu.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(640)
    await expectScoresAligned(canvasElement)
  },
}

/** Telefon: termin i stan nad parą, wynik dalej w środkowej kolumnie. */
export const Telefon: Story = {
  render: (args) => <Rows timeZone={args.timeZone} />,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeLessThan(640)
    await expectScoresAligned(canvasElement)
  },
}

export const Zakonczony: Story = { args: { match: finished } }

export const Trwa: Story = { args: { match: live } }

/** Bez daty i obiektu, tak jak zaraz po wygenerowaniu terminarza. */
export const BezTerminu: Story = { args: { match: scheduleUndated[0] } }

/** Kolejka w jednym dniu: data stoi nad listą, wiersz pokazuje samą godzinę. */
export const SamaGodzina: Story = { args: { match: scheduled, showDate: false } }

/** Kolizja terminu: plakietka w stałym slocie przed stanem, opis w `title` (#175). */
export const Kolizja: Story = { args: { match: colliding } }
