import * as React from 'react'
import {
  LayoutGrid, Users, CalendarDays, MapPin, BarChart3, Settings,
  Trophy, Search, Bell, LogOut, GitFork, ListOrdered, Layers, Menu, Inbox,
} from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { isCurrentTournament, type TournamentRow } from '../data/tournament-row'
import { TournamentStatusBadge } from '../data/tournament-status-badge'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Skeleton } from '../ui/skeleton'
import { Heading } from '../ui/typography'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu'

/** Sekcja turnieju, czyli jedna z kart pod tytułem strony. */
export type AdminSectionKey = 'teams' | 'registrations' | 'groups' | 'venues' | 'settings' | 'schedule' | 'standings' | 'bracket' | 'stats'

/**
 * Cel nawigacji panelu: lista turniejów (`dashboard`, pozycja „Turnieje"),
 * kreator turnieju (`create`) albo sekcja turnieju. Konkretny turniej z listy
 * w sidebarze ma osobny adres, `tournamentHref`, bo niesie id.
 */
export type AdminNavKey = 'dashboard' | 'create' | AdminSectionKey

/** Kolejność kart jest stała: pojawienie się treści nie przesuwa znanych kart. */
const SECTIONS: { key: AdminSectionKey; label: string; icon: React.ElementType }[] = [
  { key: 'teams', label: 'Drużyny', icon: Users },
  { key: 'registrations', label: 'Zgłoszenia', icon: Inbox },
  { key: 'groups', label: 'Grupy', icon: Layers },
  { key: 'venues', label: 'Obiekty', icon: MapPin },
  { key: 'settings', label: 'Ustawienia', icon: Settings },
  { key: 'schedule', label: 'Terminarz', icon: CalendarDays },
  { key: 'standings', label: 'Tabela', icon: ListOrdered },
  { key: 'bracket', label: 'Drabinka', icon: GitFork },
  { key: 'stats', label: 'Statystyki', icon: BarChart3 },
]

/**
 * Turniej w sidebarze: pozycja listy bieżących. Po `id` shell rozpoznaje
 * otwarty turniej na liście.
 */
export type AdminShellTournament = Pick<TournamentRow, 'id' | 'name' | 'status' | 'sport'>

/**
 * Turniej, w którym stoi ekran (nagłówek i podświetlenie w sidebarze). `id`
 * jest znane od razu — z adresu — a nazwa, status i sport dochodzą z API.
 * Dopóki ich nie ma, shell wie już, że stoi w turnieju, i nie udaje ekranu
 * poza nim; brakujące pola zostają puste zamiast zgadywane (#262).
 */
export type AdminShellOpenTournament = Pick<TournamentRow, 'id'> &
  Partial<Pick<TournamentRow, 'name' | 'status' | 'sport'>>

/** Czy znamy nazwę, status i sport otwartego turnieju, czy dopiero po nie idziemy. */
function hasDetails(tournament: AdminShellOpenTournament): tournament is AdminShellTournament {
  return tournament.name !== undefined && tournament.status !== undefined && tournament.sport !== undefined
}

/**
 * Ile bieżących turniejów mieści sidebar. Aplikacja prosi API o tyle samo
 * (`perPage`), a resztę shell zlicza w „+N więcej" z `total`.
 */
export const SIDEBAR_TOURNAMENTS_LIMIT = 8

/**
 * Lista bieżących turniejów (szkice i trwające, od najnowszego) w stanie,
 * w jakim jest jej zapytanie. Trzy jawne stany, bo pusty sidebar przy błędzie
 * wyglądałby jak „nie masz turniejów". `total` to `meta.total` z API, czyli
 * wszystkie bieżące, także te, które się nie zmieściły.
 */
export type AdminShellTournamentList =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; items: AdminShellTournament[]; total: number }

/** Zalogowany organizer pokazywany w sidebarze i w headerze. */
export interface AdminShellUser {
  name: string
  email: string
}

/**
 * Stan konta w headerze. Trzy jawne wartości zamiast pustego stringa jako
 * sygnału: `'pending'` to „jeszcze nie wiem" (`/me` w drodze), `null` to
 * „nie udało się ustalić". Zlanie ich w jedno gubi informację, że coś się
 * jeszcze dzieje, a zgadnięta nazwa wygląda jak cudze konto.
 */
export type AdminShellAccount = AdminShellUser | 'pending' | null

export interface AdminShellProps {
  active: AdminNavKey
  /**
   * Turniej, w którym stoi ekran. Z nim sidebar podświetla go na liście
   * bieżących (albo dokleja pod nią, gdy na liście go nie ma), nagłówek
   * dostaje karty sekcji, a prawa strona nagłówka status. Tytuł nadal podaje
   * ekran — w turnieju to nazwa turnieju, a podtytuł to sport i `/t/slug`.
   *
   * Wystarczy samo `id`, gdy dane są jeszcze w drodze: shell wie wtedy, że
   * ekran stoi w turnieju, ale nagłówek zostaje bez nazwy, statusu i kart
   * sekcji — do czasu, aż ekran poda turniej w całości.
   */
  tournament?: AdminShellOpenTournament
  /**
   * Bieżące turnieje organizera do sidebaru. Wymagane, jak `user`: shell nie
   * zna API, a pominięta lista wyglądałaby jak brak turniejów.
   */
  tournaments: AdminShellTournamentList
  /**
   * Tytuł strony. Węzeł, a nie string, bo gdy turniej jest jeszcze w drodze,
   * ekran podaje szkielet zamiast nazwy, której nie zna (#262).
   */
  title: React.ReactNode
  /** Podtytuł; węzeł, bo fakty obok siebie idą przez `MetaList`, a nie „·” (#306). */
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /**
   * Wymagany: shell nie ma własnego konta zastępczego, bo fikcyjny organizer
   * w headerze jest gorszy niż widoczny brak danych. Ekrany Storybooka podają
   * je przez `ShellDemo` z `screens/`.
   */
  user: AdminShellAccount
  /**
   * Adres pozycji „Turnieje", kreatora i kart sekcji. Domyślnie cała
   * nawigacja jest martwa (Storybook).
   */
  navHref?: (key: AdminNavKey) => string | undefined
  /**
   * Dlaczego karta sekcji bez adresu jest nieczynna, do podpowiedzi
   * (`title`). Bez powodu karta mówi „Wkrótce”, bo zwykle czeka na ekran;
   * w pucharze Terminarz jest nieczynny z innego powodu (#227).
   */
  navDisabledReason?: (key: AdminSectionKey) => string | undefined
  /**
   * Plakietka przy karcie sekcji: liczba i jej opis dla czytnika ekranu
   * (np. `{ count: 2, label: '2 oczekujące' }` przy „Zgłoszeniach”, #300).
   * Bez plakietki przy zerze — liczy się to, co czeka na organizera.
   */
  sectionBadge?: (key: AdminSectionKey) => { count: number; label: string } | undefined
  /** Przejęcie kliknięcia w nawigację, np. przez router. */
  onNavigate?: (key: AdminNavKey) => void
  /** Adres turnieju z listy w sidebarze, czyli jego domyślnej sekcji. */
  tournamentHref?: (id: number) => string
  /** Przejęcie kliknięcia w turniej z listy, np. przez router. */
  onOpenTournament?: (id: number) => void
  onLogout?: () => void
}

type NavProps = Pick<AdminShellProps, 'active' | 'navHref' | 'navDisabledReason' | 'sectionBadge' | 'onNavigate'>

/**
 * Wspólna mechanika odnośników nawigacji: pozycji „Turnieje", turniejów
 * z listy, odnośników w notkach listy i kart sekcji. Przejęte kliknięcie
 * (`onActivate`, np. router) zastępuje domyślne przejście pod `href`.
 */
function anchorProps({ href, isActive, isDisabled, onActivate }: {
  href: string | undefined
  isActive: boolean
  isDisabled: boolean
  onActivate: (() => void) | undefined
}) {
  return {
    href,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!onActivate) return
      event.preventDefault()
      if (!isDisabled) onActivate()
    },
    'aria-current': isActive ? ('page' as const) : undefined,
    'aria-disabled': isDisabled || undefined,
    tabIndex: isDisabled ? -1 : undefined,
  }
}

/**
 * Odnośnik do celu nawigacji panelu.
 *
 * Aplikacja podaje adresy tylko dla ekranów, które już istnieją. Cel bez
 * adresu nie udaje odnośnika: nie da się w niego wejść z klawiatury i widać po
 * nim, że jest nieczynny. W Storybooku (bez `navHref`) cała nawigacja zostaje
 * dekoracją, a nie nieczynnością.
 */
function navLink(key: AdminNavKey, { active, navHref, onNavigate }: NavProps, { marksActive = true } = {}) {
  const href = navHref?.(key)
  // `marksActive: false` dla odnośników pobocznych, np. „+N więcej" prowadzi na
  // listę, ale aktywną pozycją jest „Turnieje", a nie on.
  const isActive = marksActive && key === active
  const isDisabled = navHref !== undefined && href === undefined
  return {
    isActive,
    isDisabled,
    linkProps: anchorProps({ href, isActive, isDisabled, onActivate: onNavigate && (() => onNavigate(key)) }),
  }
}

const sidebarLinkVariants = cva(
  [
    'relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity',
  ],
  {
    variants: {
      // Ikonę stylujemy z rodzica, żeby stan aktywny żył w jednym wariancie.
      active: {
        true: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:opacity-100 [&_svg]:text-primary',
        false: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground [&_svg]:text-muted-foreground',
      },
      disabled: { true: 'cursor-default opacity-50 hover:bg-transparent', false: '' },
    },
  },
)

const sectionTabVariants = cva(
  'flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2 text-sm transition-colors',
  {
    variants: {
      active: {
        true: 'border-primary font-medium text-foreground [&_svg]:text-primary',
        false: 'border-transparent text-muted-foreground hover:text-foreground',
      },
      disabled: { true: 'cursor-default opacity-50 hover:text-muted-foreground', false: '' },
    },
  },
)

function TournamentsLink(nav: NavProps) {
  const { isActive, isDisabled, linkProps } = navLink('dashboard', nav)
  return (
    <a {...linkProps} className={sidebarLinkVariants({ active: isActive, disabled: isDisabled })}>
      <LayoutGrid className="size-4 shrink-0" />
      Turnieje
    </a>
  )
}

type TournamentNavProps = NavProps & Pick<AdminShellProps, 'tournamentHref' | 'onOpenTournament'>

/**
 * Pozycja listy turniejów: nazwa w pierwszej linii, status i sport w drugiej.
 * Otwarty turniej wyróżnia się tak samo jak aktywne „Turnieje", tłem i belką.
 * Kliknięcie prowadzi do domyślnej sekcji, niezależnie od tej, w której
 * organizer stoi.
 *
 * Adres niesie id, więc idzie przez `tournamentHref`/`onOpenTournament`,
 * a nie przez klucz nawigacji. Turniej z listy zawsze istnieje, więc nigdy nie
 * jest nieczynny; bez adresów (Storybook) jest dekoracją.
 */
function TournamentItem({
  tournament,
  isOpen,
  tournamentHref,
  onOpenTournament,
}: TournamentNavProps & { tournament: AdminShellTournament; isOpen: boolean }) {
  const linkProps = anchorProps({
    href: tournamentHref?.(tournament.id),
    isActive: isOpen,
    isDisabled: false,
    onActivate: onOpenTournament && (() => onOpenTournament(tournament.id)),
  })
  return (
    <li className="py-1">
      <a
        {...linkProps}
        className={cn(sidebarLinkVariants({ active: isOpen, disabled: false }), 'flex-col items-stretch gap-1.5')}
      >
        <span className="truncate font-medium text-sidebar-foreground" title={tournament.name}>{tournament.name}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          <TournamentStatusBadge status={tournament.status} />
          <span className="truncate">{tournament.sport.name}</span>
        </span>
      </a>
    </li>
  )
}

/** Wyszarzony tekst w liście turniejów: stan pusty, błąd, „+N więcej". */
const sidebarNoteClass = 'px-3 py-1.5 text-xs text-muted-foreground'

/** Odnośnik w wyszarzonej notce: „Nowy turniej", „Spróbuj ponownie". */
const sidebarNoteLinkClass = 'cursor-pointer font-medium text-sidebar-foreground underline-offset-2 hover:underline'

/**
 * Co pokazuje lista turniejów w sidebarze: pozycje listy, turniej pod kreską,
 * liczba w „+N więcej" i czy mówić o braku bieżących. Osobno od rysowania, bo
 * stan listy i stan otwartego turnieju przychodzą z dwóch zapytań, które
 * odświeżają się niezależnie, a tu się je godzi.
 */
function tournamentListView(
  tournaments: AdminShellTournamentList,
  tournament: AdminShellOpenTournament | undefined,
) {
  const items = tournaments.status === 'success' ? tournaments.items.slice(0, SIDEBAR_TOURNAMENTS_LIMIT) : []
  // Nazwa, status i sport otwartego turnieju; bez nich nie ma czym zastąpić wiersza listy.
  const detailed = tournament !== undefined && hasDetails(tournament) ? tournament : undefined
  // Zakończony nie jest bieżący, nawet jeśli lista jeszcze o tym nie wie:
  // stan otwartego turnieju jest świeższy niż lista, która odświeża się osobno.
  const openIsCurrent = detailed !== undefined && isCurrentTournament(detailed)
  const onList = tournament !== undefined && items.some(({ id }) => id === tournament.id)
  const listed = openIsCurrent && onList
  const visible = items
    // Otwarty turniej bez własnych danych zostaje wierszem listy: jest tam, więc
    // nie ma czym go zastąpić ani czego dorysowywać pod kreską.
    .filter(({ id }) => id !== tournament?.id || listed || (onList && detailed === undefined))
    // Otwarty turniej rysujemy z jego własnych, świeższych danych.
    .map((item) => (item.id === tournament?.id && detailed ? detailed : item))
  // Dopóki lista jest w drodze, nie wiadomo, czy bieżący turniej na niej
  // będzie; zakończony nie będzie na pewno. Przy błędzie listy otwarty turniej
  // zostaje pod kreską, bo inaczej sidebar nie mówiłby, gdzie organizer stoi.
  const pinned = detailed && !listed && (tournaments.status !== 'pending' || !openIsCurrent) ? detailed : undefined
  // Z `items`, nie z `visible`: turniej właśnie zakończony, który nieaktualna
  // lista jeszcze niesie, siedzi też w nieaktualnym `total`. Bieżący spoza
  // limitu stoi pod kreską, więc nie liczy się drugi raz w „więcej".
  const more = tournaments.status === 'success'
    ? tournaments.total - items.length - (pinned && openIsCurrent ? 1 : 0)
    : 0
  // Bieżący turniej pod kreską (nieaktualna lista go nie niesie) przeczyłby „brakowi".
  const isEmpty = tournaments.status === 'success' && visible.length === 0 && !(pinned && openIsCurrent)
  return { visible, pinned, more, isEmpty }
}

/**
 * Bieżące turnieje pod „Turnieje" (#195). Otwarty turniej jest podświetloną
 * pozycją listy. Gdy na liście go nie ma — bo jest zakończony albo nie
 * zmieścił się w limicie — dokleja się pod nią, oddzielony kreską, żeby
 * organizer zawsze widział, w którym turnieju stoi.
 */
function TournamentList({
  tournaments,
  tournament,
  ...nav
}: TournamentNavProps & Pick<AdminShellProps, 'tournaments' | 'tournament'>) {
  const { visible, pinned, more, isEmpty } = tournamentListView(tournaments, tournament)

  return (
    <div className="mt-1 space-y-0.5">
      {tournaments.status === 'pending' && (
        <div aria-busy="true" aria-label="Wczytywanie turniejów" className="space-y-0.5">
          {Array.from({ length: 3 }, (_, index) => (
            // `bg-muted` zlewa się z tłem sidebaru, więc szkielet bierze jego pierwszy plan.
            <div key={index} className="space-y-1.5 px-3 py-2">
              <Skeleton className="h-4 w-36 bg-sidebar-foreground/10" />
              <Skeleton className="h-4 w-24 bg-sidebar-foreground/10" />
            </div>
          ))}
        </div>
      )}

      {tournaments.status === 'error' && (
        <p className={sidebarNoteClass}>
          Nie udało się wczytać turniejów.{' '}
          <button type="button" className={sidebarNoteLinkClass} onClick={tournaments.onRetry}>
            Spróbuj ponownie
          </button>
        </p>
      )}

      {isEmpty && (
        <p className={sidebarNoteClass}>
          Brak bieżących turniejów.{' '}
          <a {...navLink('create', nav).linkProps} className={sidebarNoteLinkClass}>
            Nowy turniej
          </a>
        </p>
      )}

      {visible.length > 0 && (
        <ul aria-label="Bieżące turnieje" className="divide-y divide-sidebar-border">
          {visible.map((item) => (
            <TournamentItem key={item.id} tournament={item} isOpen={item.id === tournament?.id} {...nav} />
          ))}
        </ul>
      )}

      {more > 0 && (
        <a {...navLink('dashboard', nav, { marksActive: false }).linkProps} className={cn(sidebarNoteClass, 'block cursor-pointer hover:text-sidebar-foreground')}>
          +{more} więcej
        </a>
      )}

      {pinned && (
        <>
          <hr className="mx-3 my-2 border-sidebar-border" />
          <ul aria-label="Otwarty turniej">
            <TournamentItem tournament={pinned} isOpen {...nav} />
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * Karty sekcji pod tytułem. To nawigacja między ekranami, a nie ARIA
 * `tablist`: każda karta prowadzi pod inny adres, więc aktywną oznacza
 * `aria-current`. Na wąskim ekranie, gdzie sidebar chowa się do szuflady,
 * karty przewijają się w poziomie.
 */
function SectionTabs(nav: NavProps) {
  return (
    <nav aria-label="Sekcje turnieju" className="-mb-px flex gap-1 overflow-x-auto">
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const { isActive, isDisabled, linkProps } = navLink(key, nav)
        const badge = nav.sectionBadge?.(key)
        return (
          <a
            key={key}
            {...linkProps}
            title={isDisabled ? (nav.navDisabledReason?.(key) ?? 'Wkrótce') : undefined}
            className={sectionTabVariants({ active: isActive, disabled: isDisabled })}
          >
            <Icon className="size-4" />
            {label}
            {badge && badge.count > 0 && (
              <>
                <span
                  aria-hidden
                  data-slot="section-badge"
                  className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-medium text-primary-foreground tabular-nums"
                >
                  {badge.count}
                </span>
                <span className="sr-only">, {badge.label}</span>
              </>
            )}
          </a>
        )
      })}
    </nav>
  )
}

/** Inicjały do awatara: „Klub Sportowy" → „KS". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Konto tak, jak pokazują je sidebar i header. */
interface AccountView {
  name: string
  avatar: string
  email: string
  isPending: boolean
  isUnknown: boolean
}

function accountView(user: AdminShellAccount): AccountView {
  const isPending = user === 'pending'
  const isUnknown = user === null
  // Nazwy ani inicjału nie zgadujemy: „W" od „Wczytywanie…" wyglądało jak
  // inicjał prawdziwego konta, a nazwa zastępcza jak nazwa cudzego.
  return {
    name: isUnknown ? 'Konto nieustalone' : isPending ? 'Wczytywanie konta…' : user.name,
    avatar: isUnknown || isPending ? '—' : initials(user.name),
    email: isUnknown || isPending ? '' : user.email,
    isPending,
    isUnknown,
  }
}

type SidebarProps = TournamentNavProps & Pick<AdminShellProps, 'tournaments' | 'tournament'> & { account: AccountView }

/**
 * Zawartość sidebaru: marka, „Turnieje" z listą bieżących i konto. Na
 * desktopie stoi w `<aside>`, a poniżej `md` w szufladzie spod przycisku menu
 * (#196), żeby telefon miał te same cele co desktop.
 */
function SidebarContent({ account, tournaments, tournament, tournamentHref, onOpenTournament, ...nav }: SidebarProps) {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Trophy className="size-4" />
        </span>
        <span className="text-sm font-bold tracking-tight">
          Tournament<span className="text-primary">App</span>
        </span>
      </div>

      {/* Sekcji turnieju tu nie ma: są kartami pod tytułem, a dwie nawigacje
          na te same ekrany tylko by się dublowały. */}
      <nav aria-label="Panel" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        <TournamentsLink {...nav} />
        <TournamentList
          tournaments={tournaments}
          tournament={tournament}
          tournamentHref={tournamentHref}
          onOpenTournament={onOpenTournament}
          {...nav}
        />
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-sidebar-accent/50">
          <Avatar shape="square">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{account.avatar}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-xs leading-tight">
            <div
              className={cn('truncate font-medium', account.isUnknown && 'italic text-muted-foreground')}
              aria-busy={account.isPending || undefined}
            >
              {account.name}
            </div>
            {account.email && <div className="truncate text-muted-foreground">{account.email}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

/** Szerokość, od której stoi sidebar (`md` w Tailwindzie). */
const SIDEBAR_QUERY = '(min-width: 48rem)'

/**
 * Szuflada z zawartością sidebaru poniżej `md` (#196). Wybranie celu ją
 * zamyka: router podmienia ekran bez przeładowania, a ten sam shell zostaje
 * zamontowany, np. przy przejściu z turnieju do turnieju, więc otwarta
 * szuflada zasłaniałaby nowy ekran.
 */
function MobileNav({ onNavigate, onOpenTournament, ...sidebar }: SidebarProps) {
  const [open, setOpen] = React.useState(false)

  // Telefon obrócony do poziomu przekracza `md`: wtedy stoi już sidebar,
  // a modalna szuflada z przyciemnieniem zostałaby nad nim bez przycisku.
  React.useEffect(() => {
    if (!open) return
    const query = window.matchMedia(SIDEBAR_QUERY)
    const closeWhenSidebarShows = () => { if (query.matches) setOpen(false) }
    closeWhenSidebarShows()
    query.addEventListener('change', closeWhenSidebarShows)
    return () => query.removeEventListener('change', closeWhenSidebarShows)
  }, [open])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu panelu">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="gap-0 bg-sidebar text-sidebar-foreground"
      >
        <SheetTitle className="sr-only">Menu panelu</SheetTitle>
        <SidebarContent
          {...sidebar}
          onNavigate={onNavigate && ((key) => { setOpen(false); onNavigate(key) })}
          onOpenTournament={onOpenTournament && ((id) => { setOpen(false); onOpenTournament(id) })}
        />
      </SheetContent>
    </Sheet>
  )
}

export function AdminShell({
  active,
  tournament,
  tournaments,
  title,
  subtitle,
  actions,
  children,
  user,
  navHref,
  navDisabledReason,
  sectionBadge,
  onNavigate,
  tournamentHref,
  onOpenTournament,
  onLogout,
}: AdminShellProps) {
  const nav: NavProps = { active, navHref, navDisabledReason, sectionBadge, onNavigate }
  const account = accountView(user)
  const sidebar: SidebarProps = { ...nav, account, tournaments, tournament, tournamentHref, onOpenTournament }
  // Samo `id` turnieju mówi, gdzie stoimy, ale nagłówka z niego nie złożymy:
  // dopóki nie ma nazwy i statusu, zostaje układ ekranu poza turniejem.
  const details = tournament && hasDetails(tournament) ? tournament : undefined

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarContent {...sidebar} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <MobileNav {...sidebar} />
          <div className="relative w-72 max-w-[40vw]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-9" placeholder="Szukaj turnieju, drużyny…" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Powiadomienia"><Bell className="size-4" /></Button>
            <DropdownMenu>
              {/* Trigger musi być prawdziwym przyciskiem: `asChild` wprost na
                  `Avatar` (to `<span>`) dawało semantykę przycisku bez fokusu,
                  więc „Wyloguj" było nieosiągalne z klawiatury. Promień jak
                  w `Avatar shape="square"`, żeby pierścień fokusu przylegał do awatara.
                  `border-0`, bo przezroczysta ramka z bazy `Button` zjada piksel
                  z każdej strony, a awatar 32×32 się nie kurczy i na nią wystaje. */}
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="cursor-pointer rounded-md border-0" aria-label="Menu konta">
                  <Avatar shape="square">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{account.avatar}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{account.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Settings className="size-4" /> Ustawienia konta</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onLogout}><LogOut className="size-4" /> Wyloguj</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className={cn('border-b bg-card px-4 sm:px-6', details ? 'pt-4' : 'py-4')}>
          <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', details && 'pb-4')}>
            <div className="min-w-0">
              <Heading>{title}</Heading>
              {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            {(details || actions) && (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                {/* Status stoi też tutaj, bo poniżej `md` lista turniejów siedzi w zamkniętej szufladzie. */}
                {details && <TournamentStatusBadge status={details.status} />}
                {actions}
              </div>
            )}
          </div>
          {details && <SectionTabs {...nav} />}
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
