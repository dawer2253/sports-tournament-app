import type { Meta, StoryObj } from '@storybook/react-vite'
import { Heading } from './typography'

const meta = {
  title: 'UI/Heading',
  component: Heading,
  argTypes: {
    level: { control: 'select', options: ['page', 'section', 'card'] },
    as: { control: 'select', options: [undefined, 'h1', 'h2', 'h3'] },
  },
  args: { children: 'Liga Osiedlowa 2026' },
} satisfies Meta<typeof Heading>

export default meta
type Story = StoryObj<typeof meta>

export const TytulStrony: Story = { args: { level: 'page' } }
export const Sekcja: Story = { args: { level: 'section', children: 'Najbliższe mecze' } }
export const TytulKarty: Story = { args: { level: 'card', children: 'Ustawienia ligi' } }

export const Wszystkie: Story = {
  render: () => (
    <div className="space-y-3">
      <Heading level="page">Liga Osiedlowa 2026</Heading>
      <Heading level="section">Najbliższe mecze</Heading>
      <Heading level="card">Ustawienia ligi</Heading>
    </div>
  ),
}
