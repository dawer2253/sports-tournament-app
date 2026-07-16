import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminMatchResult } from './admin-match-result'

const meta = {
  title: 'Ekrany/Admin · Wynik meczu',
  component: AdminMatchResult,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminMatchResult>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
