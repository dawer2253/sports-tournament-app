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

function States({ size }: { size?: 'sm' | 'default' }) {
  return (
    <div className="flex flex-col gap-4">
      <Label>
        <Switch size={size} /> Publiczny terminarz
      </Label>
      <Label>
        <Switch size={size} defaultChecked /> Publiczna tabela
      </Label>
      <Label>
        <Switch size={size} defaultChecked disabled /> Zgłoszenia zamknięte
      </Label>
    </div>
  )
}

export const Stany: Story = {
  render: () => <States />,
  play: async () => {
    await expectCheckedFill(
      screen.getByRole('switch', { name: 'Publiczna tabela' }),
      screen.getByRole('switch', { name: 'Publiczny terminarz' }),
    )
  },
}

export const Maly: Story = {
  render: () => <States size="sm" />,
  play: Stany.play,
}

export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  render: () => <States />,
  play: Stany.play,
}
