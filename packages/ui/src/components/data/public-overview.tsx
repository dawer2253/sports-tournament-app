import type * as React from 'react'
import { CalendarClock, ChevronRight, History, ListOrdered, Radio } from 'lucide-react'
import { PublicSection } from '../layout/public-section'
import { Button } from '../ui/button'
import { LiveMatchTile } from './live-match-tile'
import { MatchRow } from './match-row'
import { latestRoundMatches, nextRoundMatches, type MatchInRound, type RoundWithMatches } from './round-groups'
import { StandingsSnippet } from './standings-snippet'
import type { StandingsTableRow } from './standings-table-row'

/** Pełny widok, do którego prowadzi odnośnik sekcji Przeglądu. */
export type PublicOverviewLink = 'standings' | 'fixtures' | 'results'

export interface PublicOverviewProps {
  /** `/fixtures` po kolejce, rosnąco (`groupByRound`) — jak Terminarz. */
  fixtures?: RoundWithMatches<MatchInRound>[]
  /** `/results` po kolejce, od najnowszej (`groupByRound`, `desc`) — jak Wyniki. */
  results?: RoundWithMatches<MatchInRound>[]
  /** Wiersze pierwszej tabeli turnieju; bez nich zamiast skrótu stoi `status.standings`. */
  standings?: StandingsTableRow[]
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres pełnego widoku. Bez niego odnośniki są dekoracją (Storybook). */
  linkHref?: (key: PublicOverviewLink) => string | undefined
  /** Przejęcie kliknięcia w odnośnik, np. przez router — wzorem `PublicShell.onNavigate`. */
  onNavigate?: (key: PublicOverviewLink) => void
  /**
   * Stan zapytania w miejscu jego sekcji, np. błąd z ponowieniem: meczów na
   * górze, wyników pod „Ostatnimi wynikami”, tabeli zamiast skrótu.
   */
  status?: Partial<Record<'fixtures' | 'results' | 'standings', React.ReactNode>>
}

/** Atrybuty odnośnika: adres i przejęcie kliknięcia. */
type LinkProps = { href?: string; onClick: (event: React.MouseEvent) => void }

/** Odnośnik w nagłówku sekcji do pełnego widoku. */
function SectionLink({ link, children }: { link: LinkProps; children: string }) {
  return (
    <Button asChild variant="link" size="sm" className="px-0">
      <a {...link}>
        {children}
        <ChevronRight />
      </a>
    </Button>
  )
}

/**
 * Przegląd strony publicznej (#206), od góry: Na żywo, Najbliższe mecze,
 * Ostatnie wyniki, Tabela (skrót). Sekcja bez meczów znika. Kolejki
 * „najbliższa” i „ostatnia” to te, na których otwierają się Terminarz
 * i Wyniki (`nextRoundMatches`, `latestRoundMatches`).
 */
export function PublicOverview({ fixtures = [], results = [], standings, timeZone, linkHref, onNavigate, status = {} }: PublicOverviewProps) {
  const live = fixtures.flatMap((round) => round.matches).filter((match) => match.status === 'live')
  const upcoming = nextRoundMatches(fixtures)
  const latest = latestRoundMatches(results)

  function link(key: PublicOverviewLink): LinkProps {
    return {
      href: linkHref?.(key),
      onClick: (event: React.MouseEvent) => {
        if (!onNavigate) return
        event.preventDefault()
        onNavigate(key)
      },
    }
  }

  return (
    <div className="grid gap-6">
      {status.fixtures}
      {live.length > 0 && (
        <PublicSection title="Na żywo" icon={<Radio />}>
          {live.map((match) => (
            <LiveMatchTile
              key={match.id}
              match={match}
              action={
                <Button asChild size="sm" className="w-full">
                  <a {...link('fixtures')}>
                    <Radio className="size-4" />
                    Śledź na żywo
                  </a>
                </Button>
              }
            />
          ))}
        </PublicSection>
      )}
      {upcoming.length > 0 && (
        <PublicSection title="Najbliższe mecze" icon={<CalendarClock />} action={<SectionLink link={link('fixtures')}>Cały terminarz</SectionLink>}>
          {upcoming.map((match) => (
            <MatchRow key={match.id} match={match} timeZone={timeZone} statusDisplay="live" />
          ))}
        </PublicSection>
      )}
      {latest.length > 0 && (
        <PublicSection title="Ostatnie wyniki" icon={<History />} action={<SectionLink link={link('results')}>Wszystkie wyniki</SectionLink>}>
          {latest.map((match) => (
            <MatchRow key={match.id} match={match} timeZone={timeZone} statusDisplay="live" />
          ))}
        </PublicSection>
      )}
      {status.results}
      {standings ? (
        <PublicSection title="Tabela (skrót)" icon={<ListOrdered />} action={<SectionLink link={link('standings')}>Zobacz pełną tabelę</SectionLink>}>
          <StandingsSnippet rows={standings} />
        </PublicSection>
      ) : (
        status.standings
      )}
    </div>
  )
}
