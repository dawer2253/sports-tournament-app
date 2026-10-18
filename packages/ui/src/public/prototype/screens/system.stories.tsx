/**
 * PROTOTYP S7 (#288) — „nie znaleziono”, błąd i wczytywanie w języku C.
 * Gałąź `prototype/s7-kierunek`, nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import { ScreenSwitcher } from './kit'
import { season } from './screen-demo'
import { SYSTEM_STATES, SystemScreen, type SystemState } from './system'

type Args = { state: SystemState; accent: AccentKey }

function Screen(args: Args) {
  return <SystemScreen state={args.state} data={season('liga', 'w-trakcie')} accent={ACCENT_SAMPLES[args.accent].hex} />
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Nie znaleziono i błędy',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher args={args} update={update} controls={[{ key: 'state', options: SYSTEM_STATES }]} />
      </>
    )
  },
  args: { state: 'turniej', accent: 'zielen' },
  argTypes: {
    state: { control: 'inline-radio', options: Object.keys(SYSTEM_STATES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Projekt: Story = {}
