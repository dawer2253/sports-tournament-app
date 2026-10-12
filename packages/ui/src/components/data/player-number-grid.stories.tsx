import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { demoRoster } from '../../lib/demo-data'
import { PlayerNumberGrid, type PlayerNumberGridProps } from './player-number-grid'

/** Minuta trzymana jak w oknie meczu: stan poza siatką, która tylko go zgłasza. */
function ControlledGrid(props: PlayerNumberGridProps) {
  const [minute, setMinute] = useState(props.minute)
  return (
    <PlayerNumberGrid
      {...props}
      minute={minute}
      onMinuteChange={(next) => {
        setMinute(next)
        props.onMinuteChange(next)
      }}
    />
  )
}

const meta = {
  title: 'UI/Siatka numerów zawodników',
  component: PlayerNumberGrid,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-xs">{Story()}</div>],
  render: (args) => <ControlledGrid {...args} />,
  args: {
    title: 'Bramka — kto?',
    players: demoRoster(1),
    minute: '37',
    onSelect: fn(),
    onBack: fn(),
    onMinuteChange: fn(),
  },
} satisfies Meta<typeof PlayerNumberGrid>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Jedenastu zawodników; dwóch ostatnich bez numeru ma „—”. Klik w kafelek
 * zgłasza id zawodnika, pole minuty przyjmuje same cyfry.
 */
export const Domyslna: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const [first] = args.players
    const withoutNumber = args.players.at(-1)!

    await expect(canvas.getAllByRole('listitem')).toHaveLength(args.players.length)
    await expect(canvas.getByRole('button', { name: withoutNumber.name })).toHaveTextContent('—')

    await userEvent.click(canvas.getByRole('button', { name: `${first.number}. ${first.name}` }))
    await expect(args.onSelect).toHaveBeenLastCalledWith(first.id)

    const minute = canvas.getByLabelText('Minuta')
    await userEvent.clear(minute)
    await userEvent.type(minute, '9a3')
    await expect(minute).toHaveValue('93')
    await expect(args.onMinuteChange).toHaveBeenLastCalledWith('93')

    await userEvent.click(canvas.getByRole('button', { name: 'Wróć do typów zdarzeń' }))
    await expect(args.onBack).toHaveBeenCalledOnce()
  },
}

/** Zapis w toku: kafelki i pole minuty są niedostępne. */
export const Zapisywanie: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Minuta')).toBeDisabled()
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled()
    }
  },
}
