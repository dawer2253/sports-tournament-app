import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { eventTypesBySport, scoringStatBySport } from '../../lib/demo-data'
import { EventTypeButtons } from './event-type-buttons'

const meta = {
  title: 'UI/Przyciski typów zdarzeń',
  component: EventTypeButtons,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-xs">{Story()}</div>],
  args: {
    teamName: 'Wilki Bemowo',
    types: eventTypesBySport.football,
    scoringStat: scoringStatBySport.football,
    onSelect: fn(),
  },
} satisfies Meta<typeof EventTypeButtons>

export default meta
type Story = StoryObj<typeof meta>

/** Piłka: bramka wyróżniona, samobój i kartki obok. Klik zgłasza kod typu. */
export const Pilka: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('group', { name: 'Zdarzenia: Wilki Bemowo' })

    await expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Bramka',
      'Bramka samobójcza',
      'Żółta kartka',
      'Czerwona kartka',
    ])

    await userEvent.click(canvas.getByRole('button', { name: 'Żółta kartka' }))
    await expect(args.onSelect).toHaveBeenLastCalledWith('yellow_card')
  },
}

/** Koszykówka: trzy rzuty zamiast „Punktów”, wszystkie wyróżnione. */
export const Koszykowka: Story = {
  args: {
    teamName: 'Żubry Wola',
    types: eventTypesBySport.basketball,
    scoringStat: scoringStatBySport.basketball,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Rzut za 3' }))
    await expect(args.onSelect).toHaveBeenLastCalledWith('three_pointer')
    await expect(canvas.queryByRole('button', { name: 'Punkty' })).not.toBeInTheDocument()
  },
}

/** Mecz zaplanowany albo zapis w toku: przyciski są niedostępne. */
export const Wylaczone: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled()
    }
  },
}
