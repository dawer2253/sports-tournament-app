import * as React from 'react'
import { brandVars } from '../lib/brand-on-dark'
import { cn } from '../lib/utils'
import { Anchor } from './anchor'
import { LEAGUE_TABS, TAB_LABELS, type PublicNavKey } from './public-nav'
import type { PublicShellTournament } from './public-shell-tournament'
import { TournamentLogo } from './tournament-logo'

export interface ShellProps {
  tournament: PublicShellTournament
  /**
   * Aktywna zakładka. Opcjonalna, bo nie każdy ekran turnieju jest zakładką:
   * strona meczu i „Nie ma takiej strony” niczego nie podświetlają.
   */
  active?: PublicNavKey
  /** Adres zakładki. Bez niego zakładki są dekoracją (Storybook). */
  navHref?: (key: PublicNavKey) => string | undefined
  /** Przejęcie kliknięcia w zakładkę, np. przez router. */
  onNavigate?: (key: PublicNavKey) => void
  /** Zakładki w kolejności; bez nich zakładki ligi (`LEAGUE_TABS`). */
  tabs?: readonly PublicNavKey[]
  children: React.ReactNode
}

type TabLinkProps = Pick<ShellProps, 'navHref' | 'onNavigate'> & {
  tab: PublicNavKey
  active: boolean
  className: string
  onChoose?: () => void
}

function TabLink({ tab, active, navHref, onNavigate, className, onChoose }: TabLinkProps) {
  return (
    <Anchor
      href={navHref?.(tab)}
      aria-current={active ? 'page' : undefined}
      onClick={onChoose}
      onNavigate={onNavigate && (() => onNavigate(tab))}
      className={className}
    >
      {TAB_LABELS[tab]}
    </Anchor>
  )
}

/**
 * Korzeń strony publicznej: `.public-site` i zmienne koloru turnieju
 * z `brandVars()`. `.dark` stoi na `<html>` (`apps/public/index.html`), nie tu.
 */
export function SiteRoot({ primaryColor, className, children }: { primaryColor: string; className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="public-site" className={cn('public-site flex min-h-screen flex-col bg-background text-foreground antialiased', className)} style={brandVars(primaryColor)}>
      {children}
    </div>
  )
}

/**
 * Pasek shella w `--pub-sunken`: logo i nazwa turnieju (do Przeglądu) po
 * lewej, zakładki po prawej z podkreśleniem aktywnej w `--brand-line`.
 *
 * Poniżej `md` zakładki chowają się pod przyciskiem „Menu” i rozwijają listą
 * pod paskiem (#288). Lista powstaje dopiero po otwarciu, a poniżej `md` pasek
 * zakładek ma `display: none` (od `md` lista), więc w drzewie dostępności jest
 * zawsze dokładnie jeden landmark „Sekcje turnieju” — po nim szukają zakładek
 * testy i E2E.
 * Escape, wybór zakładki, zmiana aktywnej zakładki, klik w odnośnik w treści
 * i „wstecz” w przeglądarce zamykają listę.
 */
function ShellHeader({ tournament, tabs, active, navHref, onNavigate, open, setOpen }: Required<Pick<ShellProps, 'tabs'>> &
  Pick<ShellProps, 'tournament' | 'active' | 'navHref' | 'onNavigate'> & { open: boolean; setOpen: (open: boolean) => void }) {
  const menuId = React.useId()

  return (
    <header className="border-b border-hairline bg-sunken">
      <div className="mx-auto flex max-w-6xl flex-col gap-x-10 px-4 sm:px-6 md:pt-4 lg:flex-row lg:items-end lg:justify-between lg:pt-0">
        <div className="flex min-h-16 items-center justify-between gap-3 md:min-h-0">
          <Anchor
            href={navHref?.('home')}
            onNavigate={onNavigate && (() => onNavigate('home'))}
            onClick={() => setOpen(false)}
            className="flex min-w-0 items-center gap-3 lg:py-4"
          >
            <TournamentLogo logoUrl={tournament.branding.logoUrl} className="size-10" />
            <h1 className="pub-title truncate text-pub-28 leading-[1.2]">{tournament.name}</h1>
          </Anchor>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen(!open)}
            className="grid size-11 shrink-0 place-items-center rounded-md text-foreground ring-1 ring-border ring-inset hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line md:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        <nav aria-label="Sekcje turnieju" className="hidden gap-7 overflow-x-auto [scrollbar-width:none] md:flex">
          {tabs.map((tab) => (
            <TabLink
              key={tab}
              tab={tab}
              active={tab === active}
              navHref={navHref}
              onNavigate={onNavigate}
              className={cn(
                'shrink-0 border-b-[3px] pt-3 pb-2.5 pub-tab transition-colors lg:pt-5 lg:pb-4',
                tab === active ? 'border-brand-line text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            />
          ))}
        </nav>
        {open && (
          <nav id={menuId} aria-label="Sekcje turnieju" className="-mx-4 flex flex-col border-t border-hairline pb-2 sm:-mx-6 md:hidden">
            {tabs.map((tab) => (
              <TabLink
                key={tab}
                tab={tab}
                active={tab === active}
                navHref={navHref}
                onNavigate={onNavigate}
                onChoose={() => setOpen(false)}
                className={cn(
                  'flex min-h-12 items-center border-l-[3px] px-4 pub-tab text-pub-20 sm:px-6',
                  tab === active ? 'border-brand-line bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              />
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}

/** Stopka: „Prowadzone w TournamentApp” i adres turnieju. */
function Footer({ slug }: { slug: string }) {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-pub-13 text-muted-foreground sm:px-6">
        <span>Prowadzone w TournamentApp</span>
        <span>/t/{slug}</span>
      </div>
    </footer>
  )
}

/**
 * Shell strony publicznej (wariant C „Kolejka”, #287): jeden pasek z logo,
 * nazwą i zakładkami, pod nim treść ekranu i stopka. Kolor turnieju
 * (`branding.primaryColor`) trafia na korzeń przez `brandVars()`.
 */
export function Shell({ tournament, active, navHref, onNavigate, tabs = LEAGUE_TABS, children }: ShellProps) {
  const [open, setOpen] = React.useState(false)

  // Zmiana aktywnej zakładki to przejście na inną trasę: lista się zamyka.
  const [lastActive, setLastActive] = React.useState(active)
  if (lastActive !== active) {
    setLastActive(active)
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', close)
    }
  }, [open])

  return (
    <SiteRoot primaryColor={tournament.branding.primaryColor}>
      <ShellHeader tournament={tournament} tabs={tabs} active={active} navHref={navHref} onNavigate={onNavigate} open={open} setOpen={setOpen} />
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-8 pb-24 sm:px-6 sm:pt-10"
        // Odnośnik w treści prowadzi na inną trasę: lista menu się zamyka.
        onClickCapture={(event) => {
          if (open && (event.target as HTMLElement).closest('a[href]')) setOpen(false)
        }}
      >
        {children}
      </main>
      <Footer slug={tournament.slug} />
    </SiteRoot>
  )
}

/**
 * Strona bez shella turnieju: turnieju nie ma, nie przyszedł albo adres jest
 * spoza `/t/:slug`. Pasek ma sam napis „TournamentApp”, a kolor to domyślna
 * zieleń, bo turnieju i jego koloru nie ma.
 */
export function StandaloneShell({ primaryColor, children }: { primaryColor: string; children: React.ReactNode }) {
  return (
    <SiteRoot primaryColor={primaryColor}>
      <header className="border-b border-hairline bg-sunken">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <span className="pub-tab text-pub-20 text-muted-foreground">TournamentApp</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">{children}</main>
    </SiteRoot>
  )
}
