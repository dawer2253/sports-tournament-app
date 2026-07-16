import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicResults } from './public-results'

const meta = {
  title: 'Ekrany/Public · Wyniki',
  component: PublicResults,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicResults>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
