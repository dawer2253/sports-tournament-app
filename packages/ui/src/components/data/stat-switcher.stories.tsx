import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { leaderboardsBySport, statOptionsBySport } from '../../lib/demo-data'
import { LeaderboardTable } from './leaderboard-table'
import { StatSwitcher, type StatSwitcherProps } from './stat-switcher'

/** Wybór trzymany poza przełącznikiem, jak w adresie strony publicznej. */
function ControlledSwitcher(props: StatSwitcherProps) {
  const [value, setValue] = useState(props.value)
  return (
    <StatSwitcher
      {...props}
      value={value}
      onValueChange={(code) => {
        setValue(code)
        props.onValueChange(code)
      }}
    >
      <LeaderboardTable leaderboard={leaderboardsBySport.football[value]!} />
    </StatSwitcher>
  )
}

const meta = {
  title: 'UI/Przełącznik statystyk',
  component: StatSwitcher,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
  render: (args) => <ControlledSwitcher {...args} />,
  args: {
    stats: statOptionsBySport.football,
    value: 'goals',
    onValueChange: fn(),
    children: null,
  },
} satisfies Meta<typeof StatSwitcher>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Trzy statystyki piłki. Klik w zakładkę zgłasza kod statystyki, a nie jej
 * etykietę — wywołujący wpisuje go do `?stat=`.
 */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(canvas.getByRole('tab', { name: 'Żółte kartki' }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith('yellowCards')
    await expect(canvas.getByRole('tab', { name: 'Żółte kartki' })).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveAccessibleName('Żółte kartki')
    await expect(canvas.getByRole('columnheader', { name: 'Żółte kartki' })).toBeInTheDocument()
  },
}
