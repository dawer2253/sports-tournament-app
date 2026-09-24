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

/**
 * „Wyloguj" jest jedynym wyjściem z sesji, więc musi dać się wybrać bez
 * myszki. Test nie klika triggera — dochodzi do niego tabem.
 */
export const MenuKontaZKlawiatury: Story = {
  args: { onLogout: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Treść menu Radix portaluje do `body`, poza `canvasElement`.
    const page = within(canvasElement.ownerDocument.body)

    // Do triggera prowadzi Tab od sąsiedniego przycisku, nie `focus()` na nim.
    canvas.getByRole('button', { name: 'Powiadomienia' }).focus()
    await userEvent.tab()
    const trigger = canvas.getByRole('button', { name: 'Menu konta' })
    await expect(trigger).toHaveFocus()

    // Awatar zostaje prezentacyjny i nie zmienia rozmiaru: semantykę niesie
    // przycisk wokół niego, a nie ręcznie dopisany `tabindex`.
    const avatar = trigger.querySelector('[data-slot="avatar"]')
    await expect(avatar).not.toHaveAttribute('tabindex')
    await expect(avatar).not.toHaveAttribute('role')
    const { width, height } = avatar!.getBoundingClientRect()
    await expect([width, height]).toEqual([32, 32])
    // Awatar ma się mieścić w obszarze treści przycisku, a nie wystawać na ramkę.
    await expect([trigger.clientWidth, trigger.clientHeight]).toEqual([32, 32])
    // Obwódka awatara ma kształt kafelka i pierścienia fokusu, a nie okręgu (#59).
    const triggerRadius = getComputedStyle(trigger).borderTopLeftRadius
    await expect(getComputedStyle(avatar!, '::after').borderTopLeftRadius).toBe(triggerRadius)

    // Space otwiera, Escape zamyka i oddaje fokus triggerowi.
    await userEvent.keyboard(' ')
    await expect(await page.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(page.queryByRole('menu')).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()

    // Enter otwiera z fokusem na pierwszej pozycji, strzałka przechodzi na
    // „Wyloguj", Enter wybiera.
    await userEvent.keyboard('{Enter}')
    await expect(await page.findByRole('menuitem', { name: 'Ustawienia konta' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    const logoutItem = page.getByRole('menuitem', { name: 'Wyloguj' })
    await expect(logoutItem).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onLogout).toHaveBeenCalledOnce()
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
