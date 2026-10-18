/**
 * PROTOTYP S7 (#288) — Wyniki w trzech wariantach (A Lista, B Tablice,
 * C Szyna). Gałąź `prototype/s7-kierunek`, nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import type { TournamentState } from '../demo'
import { STATES } from '../switcher'
import { ScreenSwitcher } from './kit'
import { ROUND_VARIANTS, RoundsScreen, type RoundVariant } from './rounds'
import { FORMATS, season, type Format } from './screen-demo'

type Args = { variant: RoundVariant; format: Format; state: TournamentState; accent: AccentKey }

function Screen(args: Args) {
  return <RoundsScreen mode="results" variant={args.variant} data={season(args.format, args.state)} accent={ACCENT_SAMPLES[args.accent].hex} />
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Wyniki',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher args={args} update={update} variants={ROUND_VARIANTS} controls={[{ key: 'format', options: FORMATS }, { key: 'state', options: STATES }]} />
      </>
    )
  },
  args: { variant: 'A', format: 'liga', state: 'w-trakcie', accent: 'zielen' },
  argTypes: {
    variant: { control: 'inline-radio', options: Object.keys(ROUND_VARIANTS), labels: ROUND_VARIANTS },
    format: { control: 'inline-radio', options: Object.keys(FORMATS) },
    state: { control: 'inline-radio', options: Object.keys(STATES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Warianty: Story = {}
