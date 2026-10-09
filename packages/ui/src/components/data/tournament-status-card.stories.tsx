import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TournamentStatusCard } from './tournament-status-card'

const PUBLIC_URL = 'http://localhost:5174/t/liga-osiedlowa'

const meta = {
  title: 'UI/Karta statusu turnieju',
  component: TournamentStatusCard,
  parameters: { layout: 'padded' },
  args: { status: 'draft', onChange: fn(), publicUrl: PUBLIC_URL, pending: false },
} satisfies Meta<typeof TournamentStatusCard>

export default meta
type Story = StoryObj<typeof meta>

/** Przyciski karty w kolejności, w jakiej stoją. */
function buttonNames(canvasElement: HTMLElement) {
  return within(canvasElement)
    .getAllByRole('button')
    .map((button) => button.textContent?.trim())
}

/** Szkic: tylko „Opublikuj" i bez linku, bo strona dałaby `404`. */
export const Szkic: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Szkic')).toBeInTheDocument()
    await expect(buttonNames(canvasElement)).toEqual(['Opublikuj'])
    await expect(canvas.queryByRole('link', { name: /Otwórz stronę/ })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Opublikuj' }))
    await expect(args.onChange).toHaveBeenCalledWith('active')
  },
}

/** Trwający: „Zakończ", „Cofnij do szkicu" i link do strony w nowej karcie. */
export const Trwa: Story = {
  args: { status: 'active' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Trwa')).toBeInTheDocument()
    await expect(buttonNames(canvasElement)).toEqual(['Zakończ', 'Cofnij do szkicu'])
    const link = canvas.getByRole('link', { name: /Otwórz stronę/ })
    await expect(link).toHaveAttribute('href', PUBLIC_URL)
    await expect(link).toHaveAttribute('target', '_blank')

    await userEvent.click(canvas.getByRole('button', { name: 'Zakończ' }))
    await expect(args.onChange).toHaveBeenLastCalledWith('finished')
    // Potwierdzenie powrotu do szkicu należy do aplikacji, karta tylko woła.
    await userEvent.click(canvas.getByRole('button', { name: 'Cofnij do szkicu' }))
    await expect(args.onChange).toHaveBeenLastCalledWith('draft')
  },
}

/** Zakończony: „Wznów" i „Cofnij do szkicu", link zostaje. */
export const Zakonczony: Story = {
  args: { status: 'finished' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Zakończony')).toBeInTheDocument()
    await expect(buttonNames(canvasElement)).toEqual(['Wznów', 'Cofnij do szkicu'])
    await expect(canvas.getByRole('link', { name: /Otwórz stronę/ })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Wznów' }))
    await expect(args.onChange).toHaveBeenCalledWith('active')
  },
}

/** W trakcie zapisu przyciski są zablokowane. */
export const Zapisywanie: Story = {
  args: { status: 'active', pending: true },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(button).toBeDisabled()
    }
  },
}
