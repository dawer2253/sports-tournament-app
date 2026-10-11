import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { scheduleInProgress, scheduleRounds } from '../../lib/demo-data'
import { RoundList, type RoundListProps } from './round-list'

const rounds = scheduleRounds(scheduleInProgress).map((round) =>
  // Licznik kolizji wypełni #175. Tu jeden, żeby było widać, że ułamek stoi
  // w tym samym miejscu z licznikiem i bez niego.
  round.id === 6 ? { ...round, collisions: 2 } : round,
)

const meta = {
  title: 'UI/Lista kolejek',
  component: RoundList,
  parameters: { layout: 'padded' },
  args: { rounds, value: 5, onValueChange: fn() },
  // Wybór żyje w stanie, tak jak w panelu, żeby po kliknięciu było widać
  // nową bieżącą kolejkę.
  render: function Render(args: RoundListProps) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="max-w-xs">
        <RoundList
          {...args}
          value={value}
          onValueChange={(id) => {
            setValue(id)
            args.onValueChange(id)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof RoundList>

export default meta
type Story = StoryObj<typeof meta>

/** Od `md`: wszystkie kolejki w kolumnie, bieżąca podświetlona. */
export const Kolumna: Story = {
  globals: { viewport: { value: 'tablet', isRotated: false } },
}

/**
 * Telefon (#174, DoD): lista jest zwinięta do przycisku z bieżącą kolejką,
 * rozwija się po kliknięciu i zwija po wyborze kolejki.
 */
export const Telefon: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    // Bez telefonowej szerokości test sprawdzałby kolumnę, a nie zwinięcie.
    await expect(window.innerWidth).toBeLessThan(768)
    const canvas = within(canvasElement)

    const toggle = canvas.getByRole('button', { expanded: false })
    await expect(toggle).toHaveTextContent('Kolejka 5')
    await expect(canvas.queryByRole('list', { name: 'Kolejki' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('navigation', { name: 'Kolejki' })).not.toBeInTheDocument()

    await userEvent.click(toggle)
    const list = canvas.getByRole('list', { name: 'Kolejki' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(within(list).getAllByRole('button')).toHaveLength(rounds.length)

    await userEvent.click(within(list).getByRole('button', { name: /^Kolejka 7\b/ }))
    await expect(args.onValueChange).toHaveBeenCalledWith(7)
    await expect(canvas.queryByRole('list', { name: 'Kolejki' })).not.toBeInTheDocument()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveTextContent('Kolejka 7')

    await userEvent.click(canvas.getByRole('button', { name: 'Następna kolejka' }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(8)
    await expect(toggle).toHaveTextContent('Kolejka 8')
  },
}
