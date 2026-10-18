/**
 * PROTOTYP S7 (#288) — strona meczu w trzech wariantach (A Tablica, B Oś,
 * C Relacja z panelem). Gałąź `prototype/s7-kierunek`, nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import type { MatchPageData } from '../../../components/data/match-page-data'
import { matchPageBasketball, matchPageFinished, matchPageLive, matchPageScheduled } from '../../../lib/demo-data'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import { ScreenSwitcher } from './kit'
import { MATCH_VARIANTS, MatchScreen, type MatchVariant } from './match'
import { season } from './screen-demo'

const MATCHES = { 'po-meczu': 'Po meczu', 'na-zywo': 'Na żywo', zaplanowany: 'Zaplanowany', kosz: 'Kosz po meczu' } as const
type MatchKey = keyof typeof MATCHES

const PAGES: Record<MatchKey, MatchPageData> = {
  'po-meczu': matchPageFinished,
  'na-zywo': matchPageLive,
  zaplanowany: matchPageScheduled,
  kosz: matchPageBasketball,
}

type Args = { variant: MatchVariant; match: MatchKey; accent: AccentKey }

function Screen(args: Args) {
  const data = season(args.match === 'kosz' ? 'kosz' : 'liga', 'w-trakcie')
  return <MatchScreen variant={args.variant} match={PAGES[args.match]} data={data} accent={ACCENT_SAMPLES[args.accent].hex} />
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Strona meczu',
  component: Screen,
  parameters: { layout: 'fullscreen' },
  render: function Render(args) {
    const [, update] = useArgs<Args>()
    return (
      <>
        <Screen {...args} />
        <ScreenSwitcher args={args} update={update} variants={MATCH_VARIANTS} controls={[{ key: 'match', options: MATCHES }]} />
      </>
    )
  },
  args: { variant: 'A', match: 'po-meczu', accent: 'zielen' },
  argTypes: {
    variant: { control: 'inline-radio', options: Object.keys(MATCH_VARIANTS), labels: MATCH_VARIANTS },
    match: { control: 'inline-radio', options: Object.keys(MATCHES) },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Warianty: Story = {}
