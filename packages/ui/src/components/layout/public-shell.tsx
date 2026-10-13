import * as React from 'react'
import { Trophy } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { brandForeground } from '../../lib/contrast'
import { cn } from '../../lib/utils'
import { Heading } from '../ui/typography'
import { MetaList } from './meta-list'
import { TournamentLogo } from './tournament-logo'
import type { PublicShellTournament, SportCode } from './public-shell-tournament'
import heroDay from '../../assets/public/hero-day.webp'
import heroNight from '../../assets/public/hero-night.webp'
import heroBasketball from '../../assets/public/hero-basketball.webp'

/** Zakładka strony publicznej. */
export type PublicNavKey = 'home' | 'standings' | 'bracket' | 'fixtures' | 'results' | 'stats'

const LABELS: Record<PublicNavKey, string> = {
  home: 'Przegląd',
  standings: 'Tabela',
  bracket: 'Drabinka',
  fixtures: 'Terminarz',
  results: 'Wyniki',
  stats: 'Statystyki',
}

/** Zakładki ligi; puchar podaje własne przez `tabs` (PROTOTYP #218). */
const LEAGUE_TABS: PublicNavKey[] = ['home', 'standings', 'fixtures', 'results', 'stats']

export type { PublicShellTournament }

/** Zdjęcie hero w motywie jasnym i ciemnym. */
type Hero = { day: string; night: string }

/**
 * Zdjęcie hero per sport. Sport bez wpisu ma płaski kolor turnieju: zdjęcie
 * innej dyscypliny mówiłoby kibicowi nieprawdę o turnieju. Kosz ma jedno
 * zdjęcie na oba motywy; w ciemnym robi swoje scrim od dołu (#192).
 *
 * Klucze pilnuje `SportCode`, więc literówka nie przejdzie po cichu jako
 * płaski kolor. Szukamy po gołym `sport.code`, bo sport spoza listy też ma
 * się wyświetlić — właśnie z płaskim kolorem.
 */
const HERO_BY_SPORT: Readonly<Record<string, Hero | undefined>> = {
  football: { day: heroDay, night: heroNight },
  basketball: { day: heroBasketball, night: heroBasketball },
} satisfies Partial<Record<SportCode, Hero>>

export interface PublicShellProps {
  tournament: PublicShellTournament
  /**
   * Aktywna zakładka. Opcjonalna, bo nie każdy ekran turnieju jest zakładką
   * (strona meczu, #205).
   */
  active?: PublicNavKey
  /** Adres zakładki. Bez niego zakładki są dekoracją (Storybook). */
  navHref?: (key: PublicNavKey) => string | undefined
  /** Przejęcie kliknięcia w zakładkę, np. przez router. */
  onNavigate?: (key: PublicNavKey) => void
  /** PROTOTYP (#218): zakładki i ich kolejność; bez tego zakładki ligi. */
  tabs?: PublicNavKey[]
  children: React.ReactNode
}

const tabVariants = cva('whitespace-nowrap rounded-t-lg px-4 py-2.5 transition-colors', {
  variants: {
    active: {
      true: 'bg-muted font-medium text-foreground shadow-sm',
      false: 'cursor-pointer opacity-80 hover:bg-white/10 hover:opacity-100',
    },
  },
})

function Tabs({ active, navHref, onNavigate, tabs = LEAGUE_TABS }: Pick<PublicShellProps, 'active' | 'navHref' | 'onNavigate' | 'tabs'>) {
  const activeRef = React.useRef<HTMLAnchorElement>(null)

  // Na telefonie pięć zakładek nie mieści się i pasek przewija się w bok.
  // Aktywna zakładka ma być widoczna, także „Statystyki” na końcu. Przewijamy
  // sam pasek, a nie stronę, więc bez `scrollIntoView`.
  React.useLayoutEffect(() => {
    const tab = activeRef.current
    const nav = tab?.parentElement
    if (!tab || !nav) return
    const padding = parseFloat(getComputedStyle(nav).paddingRight)
    if (tab.offsetLeft + tab.offsetWidth > nav.scrollLeft + nav.clientWidth || tab.offsetLeft < nav.scrollLeft) {
      nav.scrollLeft = tab.offsetLeft + tab.offsetWidth + padding - nav.clientWidth
    }
  }, [active])

  return (
    <nav aria-label="Sekcje turnieju" className="relative mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 text-sm sm:px-6">
      {tabs.map((key) => {
        const label = LABELS[key]
        const isActive = key === active
        return (
          <a
            key={key}
            ref={isActive ? activeRef : undefined}
            href={navHref?.(key)}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => {
              if (!onNavigate) return
              event.preventDefault()
              onNavigate(key)
            }}
            className={tabVariants({ active: isActive })}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}

/**
 * Warstwy hero: zdjęcie sportu pod nakładką marki albo, bez zdjęcia, sam
 * kolor turnieju (`bg-brand` na nagłówku).
 *
 * Nakładka w jasnym motywie mocno kryje zdjęcie kolorem turnieju, więc
 * `--brand-foreground` liczony z koloru trzyma kontrast. W ciemnym słabnie,
 * a ciemny scrim od dołu wydobywa nocny mecz — tekst jest tam jasny
 * niezależnie od koloru turnieju (`dark:text-foreground` na nagłówku).
 */
function HeroLayers({ hero }: { hero: Hero }) {
  return (
    <>
      <img
        src={hero.day}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-20 size-full object-cover object-[center_30%] dark:hidden"
      />
      <img
        src={hero.night}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-20 hidden size-full object-cover object-[center_82%] dark:block"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-brand/75 dark:bg-brand/30" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-brand via-brand/50 to-brand/10 dark:from-background dark:via-background/55 dark:to-transparent"
      />
    </>
  )
}

/**
 * Shell strony publicznej turnieju: nagłówek w kolorze turnieju z logo,
 * nazwą i metą, zakładki i stopka z adresem.
 *
 * `--brand` to `branding.primaryColor`, a `--brand-foreground` liczy
 * `brandForeground()` z kontrastu: przy jasnym kolorze tekst jest ciemny.
 * Obie zmienne stoją na korzeniu shella, więc trzymają się też ekranów pod
 * nim (`PhotoPanel`, domyślne logo).
 */
export function PublicShell({ tournament, active, navHref, onNavigate, tabs, children }: PublicShellProps) {
  const { primaryColor, logoUrl } = tournament.branding
  const hero = HERO_BY_SPORT[tournament.sport.code]
  const brand = {
    '--brand': primaryColor,
    '--brand-foreground': brandForeground(primaryColor),
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-muted/40 text-foreground" style={brand}>
      <header
        data-hero={hero ? 'photo' : 'color'}
        className={cn(
          'relative isolate overflow-hidden bg-brand text-brand-foreground',
          hero && 'dark:text-foreground',
        )}
      >
        {hero && <HeroLayers hero={hero} />}

        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 pb-5 pt-9 sm:px-6">
          <TournamentLogo
            logoUrl={logoUrl}
            color={primaryColor}
            className="size-14 rounded-xl bg-white/15 shadow-sm ring-1 ring-white/25"
          />
          <div className="min-w-0">
            <Heading className="truncate font-extrabold text-current drop-shadow-sm">{tournament.name}</Heading>
            <MetaList className="text-sm opacity-85 drop-shadow-sm">
              <>{tournament.sport.name}</>
              {tournament.status === 'finished' && <>Zakończony</>}
            </MetaList>
          </div>
        </div>
        <Tabs active={active} navHref={navHref} onNavigate={onNavigate} tabs={tabs} />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto flex max-w-5xl items-center justify-center px-4 py-8 text-xs text-muted-foreground sm:px-6">
        <MetaList>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5" /> Powered by TournamentApp
          </span>
          <>/t/{tournament.slug}</>
        </MetaList>
      </footer>
    </div>
  )
}
