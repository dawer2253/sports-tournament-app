/**
 * PROTOTYP S7 (#288) — Drabinka w trzech wariantach (A Drzewo, B Rundy,
 * C Plakat). Gałąź `prototype/s7-kierunek`, nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import type { TournamentState } from '../demo'
import { STATES } from '../switcher'
import { BRACKET_VARIANTS, BracketScreen, type BracketVariant } from './bracket'
import { ScreenSwitcher } from './kit'
import { CUP_SIZES, season, type CupSize } from './screen-demo'

type Args = { variant: BracketVariant; format: 'puchar' | 'grupy'; teams: `${CupSize}`; state: TournamentState; accent: AccentKey }

const BRACKET_FORMATS = { puchar: 'Puchar', grupy: 'Playoff po grupach' }

function Screen(args: Args) {
  return (
    <BracketScreen
      variant={args.variant}
      data={season(args.format, args.state, Number(args.teams) as CupSize)}
      accent={ACCENT_SAMPLES[args.accent].hex}
    />
  )
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Drabinka',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher
          args={args}
          update={update}
          variants={BRACKET_VARIANTS}
          controls={[
            { key: 'format', options: BRACKET_FORMATS },
            ...(args.format === 'puchar' ? [{ key: 'teams', options: CUP_SIZES }] : []),
            { key: 'state', options: STATES },
          ]}
        />
      </>
    )
  },
  args: { variant: 'A', format: 'puchar', teams: '8', state: 'w-trakcie', accent: 'zielen' },
  argTypes: {
    variant: { control: 'inline-radio', options: Object.keys(BRACKET_VARIANTS), labels: BRACKET_VARIANTS },
    format: { control: 'inline-radio', options: Object.keys(BRACKET_FORMATS) },
    teams: { control: 'inline-radio', options: Object.keys(CUP_SIZES) },
    state: { control: 'inline-radio', options: Object.keys(STATES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Warianty: Story = {}
