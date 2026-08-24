import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicBracket } from './public-bracket'
import { bracketLarge, bracketLargeWinner } from '@/lib/demo-data'

const meta = {
  title: 'Ekrany/Public · Drabinka',
  component: PublicBracket,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicBracket>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

/** 32 drużyny, 5 rund — drzewo zostaje przy trzech ostatnich, reszta idzie
 *  do selektora. Ta historia pilnuje, żeby układ nie zakładał małej drabinki. */
export const DuzaDrabinka: Story = {
  name: 'Duża drabinka (32 drużyny)',
  args: { rounds: bracketLarge, winner: bracketLargeWinner },
}
