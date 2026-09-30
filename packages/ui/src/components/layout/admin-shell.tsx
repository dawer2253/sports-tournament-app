import * as React from 'react'
import {
  LayoutGrid, Users, CalendarDays, MapPin, BarChart3, Settings,
  Trophy, Search, Bell, LogOut, GitFork,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TournamentRow } from '../data/tournament-row'
import { TournamentStatusBadge } from '../data/tournament-status-badge'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Heading } from '../ui/typography'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu'

/** Sekcja turnieju, czyli jedna z kart pod tytułem strony. */
export type AdminSectionKey = 'teams' | 'venues' | 'settings' | 'schedule' | 'bracket' | 'stats'

/**
 * Cel nawigacji panelu: lista turniejów (`dashboard`, pozycja „Turnieje"),
 * karta turnieju w sidebarze (`tournament`) albo sekcja turnieju.
 */
export type AdminNavKey = 'dashboard' | 'tournament' | AdminSectionKey

/** Kolejność kart jest stała: pojawienie się treści nie przesuwa znanych kart. */
const SECTIONS: { key: AdminSectionKey; label: string; icon: React.ElementType }[] = [
  { key: 'teams', label: 'Drużyny', icon: Users },
  { key: 'venues', label: 'Obiekty', icon: MapPin },
  { key: 'settings', label: 'Ustawienia', icon: Settings },
  { key: 'schedule', label: 'Terminarz', icon: CalendarDays },
  { key: 'bracket', label: 'Drabinka', icon: GitFork },
  { key: 'stats', label: 'Statystyki', icon: BarChart3 },
]

/** Turniej, w którym stoi ekran: tyle, ile pokazuje karta turnieju. */
export type AdminShellTournament = Pick<TournamentRow, 'name' | 'status' | 'sport'>

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
   * Turniej, w którym stoi ekran. Z nim sidebar dostaje kartę turnieju,
   * nagłówek karty sekcji, a prawa strona nagłówka status. Tytuł nadal podaje
   * ekran — w turnieju to nazwa turnieju, a podtytuł to sport i `/t/slug`.
   */
  tournament?: AdminShellTournament
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  /**
   * Wymagany: shell nie ma własnego konta zastępczego, bo fikcyjny organizer
   * w headerze jest gorszy niż widoczny brak danych. Ekrany Storybooka podają
   * je przez `ShellDemo` z `screens/`.
   */
  user: AdminShellAccount
  /**
   * Adres pozycji „Turnieje", karty turnieju i kart sekcji. Domyślnie cała
   * nawigacja jest martwa (Storybook).
   */
  navHref?: (key: AdminNavKey) => string | undefined
  /** Przejęcie kliknięcia w nawigację, np. przez router. */
  onNavigate?: (key: AdminNavKey) => void
  onLogout?: () => void
}

type NavProps = Pick<AdminShellProps, 'active' | 'navHref' | 'onNavigate'>

/**
 * Wspólna mechanika odnośników nawigacji: pozycji „Turnieje", karty turnieju
 * i kart sekcji.
 *
 * Aplikacja podaje adresy tylko dla ekranów, które już istnieją. Cel bez
 * adresu nie udaje odnośnika: nie da się w niego wejść z klawiatury i widać po
 * nim, że jest nieczynny. W Storybooku (bez `navHref`) cała nawigacja zostaje
 * dekoracją, a nie nieczynnością.
 */
function navLink(key: AdminNavKey, { active, navHref, onNavigate }: NavProps) {
  const href = navHref?.(key)
  const isActive = key === active
  const isDisabled = navHref !== undefined && href === undefined
  return {
    isActive,
    isDisabled,
    linkProps: {
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!onNavigate) return
        event.preventDefault()
        if (!isDisabled) onNavigate(key)
      },
      'aria-current': isActive ? ('page' as const) : undefined,
      'aria-disabled': isDisabled || undefined,
      tabIndex: isDisabled ? -1 : undefined,
    },
  }
}

function TournamentsLink(nav: NavProps) {
  const { isActive, isDisabled, linkProps } = navLink('dashboard', nav)
  return (
    <a
      {...linkProps}
      className={cn(
        'relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity',
        isActive
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:opacity-100'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        isDisabled && 'cursor-default opacity-50 hover:bg-transparent',
      )}
    >
      <LayoutGrid className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
      Turnieje
    </a>
  )
}

/**
 * Kontekst ekranu w sidebarze. Obramowanie ma zawsze, bo pokazuje, w którym
 * turnieju jesteśmy, niezależnie od sekcji, na której stoi ekran.
 */
function TournamentCard({ tournament, ...nav }: NavProps & { tournament: AdminShellTournament }) {
  const { isDisabled, linkProps } = navLink('tournament', nav)
  return (
    <a
      {...linkProps}
      className={cn(
        'mx-1 mt-3 block cursor-pointer rounded-md border border-primary/40 bg-background/60 px-3 py-2 transition-colors hover:bg-sidebar-accent/50',
        isDisabled && 'cursor-default opacity-50 hover:bg-background/60',
      )}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Turniej</span>
      <span className="mt-0.5 block truncate text-sm font-semibold" title={tournament.name}>{tournament.name}</span>
      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <TournamentStatusBadge status={tournament.status} />
        <span className="truncate">{tournament.sport.name}</span>
      </span>
    </a>
  )
}

/**
 * Karty sekcji pod tytułem. To nawigacja między ekranami, a nie ARIA
 * `tablist`: każda karta prowadzi pod inny adres, więc aktywną oznacza
 * `aria-current`. Na wąskim ekranie, gdzie nie ma sidebaru, karty przewijają
 * się w poziomie.
 */
function SectionTabs(nav: NavProps) {
  return (
    <nav aria-label="Sekcje turnieju" className="-mb-px flex gap-1 overflow-x-auto">
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const { isActive, isDisabled, linkProps } = navLink(key, nav)
        return (
          <a
            key={key}
            {...linkProps}
            title={isDisabled ? 'Wkrótce' : undefined}
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2 text-sm transition-colors',
              isActive
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
              isDisabled && 'cursor-default opacity-50 hover:text-muted-foreground',
            )}
          >
            <Icon className={cn('size-4', isActive && 'text-primary')} />
            {label}
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

export function AdminShell({
  active,
  tournament,
  title,
  subtitle,
  actions,
  children,
  user,
  navHref,
  onNavigate,
  onLogout,
}: AdminShellProps) {
  const nav: NavProps = { active, navHref, onNavigate }
  const isPending = user === 'pending'
  // Nazwy ani inicjału nie zgadujemy: „W" od „Wczytywanie…" wyglądało jak
  // inicjał prawdziwego konta, a nazwa zastępcza jak nazwa cudzego.
  const accountName = user === null ? 'Konto nieustalone' : isPending ? 'Wczytywanie konta…' : user.name
  const avatar = user === null || isPending ? '—' : initials(user.name)
  const accountEmail = user === null || isPending ? '' : user.email

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">
            Tournament<span className="text-primary">App</span>
          </span>
        </div>

        {/* Sekcji turnieju tu nie ma: są kartami pod tytułem, a dwie nawigacje
            na te same ekrany tylko by się dublowały. */}
        <nav aria-label="Panel" className="flex-1 space-y-0.5 p-2">
          <TournamentsLink {...nav} />
          {tournament && <TournamentCard tournament={tournament} {...nav} />}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-sidebar-accent/50">
            <Avatar shape="square">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{avatar}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-xs leading-tight">
              <div
                className={cn('truncate font-medium', user === null && 'italic text-muted-foreground')}
                aria-busy={isPending || undefined}
              >
                {accountName}
              </div>
              {accountEmail && <div className="truncate text-muted-foreground">{accountEmail}</div>}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
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
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{avatar}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{accountName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Settings className="size-4" /> Ustawienia konta</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onLogout}><LogOut className="size-4" /> Wyloguj</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className={cn('border-b bg-card px-4 sm:px-6', tournament ? 'pt-4' : 'py-4')}>
          <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', tournament && 'pb-4')}>
            <div className="min-w-0">
              <Heading>{title}</Heading>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {(tournament || actions) && (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                {/* Status stoi też tutaj, bo poniżej `md` sidebaru z kartą turnieju nie ma. */}
                {tournament && <TournamentStatusBadge status={tournament.status} />}
                {actions}
              </div>
            )}
          </div>
          {tournament && <SectionTabs {...nav} />}
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
