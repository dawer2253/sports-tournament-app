import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AdminSchedule } from './admin-schedule'

const meta = {
  title: 'Ekrany/Admin/Terminarz',
  component: AdminSchedule,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminSchedule>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Sezon w trakcie: otwiera się pierwsza kolejka z meczem niezakończonym,
 * czyli piąta, a „Wygeneruj ponownie” w menu jest wyłączone.
 */
export const Domyslny: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Terminarz').closest('a')).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('heading', { name: 'Kolejka 5' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('group')).toHaveLength(4)
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
    // Kolizja boiska w kolejce 5: plakietka po obu stronach pary (#175).
    await expect(canvas.getAllByTitle(/^Kolizja boiska:/)).toHaveLength(2)
  },
}

/** Zaraz po wygenerowaniu: mecze bez terminu i obiektu. */
export const BezDat: Story = {
  args: { state: 'bez-dat' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Kolejka 1' })).toBeInTheDocument()
    await expect(canvas.getAllByText('Termin do ustalenia')).toHaveLength(4)
  },
}

/** Terminarza jeszcze nie ma: pusty stan z „Wygeneruj terminarz”. */
export const Pusty: Story = {
  args: { state: 'pusty' },
}

/** Telefon: lista kolejek zwinięta do przycisku z bieżącą kolejką. */
export const Telefon: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}
