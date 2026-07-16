import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminBracket } from './admin-bracket'

const meta = {
  title: 'Ekrany/Admin · Drabinka',
  component: AdminBracket,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminBracket>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
