import type { Meta, StoryObj } from '@storybook/react-vite'
import { Info } from 'lucide-react'
import { expect, screen, userEvent, waitFor } from 'storybook/test'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

const meta = {
  title: 'UI/Prymitywy/Tooltip',
  component: Tooltip,
  render: () => (
    <TooltipProvider>
      <div className="p-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Zasady punktacji">
              <Info className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>3 pkt za wygraną, 1 za remis</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Radix ustawia dymkowi `data-state` na `delayed-open` albo `instant-open`,
 * nigdy na `open`, więc `data-open:animate-in` go nie łapie. Animację
 * wejścia daje dopiero wariant dla konkretnego stanu (#172).
 */
async function expectEnterAnimation(state: 'delayed-open' | 'instant-open') {
  const content = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]')
    if (!element) throw new Error('Brak dymka')
    return element
  })
  await expect(content).toHaveAttribute('data-state', state)
  await expect(getComputedStyle(content).animationName).toBe('enter')
}

/** Fokus z klawiatury otwiera dymek od razu: `instant-open`. */
export const Fokus: Story = {
  play: async () => {
    await userEvent.tab()
    await expect(screen.getByRole('button', { name: 'Zasady punktacji' })).toHaveFocus()
    await expectEnterAnimation('instant-open')
  },
}

/** Najechanie otwiera dymek po opóźnieniu providera: `delayed-open`. */
export const Najechanie: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async () => {
    await userEvent.hover(screen.getByRole('button', { name: 'Zasady punktacji' }))
    await expectEnterAnimation('delayed-open')
  },
}
