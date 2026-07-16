import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicStandings } from './public-standings'

const meta = {
  title: 'Ekrany/Public · Tabela',
  component: PublicStandings,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicStandings>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
