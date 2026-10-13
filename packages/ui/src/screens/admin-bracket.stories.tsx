import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AdminBracket } from './admin-bracket'

const meta = {
  title: 'Ekrany/Admin · Drabinka',
  component: AdminBracket,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminBracket>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Puchar w trakcie: otwiera się półfinał, pierwsza runda z meczem
 * niezakończonym. W rundzie finału mecz o 3. miejsce stoi przed finałem.
 */
export const Domyslny: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { selected: true })).toHaveTextContent('Półfinał')
    await expect(canvas.getByText(/Wolne losy \(bez meczu w 1\. rundzie\)/)).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('tab', { name: /^Finał/ }))
    const rows = within(canvas.getByRole('list', { name: 'Finał' })).getAllByRole('button')
    await expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Mecz o 3. miejsce: Dragons – Przegrany: Półfinał 2',
      'Finał: FC Górka – Zwycięzca: Półfinał 2',
    ])
    await expect(canvas.queryByText(/Wolne losy/)).not.toBeInTheDocument()

    // W pucharze Terminarz jest nieczynny z innego powodu niż „Wkrótce”.
    const tabs = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))
    await expect(tabs.getByText('Terminarz').closest('a')).toHaveAttribute('title', 'W pucharze terminarzem jest Drabinka')
  },
}

/** Finał ma zwycięzcę: pod listą stoi mistrz. */
export const Rozegrana: Story = {
  args: { state: 'rozegrana' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const champion = within(canvasElement).getByText('Zwycięzca pucharu').closest('[data-slot="bracket-champion"]')
    await expect(champion).toHaveTextContent('FC GórkaZwycięzca pucharu')
  },
}

/** Drabinki jeszcze nie ma: zdanie o rozmiarze i „Rozstaw i wygeneruj”. */
export const Pusta: Story = {
  args: { state: 'pusta' },
}

/** Otwarte okno rozstawienia z dwiema zablokowanymi pozycjami. */
export const Rozstawienie: Story = {
  args: { state: 'rozstawienie' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
}

/** Telefon: karty rund przewijają się w poziomie, wiersz meczu łamie się na trzy linie. */
export const Telefon: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}
