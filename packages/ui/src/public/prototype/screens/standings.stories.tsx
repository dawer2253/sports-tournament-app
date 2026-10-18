/**
 * PROTOTYP S7 (#288) — Tabela w języku C. Gałąź `prototype/s7-kierunek`,
 * nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import type { TournamentState } from '../demo'
import { STATES } from '../switcher'
import { ScreenSwitcher } from './kit'
import { FORMATS, season, type Format } from './screen-demo'
import { StandingsScreen } from './standings'

type Args = { format: Exclude<Format, 'puchar'>; state: TournamentState; accent: AccentKey }

const { puchar: _cup, ...TABLE_FORMATS } = FORMATS

function Screen(args: Args) {
  return <StandingsScreen data={season(args.format, args.state)} accent={ACCENT_SAMPLES[args.accent].hex} />
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Tabela',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher args={args} update={update} controls={[{ key: 'format', options: TABLE_FORMATS }, { key: 'state', options: STATES }]} />
      </>
    )
  },
  args: { format: 'liga', state: 'w-trakcie', accent: 'zielen' },
  argTypes: {
    format: { control: 'inline-radio', options: Object.keys(TABLE_FORMATS) },
    state: { control: 'inline-radio', options: Object.keys(STATES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Projekt: Story = {}
