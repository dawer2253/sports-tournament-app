import type { Meta, StoryObj } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { expectCheckedFill } from '../../test/checked'
import { Checkbox } from './checkbox'
import { Label } from './label'

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

function States() {
  return (
    <div className="flex flex-col gap-4">
      <Label>
        <Checkbox /> Mecz o 3. miejsce
      </Label>
      <Label>
        <Checkbox defaultChecked /> Dogrywka w fazie pucharowej
      </Label>
      <Label>
        <Checkbox defaultChecked disabled /> Rzuty karne
      </Label>
    </div>
  )
}

export const Stany: Story = {
  render: () => <States />,
  play: async () => {
    await expectCheckedFill(
      screen.getByRole('checkbox', { name: 'Dogrywka w fazie pucharowej' }),
      screen.getByRole('checkbox', { name: 'Mecz o 3. miejsce' }),
    )
  },
}

export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  render: () => <States />,
  play: Stany.play,
}
