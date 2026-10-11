import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { expectCheckedFill } from '../../test/checked'
import { Label } from './label'
import { Switch } from './switch'

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

/** Etykiety to kryteria rozstrzygające (`Tiebreaker` w `CONTEXT.md`) w wersji piłkarskiej. */
function States({ size }: Pick<ComponentProps<typeof Switch>, 'size'>) {
  return (
    <div className="flex flex-col gap-4">
      <Label>
        <Switch size={size} /> Bramki zdobyte
      </Label>
      <Label>
        <Switch size={size} defaultChecked /> Bezpośredni mecz
      </Label>
      <Label>
        <Switch size={size} defaultChecked disabled /> Różnica bramek
      </Label>
    </div>
  )
}

export const Stany: Story = {
  render: () => <States />,
  play: async () => {
    await expectCheckedFill(
      screen.getByRole('switch', { name: 'Bezpośredni mecz' }),
      screen.getByRole('switch', { name: 'Bramki zdobyte' }),
    )
  },
}

export const Maly: Story = {
  render: () => <States size="sm" />,
  play: Stany.play,
}

/** Bez snapshotu: ciemne snapshoty Chromatica to osobna decyzja. */
export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => <States />,
  play: Stany.play,
}
