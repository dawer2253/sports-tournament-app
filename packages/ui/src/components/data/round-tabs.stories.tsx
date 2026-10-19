import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { cupRounds } from '../../lib/demo-data'
import { RoundTabs, type RoundTabsProps } from './round-tabs'

const meta = {
  title: 'Panel/UI/Dane/Karty rund',
  component: RoundTabs,
  parameters: { layout: 'padded' },
  args: { rounds: cupRounds.map((round) => round.summary), value: cupRounds[1]!.summary.id, onValueChange: fn() },
  render: function Render(args: RoundTabsProps) {
    const [value, setValue] = useState(args.value)
    return (
      <RoundTabs
        {...args}
        value={value}
        onValueChange={(id) => {
          setValue(id)
          args.onValueChange(id)
        }}
      />
    )
  },
} satisfies Meta<typeof RoundTabs>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Drabinka sześciu drużyn w trakcie: ćwierćfinał rozegrany, półfinał
 * w połowie. Wybór karty idzie do `onValueChange` z `id` rundy.
 */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = within(canvas.getByRole('tablist', { name: 'Rundy' })).getAllByRole('tab')
    await expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Ćwierćfinał sob., 3 paź · 2/2zakończone 2 z 2',
      'Półfinał sob., 10 paź · 1/2zakończone 1 z 2',
      'Finał sob., 17 paź · 0/2zakończone 0 z 2',
    ])
    await expect(canvas.getByRole('tab', { selected: true })).toHaveTextContent('Półfinał')

    await userEvent.click(canvas.getByRole('tab', { name: /Finał/ }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(cupRounds[2]!.summary.id)
    await expect(canvas.getByRole('tab', { selected: true })).toHaveTextContent('Finał')
  },
}
