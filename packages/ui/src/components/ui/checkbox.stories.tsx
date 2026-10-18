import type { Meta, StoryObj } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { expectCheckedFill } from '../../test/checked'
import { Checkbox } from './checkbox'
import { Label } from './label'

const meta = {
  title: 'UI/Prymitywy/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

/** Etykiety to kryteria rozstrzygające (`Tiebreaker` w `CONTEXT.md`) w wersji piłkarskiej. */
function States() {
  return (
    <div className="flex flex-col gap-4">
      <Label>
        <Checkbox /> Bramki zdobyte
      </Label>
      <Label>
        <Checkbox defaultChecked /> Bezpośredni mecz
      </Label>
      <Label>
        <Checkbox defaultChecked disabled /> Różnica bramek
      </Label>
    </div>
  )
}

export const Stany: Story = {
  render: () => <States />,
  play: async () => {
    await expectCheckedFill(
      screen.getByRole('checkbox', { name: 'Bezpośredni mecz' }),
      screen.getByRole('checkbox', { name: 'Bramki zdobyte' }),
    )
  },
}

/** Bez snapshotu: ciemne snapshoty Chromatica to osobna decyzja. */
export const CiemnyMotyw: Story = {
  globals: { theme: 'dark' },
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => <States />,
  play: Stany.play,
}
