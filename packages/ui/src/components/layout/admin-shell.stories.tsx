import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { organizer, tournamentList } from '../../lib/demo-data'
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

/** Turniej demo w kształcie, w jakim shell go przyjmuje. */
const turniej = tournamentList[0]!

const SEKCJE = ['Drużyny', 'Obiekty', 'Ustawienia', 'Terminarz', 'Drabinka', 'Statystyki']

/**
 * Poza turniejem sidebar ma tylko „Turnieje": bez karty turnieju i bez kart
 * sekcji. Bez `navHref` cała nawigacja jest dekoracją — tak wyglądają ekrany
 * w Storybooku.
 */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Klub Sportowy')).toBeInTheDocument()

    const sidebar = within(canvas.getByRole('navigation', { name: 'Panel' }))
    await expect(sidebar.getByText('Turnieje')).toBeInTheDocument()
    await expect(sidebar.queryByText('Turniej')).not.toBeInTheDocument()
    for (const sekcja of SEKCJE) {
      await expect(canvas.queryByText(sekcja)).not.toBeInTheDocument()
    }
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()

    // Dekoracja to nie to samo co pozycja nieczynna: bez `navHref` żadna pozycja
    // nie jest wyłączona, po prostu nikt nie podał adresów.
    await expect(sidebar.getByText('Turnieje')).not.toHaveAttribute('aria-disabled')
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
  },
}

/**
 * W turnieju pod „Turnieje" stoi karta turnieju, a pod tytułem strony karty
 * sekcji. Tytuł i podtytuł podaje ekran; status turnieju shell stawia po prawej.
 */
export const WTurnieju: Story = {
  args: {
    active: 'teams',
    tournament: turniej,
    title: turniej.name,
    subtitle: `${turniej.sport.name} · /t/${turniej.slug}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Karta turnieju: nazwa, status i sport.
    const sidebar = within(canvas.getByRole('navigation', { name: 'Panel' }))
    await expect(sidebar.getByText('Turnieje')).toBeInTheDocument()
    await expect(sidebar.getByText(turniej.name)).toBeInTheDocument()
    await expect(sidebar.getByText('Trwa')).toBeInTheDocument()
    await expect(sidebar.getByText(turniej.sport.name)).toBeInTheDocument()

    // Sidebar nie ma listy sekcji — sekcje są tylko kartami w nagłówku.
    for (const sekcja of SEKCJE) {
      await expect(sidebar.queryByText(sekcja)).not.toBeInTheDocument()
    }

    const karty = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))
    for (const sekcja of SEKCJE) {
      await expect(karty.getByText(sekcja)).toBeInTheDocument()
    }
    // To nawigacja, nie ARIA `tablist`: aktywną kartę oznacza `aria-current`.
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument()
    await expect(karty.getByText('Drużyny').closest('a')).toHaveAttribute('aria-current', 'page')
    await expect(karty.getByText('Obiekty').closest('a')).not.toHaveAttribute('aria-current')

    // Status stoi w nagłówku strony niezależnie od sidebaru, który poniżej `md`
    // znika.
    await expect(canvas.getAllByText('Trwa')).toHaveLength(2)
  },
}

/**
 * Aplikacja podaje adresy tylko dla ekranów, które już istnieją. Karta bez
 * adresu nie udaje odnośnika i nie da się w nią wejść z klawiatury.
 */
export const NawigacjaCzesciowa: Story = {
  args: {
    active: 'venues',
    tournament: turniej,
    title: turniej.name,
    subtitle: `${turniej.sport.name} · /t/${turniej.slug}`,
    navHref: (key: AdminNavKey) =>
      ({ dashboard: '/', tournament: '/tournaments/1', teams: '/tournaments/1/teams', venues: '/tournaments/1/venues', settings: '/tournaments/1/settings' } as Partial<Record<AdminNavKey, string>>)[key],
    onNavigate: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const karty = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))

    // Karty z adresem są odnośnikami — i tylko one.
    await expect(karty.getAllByRole('link').map((link) => link.textContent)).toEqual(['Drużyny', 'Obiekty', 'Ustawienia'])
    await expect(karty.getByRole('link', { name: 'Obiekty' })).toHaveAttribute('aria-current', 'page')

    // Karta bez adresu nie udaje odnośnika: brak `href` odbiera jej rolę
    // `link`, więc czytnik ekranu nie ogłosi jej jako czegoś do kliknięcia.
    const terminarz = karty.getByText('Terminarz').closest('a')!
    await expect(terminarz).toHaveAttribute('aria-disabled', 'true')
    await expect(terminarz).toHaveAttribute('title', 'Wkrótce')

    // Z klawiatury: Tab z ostatniej czynnej karty omija nieczynne.
    karty.getByRole('link', { name: 'Ustawienia' }).focus()
    await userEvent.tab()
    for (const sekcja of ['Terminarz', 'Drabinka', 'Statystyki']) {
      await expect(karty.getByText(sekcja).closest('a')).not.toHaveFocus()
    }

    // Kliknięcie w nieczynną kartę nie prowadzi nigdzie.
    await userEvent.click(terminarz)
    await expect(args.onNavigate).not.toHaveBeenCalled()

    await userEvent.click(karty.getByRole('link', { name: 'Drużyny' }))
    await expect(args.onNavigate).toHaveBeenLastCalledWith('teams')

    // Karta turnieju w sidebarze idzie tą samą drogą co pozycje.
    const kartaTurnieju = within(canvas.getByRole('navigation', { name: 'Panel' })).getByText(turniej.name).closest('a')!
    await expect(kartaTurnieju).toHaveAttribute('href', '/tournaments/1')
    await userEvent.click(kartaTurnieju)
    await expect(args.onNavigate).toHaveBeenLastCalledWith('tournament')

    await userEvent.click(canvas.getByRole('link', { name: 'Turnieje' }))
    await expect(args.onNavigate).toHaveBeenLastCalledWith('dashboard')
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
