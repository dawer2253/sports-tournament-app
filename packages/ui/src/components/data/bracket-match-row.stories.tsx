import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { cupChampion, cupRounds, scheduleTimeZone } from '../../lib/demo-data'
import { BracketChampion, BracketMatchRow } from './bracket-match-row'

const [quarterFinals, semiFinals, finalRound] = cupRounds.map((round) => round.matches)

const meta = {
  title: 'UI/Wiersz meczu drabinki',
  component: BracketMatchRow,
  parameters: { layout: 'padded' },
  args: { match: quarterFinals![0]!, timeZone: scheduleTimeZone },
} satisfies Meta<typeof BracketMatchRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ćwierćfinał rozstrzygnięty karnymi: wynik „2:2 (k. 4:3)”, zwycięzca
 * pogrubiony, przegrany przyciszony, krawędź do półfinału.
 */
export const PoKarnych: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('group', { name: 'Ćwierćfinał 2: Dragons – Wilki' })
    await expect(within(row).getByText('2:2 (k. 4:3)')).toBeInTheDocument()
    await expect(within(row).getByText('Dragons')).toHaveClass('font-semibold')
    await expect(within(row).getByText('Wilki')).toHaveClass('text-muted-foreground')
    await expect(within(row).getByText('zwycięzca → Półfinał 1')).toBeInTheDocument()
    await expect(within(row).getByText('Zakończony')).toBeInTheDocument()
    await expect(within(row).getByText('sob., 3 paź, 12:00')).toBeInTheDocument()
  },
}

/** Półfinał z meczem o 3. miejsce: dwie krawędzie, bez wyniku. */
export const DwieKrawedzie: Story = {
  args: { match: semiFinals![1]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('zwycięzca → Finał')).toBeInTheDocument()
    await expect(canvas.getByText('przegrany → o 3. miejsce')).toBeInTheDocument()
    await expect(canvas.getByText('–')).toBeInTheDocument()
    await expect(canvas.getByText('Zaplanowany')).toBeInTheDocument()
  },
}

/** Pusty slot mówi, skąd przyjdzie drużyna. */
export const PustySlot: Story = {
  args: { match: finalRound![0]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('group', { name: 'Mecz o 3. miejsce: Dragons – Przegrany: Półfinał 2' })).toBeInTheDocument()
    await expect(canvas.getByText('Przegrany: Półfinał 2')).toHaveClass('italic')
  },
}

/** Mecz bez terminu, prosto z generatora. */
export const BezTerminu: Story = {
  args: { match: { ...finalRound![1]!, kickoffAt: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Termin do ustalenia')).toBeInTheDocument()
    await expect(canvas.getByText('Zwycięzca: Półfinał 2')).toBeInTheDocument()
  },
}

/** Z `onSelect` cały wiersz jest przyciskiem. */
export const Klikalny: Story = {
  args: { onSelect: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Ćwierćfinał 2: Dragons – Wilki' }))
    await expect(args.onSelect).toHaveBeenCalled()
  },
}

/** Telefon: etykieta nad parą, stan i krawędzie pod nią. */
export const Telefon: Story = {
  args: { match: semiFinals![0]! },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

/** Karta mistrza pod listą rund. */
export const Mistrz: StoryObj<typeof BracketChampion> = {
  render: () => <BracketChampion team={cupChampion} className="max-w-sm" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('FC GórkaZwycięzca pucharu')
  },
}
