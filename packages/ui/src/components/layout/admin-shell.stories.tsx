import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { organizer, tournamentList } from '../../lib/demo-data'
import { isCurrentTournament } from '../data/tournament-row'
import { AdminShell, type AdminNavKey, type AdminShellTournament, type AdminShellTournamentList } from './admin-shell'

/** Bieżące turnieje demo, tak jak oddaje je API: bez zakończonych. */
const currentTournaments = tournamentList.filter(isCurrentTournament)

/** Lista w sidebarze, gdy zapytanie się powiodło. */
function listOf(items: AdminShellTournament[], total = items.length): AdminShellTournamentList {
  return { status: 'success', items, total }
}

/** Adresy panelu poza turniejem: lista i kreator. */
const panelHref = (key: AdminNavKey) =>
  ({ dashboard: '/', create: '/tournaments/new' } as Partial<Record<AdminNavKey, string>>)[key]

/** Adres turnieju z listy, czyli jego domyślnej sekcji. */
const tournamentHref = (id: number) => `/tournaments/${id}`

const meta = {
  title: 'UI/Shell panelu',
  component: AdminShell,
  parameters: { layout: 'fullscreen' },
  args: {
    active: 'dashboard',
    title: 'Twoje turnieje',
    subtitle: 'Zarządzaj ligami i turniejami',
    user: organizer,
    tournaments: listOf(currentTournaments),
    children: <p className="text-sm text-muted-foreground">Miejsce na treść ekranu.</p>,
  },
} satisfies Meta<typeof AdminShell>

export default meta
type Story = StoryObj<typeof meta>

/** Turniej demo w kształcie, w jakim shell go przyjmuje. */
const demoTournament = tournamentList[0]!

/** Argumenty shella wewnątrz turnieju, w układzie nagłówka z makiet. */
const inTournament = {
  tournament: demoTournament,
  title: demoTournament.name,
  subtitle: `${demoTournament.sport.name} · /t/${demoTournament.slug}`,
}

/** Sidebar panelu, w którym stoi lista turniejów. */
function sidebarOf(canvasElement: HTMLElement) {
  return within(within(canvasElement).getByRole('navigation', { name: 'Panel' }))
}

const SECTIONS = ['Drużyny', 'Obiekty', 'Ustawienia', 'Terminarz', 'Tabela', 'Drabinka', 'Statystyki']

/**
 * Poza turniejem sidebar ma „Turnieje" i pod nimi bieżące turnieje, bez kart
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
    for (const section of SECTIONS) {
      await expect(canvas.queryByText(section)).not.toBeInTheDocument()
    }
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()

    // Bieżące w kolejności z API, bez zakończonych i bez podświetlenia, bo
    // żaden turniej nie jest otwarty. Podświetlone są tylko „Turnieje".
    const currentList = sidebar.getByRole('list', { name: 'Bieżące turnieje' })
    const items = within(currentList).getAllByRole('listitem')
    await expect(items.map((item) => item.querySelector('[title]')?.textContent)).toEqual(currentTournaments.map(({ name }) => name))
    await expect(sidebar.queryByText('Turniej Zimowy')).not.toBeInTheDocument()
    await expect(currentList.querySelector('[aria-current]')).toBeNull()
    await expect(sidebar.getByText('Turnieje').closest('a')).toHaveAttribute('aria-current', 'page')

    // Dekoracja to nie to samo co pozycja nieczynna: bez `navHref` żadna pozycja
    // nie jest wyłączona, po prostu nikt nie podał adresów.
    await expect(sidebar.getByText('Turnieje')).not.toHaveAttribute('aria-disabled')
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
  },
}

/**
 * W turnieju pod tytułem strony stoją karty sekcji, a otwarty turniej jest
 * podświetloną pozycją listy w sidebarze — bez osobnej karty. Tytuł
 * i podtytuł podaje ekran; status turnieju shell stawia po prawej.
 */
export const WTurnieju: Story = {
  args: {
    ...inTournament,
    active: 'teams',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Otwarty turniej to pozycja listy: nazwa, status i sport, podświetlona.
    const sidebar = within(canvas.getByRole('navigation', { name: 'Panel' }))
    const currentList = within(sidebar.getByRole('list', { name: 'Bieżące turnieje' }))
    const open = currentList.getByText(demoTournament.name).closest('a')!
    await expect(open).toHaveAttribute('aria-current', 'page')
    await expect(within(open).getByText('Trwa')).toBeInTheDocument()
    await expect(within(open).getByText(demoTournament.sport.name)).toBeInTheDocument()
    await expect(currentList.getByText('Puchar Miasta — Kosz').closest('a')).not.toHaveAttribute('aria-current')

    // Bez osobnej karty: nazwa turnieju stoi w sidebarze raz, bez etykiety
    // „Turniej" i bez listy „Otwarty turniej" pod kreską.
    await expect(sidebar.getAllByText(demoTournament.name)).toHaveLength(1)
    await expect(sidebar.queryByText('Turniej')).not.toBeInTheDocument()
    await expect(sidebar.queryByRole('list', { name: 'Otwarty turniej' })).not.toBeInTheDocument()
    await expect(sidebar.getByText('Turnieje').closest('a')).not.toHaveAttribute('aria-current')

    // Sidebar nie ma listy sekcji — sekcje są tylko kartami w nagłówku.
    for (const section of SECTIONS) {
      await expect(sidebar.queryByText(section)).not.toBeInTheDocument()
    }

    const tabs = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))
    for (const section of SECTIONS) {
      await expect(tabs.getByText(section)).toBeInTheDocument()
    }
    // To nawigacja, nie ARIA `tablist`: aktywną kartę oznacza `aria-current`.
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument()
    await expect(tabs.getByText('Drużyny').closest('a')).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByText('Obiekty').closest('a')).not.toHaveAttribute('aria-current')

    // Status stoi w nagłówku strony niezależnie od sidebaru, który poniżej `md`
    // znika.
    await expect(canvas.getAllByText('Trwa')).toHaveLength(2)
  },
}

/**
 * Zakończony turniej nie należy do bieżących, więc otwarty dokleja się pod
 * listą, oddzielony kreską, w tym samym wyglądzie pozycji i podświetlony.
 */
export const WTurniejuZakonczonym: Story = {
  args: {
    ...inTournament,
    tournament: tournamentList[2]!,
    title: tournamentList[2]!.name,
    active: 'standings',
  },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    const currentListElement = sidebar.getByRole('list', { name: 'Bieżące turnieje' })
    const currentList = within(currentListElement)
    await expect(currentList.queryByText('Turniej Zimowy')).not.toBeInTheDocument()
    await expect(currentList.getAllByRole('listitem')).toHaveLength(currentTournaments.length)

    const openList = sidebar.getByRole('list', { name: 'Otwarty turniej' })
    const open = within(openList).getByText('Turniej Zimowy').closest('a')!
    await expect(open).toHaveAttribute('aria-current', 'page')
    await expect(within(open).getByText('Zakończony')).toBeInTheDocument()

    // Pod listą bieżących, za kreską — nie przed nią.
    const separator = openList.previousElementSibling
    await expect(separator?.tagName).toBe('HR')
    await expect(currentListElement.compareDocumentPosition(openList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Na liście bieżących nic nie jest podświetlone.
    await expect(currentListElement.querySelector('[aria-current]')).toBeNull()
  },
}

/**
 * Turniej zakończony przed chwilą: lista jeszcze się nie odświeżyła i niesie
 * go jako trwający. Shell wierzy świeższemu stanowi otwartego turnieju, a stare
 * `total` nie daje fałszywego „+1 więcej".
 */
export const ListaNieaktualnaPoZakonczeniu: Story = {
  args: {
    ...inTournament,
    tournament: { ...demoTournament, status: 'finished' },
    active: 'settings',
    tournaments: listOf(currentTournaments),
  },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    const currentList = within(sidebar.getByRole('list', { name: 'Bieżące turnieje' }))
    await expect(currentList.queryByText(demoTournament.name)).not.toBeInTheDocument()
    await expect(within(sidebar.getByRole('list', { name: 'Otwarty turniej' })).getByText('Zakończony')).toBeInTheDocument()
    await expect(sidebar.queryByText(/więcej/)).not.toBeInTheDocument()
  },
}

/** Dwanaście bieżących: sidebar mieści osiem, resztę zlicza z `meta.total`. */
const twelve: AdminShellTournament[] = Array.from({ length: 12 }, (_, index) => ({
  id: 100 + index,
  name: `Liga Firmowa ${index + 1}`,
  status: index % 2 === 0 ? 'active' : 'draft',
  sport: { name: 'Piłka nożna' },
}))

/**
 * Ponad osiem bieżących: pod listą wyszarzone „+N więcej" prowadzi na listę
 * wszystkich turniejów. API oddaje jedną stronę (osiem), a N liczy się
 * z `total`.
 */
export const PonadOsiemBiezacych: Story = {
  args: {
    tournaments: listOf(twelve.slice(0, 8), twelve.length),
    navHref: panelHref,
    tournamentHref: tournamentHref,
    onNavigate: fn(),
    onOpenTournament: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    await expect(within(sidebar.getByRole('list', { name: 'Bieżące turnieje' })).getAllByRole('listitem')).toHaveLength(8)
    const more = sidebar.getByRole('link', { name: '+4 więcej' })
    await expect(more).toHaveAttribute('href', '/')
    // „Turnieje" są bieżącą stroną; odnośnik poboczny na ten sam adres nią nie jest.
    await expect(more).not.toHaveAttribute('aria-current')

    await userEvent.click(more)
    await expect(args.onNavigate).toHaveBeenLastCalledWith('dashboard')

    // Pozycja prowadzi do turnieju, czyli jego domyślnej sekcji.
    const item = sidebar.getByText('Liga Firmowa 3').closest('a')!
    await expect(item).toHaveAttribute('href', '/tournaments/102')
    await userEvent.click(item)
    await expect(args.onOpenTournament).toHaveBeenLastCalledWith(102)
  },
}

/**
 * Otwarty turniej bieżący, który nie zmieścił się w ośmiu, też stoi pod
 * kreską: organizer ma widzieć, w którym turnieju jest. W „+N więcej" już się
 * nie liczy, bo widać go pod kreską.
 */
export const OtwartyPozaLimitem: Story = {
  args: {
    ...inTournament,
    tournament: twelve[10]!,
    title: twelve[10]!.name,
    active: 'teams',
    tournaments: listOf(twelve.slice(0, 8), twelve.length),
  },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    const open = within(sidebar.getByRole('list', { name: 'Otwarty turniej' })).getByText('Liga Firmowa 11').closest('a')!
    await expect(open).toHaveAttribute('aria-current', 'page')
    await expect(sidebar.getByText('+3 więcej')).toBeInTheDocument()
  },
}

/** Bez bieżących turniejów sidebar mówi to wprost i prowadzi do kreatora. */
export const BezBiezacych: Story = {
  args: {
    tournaments: listOf([]),
    navHref: panelHref,
    onNavigate: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    await expect(sidebar.getByText(/Brak bieżących turniejów/)).toBeInTheDocument()
    await expect(sidebar.queryByRole('list', { name: 'Bieżące turnieje' })).not.toBeInTheDocument()
    const createLink = sidebar.getByRole('link', { name: 'Nowy turniej' })
    await expect(createLink).toHaveAttribute('href', '/tournaments/new')
    await userEvent.click(createLink)
    await expect(args.onNavigate).toHaveBeenLastCalledWith('create')
  },
}

/**
 * Lista przyszła, zanim otwarty turniej powstał (np. w innej karcie), więc go
 * nie niesie. Stoi pod kreską, a sidebar nie twierdzi, że bieżących brak.
 */
export const ListaNieaktualnaBezOtwartego: Story = {
  args: { ...inTournament, active: 'teams', tournaments: listOf([]) },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    const open = within(sidebar.getByRole('list', { name: 'Otwarty turniej' })).getByText(demoTournament.name).closest('a')!
    await expect(open).toHaveAttribute('aria-current', 'page')
    await expect(sidebar.queryByText(/Brak bieżących turniejów/)).not.toBeInTheDocument()
  },
}

/** Lista w drodze: trzy szkieletowe pozycje zamiast pustego sidebaru. */
export const ListaWczytywana: Story = {
  args: { tournaments: { status: 'pending' } },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    const skeleton = sidebar.getByLabelText('Wczytywanie turniejów')
    await expect(skeleton).toHaveAttribute('aria-busy', 'true')
    await expect(skeleton.children).toHaveLength(3)
    await expect(sidebar.queryByText(/Brak bieżących turniejów/)).not.toBeInTheDocument()
  },
}

/**
 * Lista nie przyszła, gdy organizer stoi w turnieju. Otwarty turniej zostaje
 * pod kreską, żeby sidebar dalej mówił, gdzie organizer jest.
 */
export const ListaZBledemWTurnieju: Story = {
  args: { ...inTournament, active: 'teams', tournaments: { status: 'error', onRetry: fn() } },
  play: async ({ canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    await expect(sidebar.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument()
    const open = within(sidebar.getByRole('list', { name: 'Otwarty turniej' })).getByText(demoTournament.name).closest('a')!
    await expect(open).toHaveAttribute('aria-current', 'page')
  },
}

/**
 * Lista nie przyszła. Pusty sidebar wyglądałby jak „nie masz turniejów",
 * więc shell mówi o błędzie i daje ponowienie.
 */
export const ListaZBledem: Story = {
  args: { tournaments: { status: 'error', onRetry: fn() } },
  play: async ({ args, canvasElement }) => {
    const sidebar = sidebarOf(canvasElement)

    await expect(sidebar.getByText(/Nie udało się wczytać turniejów/)).toBeInTheDocument()
    await expect(sidebar.queryByText(/Brak bieżących turniejów/)).not.toBeInTheDocument()
    await userEvent.click(sidebar.getByRole('button', { name: 'Spróbuj ponownie' }))
    if (args.tournaments.status !== 'error') throw new Error('Story bez stanu błędu.')
    await expect(args.tournaments.onRetry).toHaveBeenCalledOnce()
  },
}

/**
 * Aplikacja podaje adresy tylko dla ekranów, które już istnieją. Karta bez
 * adresu nie udaje odnośnika i nie da się w nią wejść z klawiatury.
 */
export const NawigacjaCzesciowa: Story = {
  args: {
    ...inTournament,
    active: 'venues',
    navHref: (key: AdminNavKey) =>
      ({ dashboard: '/', teams: '/tournaments/1/teams', venues: '/tournaments/1/venues', settings: '/tournaments/1/settings' } as Partial<Record<AdminNavKey, string>>)[key],
    onNavigate: fn(),
    tournamentHref: tournamentHref,
    onOpenTournament: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))

    // Karty z adresem są odnośnikami — i tylko one.
    await expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual(['Drużyny', 'Obiekty', 'Ustawienia'])
    await expect(tabs.getByRole('link', { name: 'Obiekty' })).toHaveAttribute('aria-current', 'page')

    // Karta bez adresu nie udaje odnośnika: brak `href` odbiera jej rolę
    // `link`, więc czytnik ekranu nie ogłosi jej jako czegoś do kliknięcia.
    const schedule = tabs.getByText('Terminarz').closest('a')!
    await expect(schedule).toHaveAttribute('aria-disabled', 'true')
    await expect(schedule).toHaveAttribute('title', 'Wkrótce')

    // Z klawiatury: Tab z ostatniej czynnej karty omija nieczynne.
    tabs.getByRole('link', { name: 'Ustawienia' }).focus()
    await userEvent.tab()
    for (const section of ['Terminarz', 'Tabela', 'Drabinka', 'Statystyki']) {
      await expect(tabs.getByText(section).closest('a')).not.toHaveFocus()
    }

    // Kliknięcie w nieczynną kartę nie prowadzi nigdzie.
    await userEvent.click(schedule)
    await expect(args.onNavigate).not.toHaveBeenCalled()

    await userEvent.click(tabs.getByRole('link', { name: 'Drużyny' }))
    await expect(args.onNavigate).toHaveBeenLastCalledWith('teams')

    // Otwarty turniej w sidebarze prowadzi do domyślnej sekcji, nie do
    // tej, na której organizer stoi.
    const open = within(canvas.getByRole('navigation', { name: 'Panel' })).getByText(demoTournament.name).closest('a')!
    await expect(open).toHaveAttribute('href', '/tournaments/1')
    await userEvent.click(open)
    await expect(args.onOpenTournament).toHaveBeenLastCalledWith(1)

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
    // Menu znika dopiero po animacji wyjścia (`data-closed:animate-out`, #172).
    await waitFor(() => expect(page.queryByRole('menu')).not.toBeInTheDocument())
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
