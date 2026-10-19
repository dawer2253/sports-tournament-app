import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { demoBracket, scheduleTimeZone } from '../../lib/demo-data'
import { BracketSummary } from './bracket-summary'
import { BracketTree } from './bracket-tree'

const live = demoBracket({ teams: 16, progress: { round: 2, finished: 2, live: 1 } })

const meta = {
  title: 'Strona publiczna/Do przepisania/Drzewo drabinki',
  component: BracketTree,
  parameters: { layout: 'padded' },
  args: { matches: live, penaltySlot: true, timeZone: scheduleTimeZone },
  // Telefon: dwie kolumny, więc okno ma dokąd się przesuwać.
  globals: { viewport: { value: 'mobile2', isRotated: false } },
} satisfies Meta<typeof BracketTree>

export default meta
type Story = StoryObj<typeof meta>

function headings(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll('[data-slot="bracket-column-heading"] p:first-child')].map((heading) => heading.textContent)
}

/**
 * Okno startuje od rundy z pierwszym niezakończonym meczem; pigułka rundy
 * z meczem trwającym ma kropkę z tekstem dla czytnika, a strzałki przesuwają
 * okno o rundę i zgłaszają `order` pierwszej rundy.
 */
export const Strzalki: Story = {
  args: { onStartChange: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(headings(canvasElement)).toEqual(['Ćwierćfinał', 'Półfinał']))
    const pills = within(canvas.getByRole('group', { name: 'Rundy' }))
    await expect(pills.getByRole('button', { name: 'Ćwierćfinał, trwa mecz' })).toHaveAttribute('aria-current', 'true')
    await expect(pills.getByRole('button', { name: 'Finał' })).not.toHaveAttribute('aria-current')

    await step('„›” zgłasza następną rundę', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Następna runda' }))
      await expect(args.onStartChange).toHaveBeenLastCalledWith(3)
    })
  },
}

/** Bez `onStartChange` okno trzyma stan samo: pigułka przesuwa je na swoją rundę. */
export const Pigulki: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(within(canvas.getByRole('group', { name: 'Rundy' })).getByRole('button', { name: 'Finał' }))
    // Okno nie wychodzi za finał: dwie kolumny kończą się na nim.
    await waitFor(() => expect(headings(canvasElement)).toEqual(['Półfinał', 'Finał']))
    await expect(canvas.getByRole('button', { name: 'Następna runda' })).toBeDisabled()
  },
}

/** Gest w bok przesuwa okno o rundę, a ruch głównie pionowy zostaje przewijaniem. */
export const GestWBok: Story = {
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-column"]')!.closest('[style*="touch-action"]')!
    await expect(getComputedStyle(tree).touchAction).toBe('pan-y')
    // Prawdziwe `Touch`, bo Chromium nie zbuduje `TouchEvent` z gołych obiektów.
    const touch = (clientX: number, clientY: number) => new Touch({ identifier: 1, target: tree, clientX, clientY })
    const swipe = (dx: number, dy: number) => {
      const start = touch(200, 300)
      const end = touch(200 + dx, 300 + dy)
      tree.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }))
      tree.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }))
    }

    swipe(30, 200)
    await expect(headings(canvasElement)).toEqual(['Ćwierćfinał', 'Półfinał'])
    swipe(-80, 10)
    await waitFor(() => expect(headings(canvasElement)).toEqual(['Półfinał', 'Finał']))
  },
}

/** Karta „Drabinka” Przeglądu: rundy z postępem, bieżąca wyróżniona, drużyny w grze. */
export const KartaPrzegladu: StoryObj<typeof BracketSummary> = {
  render: () => (
    <div className="max-w-md">
      <BracketSummary matches={live} penaltySlot timeZone={scheduleTimeZone} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('W grze 6 z 16 drużyn')).toBeInTheDocument()
    const current = canvasElement.querySelector('li[aria-current="step"]')!
    await expect(current).toHaveTextContent('Ćwierćfinał')
    await expect(current).toHaveTextContent('2/4')
  },
}

/** Po finale karta pokazuje mistrza i kafel finału. */
export const KartaPoFinale: StoryObj<typeof BracketSummary> = {
  render: () => (
    <div className="max-w-md">
      <BracketSummary matches={demoBracket({ teams: 8, progress: 'done' })} penaltySlot timeZone={scheduleTimeZone} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Zwycięzca pucharu')
    await expect(canvas.getByRole('group', { name: /^Finał:/ })).toBeInTheDocument()
    // Po finale bieżąca jest ostatnia runda, ta sama, na której kończy się okno Drabinki.
    await expect(canvasElement.querySelector('li[aria-current="step"]')).toHaveTextContent('Finał')
  },
}
