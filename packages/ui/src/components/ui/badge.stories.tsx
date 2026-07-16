import type { Meta, StoryObj } from '@storybook/react-vite'
import { Check, AlertTriangle } from 'lucide-react'
import { Badge } from './badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Badge' },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const StatusySpotkania: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge><Check /> Zakończony</Badge>
      <Badge variant="secondary">Zaplanowany</Badge>
      <Badge variant="destructive"><AlertTriangle /> Kolizja boiska</Badge>
      <Badge variant="outline">Trwa</Badge>
      <Badge variant="ghost">Szkic</Badge>
    </div>
  ),
}
