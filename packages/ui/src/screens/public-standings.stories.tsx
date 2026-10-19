import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PublicStandings } from './public-standings'

const meta = {
  title: 'Strona publiczna/Do przepisania/Ekrany/Tabela',
  component: PublicStandings,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicStandings>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

/** Koszykówka: zdobycze to „Punkty”, a kolumny R nie ma, bo sport nie zna remisów. */
export const Koszykowka: Story = {
  args: { sport: 'basketball' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument()
  },
}
