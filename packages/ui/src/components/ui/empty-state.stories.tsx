import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangle, Trophy } from 'lucide-react'
import { Button } from './button'
import { EmptyState } from './empty-state'

const meta = {
  title: 'UI/Stan pusty',
  component: EmptyState,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Pusty: Story = {
  args: {
    icon: <Trophy />,
    title: 'Nie masz jeszcze turniejów',
    description: 'Załóż pierwszy turniej, żeby wygenerować terminarz.',
    action: <Button>Nowy turniej</Button>,
  },
}

export const Blad: Story = {
  args: {
    variant: 'error',
    icon: <AlertTriangle />,
    title: 'Nie udało się wczytać turniejów',
    description: 'Sprawdź połączenie i spróbuj ponownie.',
    action: <Button variant="outline">Spróbuj ponownie</Button>,
  },
}
