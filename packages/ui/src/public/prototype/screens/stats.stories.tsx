/**
 * PROTOTYP S7 (#288) — Statystyki w języku C. Gałąź `prototype/s7-kierunek`,
 * nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import type { TournamentState } from '../demo'
import { STATES } from '../switcher'
import { ScreenSwitcher } from './kit'
import { season } from './screen-demo'
import { StatsScreen } from './stats'

type Args = { sport: 'liga' | 'kosz'; state: TournamentState; accent: AccentKey }

const SPORTS = { liga: 'Piłka nożna', kosz: 'Koszykówka' }

function Screen(args: Args) {
  // `key`: zmiana sportu zmienia listę statystyk, więc wybór startuje od nowa.
  return <StatsScreen key={args.sport} data={season(args.sport, args.state)} accent={ACCENT_SAMPLES[args.accent].hex} />
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Statystyki',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher args={args} update={update} controls={[{ key: 'sport', options: SPORTS }, { key: 'state', options: STATES }]} />
      </>
    )
  },
  args: { sport: 'liga', state: 'w-trakcie', accent: 'zielen' },
  argTypes: {
    sport: { control: 'inline-radio', options: Object.keys(SPORTS) },
    state: { control: 'inline-radio', options: Object.keys(STATES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Projekt: Story = {}
