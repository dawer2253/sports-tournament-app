import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AdminGroups } from './admin-groups'

const meta = {
  title: 'Ekrany/Admin/Grupy',
  component: AdminGroups,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminGroups>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ten sam ekran co pod `/tournaments/{id}/groups` w panelu: nagłówek sekcji
 * i wspólny edytor składu grup. Asercje idą po kafelkach grup, nie po układzie.
 */
export const Zapisany: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Grupy').closest('a')).toHaveAttribute('aria-current', 'page')

    await expect(canvas.getByRole('heading', { name: 'Skład grup' })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Nazwa grupy 1')).toHaveValue('Grupa A')
    await expect(canvas.getByLabelText('Nazwa grupy 2')).toHaveValue('Grupa B')
    await expect(canvas.getAllByText('3 drużyny')).toHaveLength(2)
    await expect(canvas.getByText('Każda drużyna ma grupę.')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Zapisz skład grup' })).toBeEnabled()
  },
}

/** Terminarz grup już stoi: zapis składu by go skasował, więc edytor ostrzega. */
export const ZTerminarzem: Story = {
  args: { state: 'z-terminarzem' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByText(/Zapis składu skasuje terminarz grup \(6 meczów\)/),
    ).toBeInTheDocument()
  },
}

/** Faza ma mecz rozpoczęty: skład zamrożony, zapisu nie ma. */
export const Zamrozony: Story = {
  args: { state: 'zamrozony' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Faza ma mecz rozpoczęty, więc skład grup jest zamrożony.')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Zapisz skład grup' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Losuj' })).toBeDisabled()
  },
}
