// PROTOTYP (#324) — do wyrzucenia, żyje tylko na gałęzi `prototype/grafiki`.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SocialGraphicPrototype } from './stage'

const meta = {
  title: 'Strona publiczna/Prototyp/Grafiki',
  component: SocialGraphicPrototype,
  parameters: { layout: 'fullscreen', a11y: { test: 'off' } },
} satisfies Meta<typeof SocialGraphicPrototype>

export default meta
type Story = StoryObj<typeof meta>

export const Warianty: Story = {}
