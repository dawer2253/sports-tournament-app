import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { organizer } from '../../lib/demo-data'
import { AdminShell, type AdminNavKey } from './admin-shell'

const meta = {
  title: 'UI/Shell panelu',
  component: AdminShell,
  parameters: { layout: 'fullscreen' },
  args: {
    active: 'dashboard',
    title: 'Twoje turnieje',
    subtitle: 'Zarządzaj ligami i turniejami',
    user: organizer,
    children: <p className="text-sm text-muted-foreground">Miejsce na treść ekranu.</p>,
  },
} satisfies Meta<typeof AdminShell>

export default meta
type Story = StoryObj<typeof meta>

/** Bez `navHref` cała nawigacja jest dekoracją — tak wyglądają ekrany w Storybooku. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Klub Sportowy')).toBeInTheDocument()

    // Dekoracja to nie to samo co pozycja nieczynna: bez `navHref` żadna pozycja
    // nie jest wyłączona, po prostu nikt nie podał adresów.
    await expect(canvas.getByText('Drużyny')).not.toHaveAttribute('aria-disabled')
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
  },
}

/**
 * Aplikacja podaje adresy tylko dla ekranów, które już istnieją. Pozycja bez
 * adresu nie udaje odnośnika i nie da się w nią wejść z klawiatury.
 */
export const NawigacjaCzesciowa: Story = {
  args: {
    navHref: (key: AdminNavKey) => (key === 'dashboard' ? '/' : undefined),
    onNavigate: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    // Pozycja z adresem jest odnośnikiem — i tylko ona.
    const czynna = canvas.getByRole('link', { name: 'Turnieje' })
    await expect(czynna).toHaveAttribute('href', '/')
    await expect(czynna).not.toHaveAttribute('aria-disabled')
    await expect(canvas.queryAllByRole('link')).toHaveLength(1)

    // Pozycja bez adresu nie udaje odnośnika: brak `href` odbiera jej rolę
    // `link`, więc czytnik ekranu nie ogłosi jej jako czegoś do kliknięcia.
    const nieczynna = canvas.getByText('Drużyny')
    await expect(nieczynna).toHaveAttribute('aria-disabled', 'true')

    // Kliknięcie w nieczynną pozycję nie prowadzi nigdzie.
    await userEvent.click(nieczynna)
    await expect(args.onNavigate).not.toHaveBeenCalled()

    await userEvent.click(czynna)
    await expect(args.onNavigate).toHaveBeenCalledWith('dashboard')
  },
}

/** `/me` jest w drodze. Header mówi, że czeka, a nie że konta nie ma. */
export const KontoWczytywane: Story = {
  args: { user: 'pending' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByText('Wczytywanie konta…').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('Konto nieustalone')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Klub Sportowy')).not.toBeInTheDocument()
  },
}

/**
 * `/me` odpowiedziało błędem. Shell nie zgaduje nazwy ani inicjału — pokazuje
 * wprost, że konta nie zna, zamiast wyglądać jak zalogowany ktoś inny.
 */
export const KontoNieustalone: Story = {
  args: { user: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByText('Konto nieustalone').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('Wczytywanie konta…')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Klub Sportowy')).not.toBeInTheDocument()
  },
}
