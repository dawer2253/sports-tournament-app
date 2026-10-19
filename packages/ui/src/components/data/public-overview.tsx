import type * as React from 'react'
import { CalendarClock, ChevronRight, GitFork, History, ListOrdered, Radio, Trophy } from 'lucide-react'
import type { BracketMatch } from '../../lib/bracket'
import { isModifiedClick } from '../../lib/utils'
import { PublicSection } from '../layout/public-section'
import { Button } from '../ui/button'
import { BracketSummary } from './bracket-summary'
import { GroupStandingsSnippet, type GroupStandings } from './group-standings-snippet'
import { LeaderboardLeaders } from './leaderboard-leaders'
import type { Leaderboard } from './leaderboard-data'
import { LiveMatchTile } from './live-match-tile'
import { MatchRow } from './match-row'
import type { MatchRowData } from './match-row-data'
import { latestRoundMatches, nextRoundMatches, type MatchInRound, type RoundWithMatches } from './round-groups'
import { StandingsSnippet } from './standings-snippet'
import type { StandingsTableRow } from './standings-table-row'

/** Pełny widok, do którego prowadzi odnośnik sekcji Przeglądu. */
export type PublicOverviewLink = 'standings' | 'bracket' | 'fixtures' | 'results' | 'stats'

export interface PublicOverviewProps {
  /** `/fixtures` po kolejce, rosnąco (`groupByRound`) — jak Terminarz. */
  fixtures?: RoundWithMatches<MatchInRound>[]
  /** `/results` po kolejce, od najnowszej (`groupByRound`, `desc`) — jak Wyniki. */
  results?: RoundWithMatches<MatchInRound>[]
  /** Wiersze tabeli ligi; bez nich i bez `groups` zamiast skrótu stoi `status.standings`. */
  standings?: StandingsTableRow[]
  /**
   * Turniej z fazą grupową (#268): tabele wszystkich grup. Wtedy zamiast
   * skrótu jednej tabeli stoi karta „Tabele grup (skrót)”, z linią wyjścia
   * w każdej grupie.
   */
  groups?: GroupStandings[]
  /**
   * Komplet meczów fazy `knockout`: karta „Drabinka”, a bez meczów — jej
   * pusty stan. Zanim zapytanie dotrze, w tym miejscu stoi `status.bracket`.
   * Puchar (#234) ma ją w miejscu skrótu tabeli, a turniej z grupami (#268)
   * nad skrótem tabel grup, od wygenerowania drabinki — o tym, kiedy ją
   * podać, decyduje aplikacja.
   */
  bracket?: {
    matches?: readonly (BracketMatch & MatchRowData)[]
    /** Sport z remisem: pole wyniku finału ma miejsce na karne. */
    penaltySlot: boolean
  }
  /**
   * Klasyfikacja domyślnej statystyki (`/leaderboard` bez `stat`); bez niej
   * zamiast karty lidera stoi `status.leaderboard`.
   */
  leaderboard?: Leaderboard
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres pełnego widoku. Bez niego odnośniki są dekoracją (Storybook). */
  linkHref?: (key: PublicOverviewLink) => string | undefined
  /** Przejęcie kliknięcia w odnośnik, np. przez router — wzorem `Shell.onNavigate` strony publicznej. */
  onNavigate?: (key: PublicOverviewLink) => void
  /**
   * Adres strony meczu (#210): każdy mecz Przeglądu jest wtedy całym
   * wierszem-odnośnikiem, a „Śledź na żywo” prowadzi na stronę meczu.
   */
  matchHref?: (match: MatchRowData) => string
  /** Przejęcie kliknięcia w mecz, np. przez router. */
  onMatchNavigate?: (match: MatchRowData) => void
  /**
   * Stan zapytania w miejscu jego sekcji, np. błąd z ponowieniem: meczów na
   * górze, wyników pod „Ostatnimi wynikami”, tabeli zamiast skrótu,
   * klasyfikacji zamiast karty lidera.
   */
  status?: Partial<Record<'fixtures' | 'results' | 'standings' | 'bracket' | 'leaderboard', React.ReactNode>>
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
 * Przegląd strony publicznej (#206), od góry: Na żywo („Śledź na żywo” na
 * stronę meczu, #210), Najbliższe mecze,
 * Ostatnie wyniki, Tabela (skrót), a w pucharze karta „Drabinka” (#234),
 * w turnieju z grupami karta „Drabinka” nad „Tabelami grup (skrót)” (#268),
 * i lider klasyfikacji (#207) pod tytułem
 * z etykiety statystyki. Sekcja bez meczów znika, a klasyfikacja przed
 * pierwszym meczem zakończonym ma pusty stan. Kolejki
 * „najbliższa” i „ostatnia” to te, na których otwierają się Terminarz
 * i Wyniki (`nextRoundMatches`, `latestRoundMatches`).
 */
export function PublicOverview({
  fixtures = [],
  results = [],
  standings,
  groups,
  bracket,
  leaderboard,
  timeZone,
  linkHref,
  onNavigate,
  matchHref,
  onMatchNavigate,
  status = {},
}: PublicOverviewProps) {
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

  /** Atrybuty odnośnika do strony meczu; bez `matchHref` „Śledź na żywo” idzie do Terminarza. */
  function matchLink(match: MatchRowData): LinkProps {
    if (!matchHref) return link('fixtures')
    return {
      href: matchHref(match),
      onClick: (event: React.MouseEvent) => {
        if (!onMatchNavigate || isModifiedClick(event)) return
        event.preventDefault()
        onMatchNavigate(match)
      },
    }
  }

  function row(match: MatchRowData) {
    return (
      <MatchRow
        key={match.id}
        match={match}
        timeZone={timeZone}
        statusDisplay="live"
        href={matchHref?.(match)}
        onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
      />
    )
  }

  return (
    // `minmax(0,1fr)`: bez jawnej kolumny siatka rośnie do najdłuższej
    // niełamliwej treści sekcji (długa nazwa drużyny w skrócie tabeli) i
    // rozpycha stronę na telefonie (#209).
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {status.fixtures}
      {live.length > 0 && (
        <PublicSection title="Na żywo" icon={<Radio />}>
          {live.map((match) => (
            <LiveMatchTile
              key={match.id}
              match={match}
              action={
                <Button asChild size="sm" className="w-full">
                  <a {...matchLink(match)}>
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
          {upcoming.map(row)}
        </PublicSection>
      )}
      {latest.length > 0 && (
        <PublicSection title="Ostatnie wyniki" icon={<History />} action={<SectionLink link={link('results')}>Wszystkie wyniki</SectionLink>}>
          {latest.map(row)}
        </PublicSection>
      )}
      {status.results}
      {bracket &&
        (bracket.matches ? (
          <PublicSection title="Drabinka" icon={<GitFork />} action={<SectionLink link={link('bracket')}>Zobacz drabinkę</SectionLink>}>
            <BracketSummary
              matches={bracket.matches}
              penaltySlot={bracket.penaltySlot}
              timeZone={timeZone}
              matchHref={matchHref}
              onMatchNavigate={onMatchNavigate}
            />
          </PublicSection>
        ) : (
          status.bracket
        ))}
      {groups ? (
        <PublicSection title="Tabele grup (skrót)" icon={<ListOrdered />} action={<SectionLink link={link('standings')}>Zobacz tabele</SectionLink>}>
          {/* Dwie kolumny od `md`, czyli na komputerze; na telefonie grupy idą jedna pod drugą. */}
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <GroupStandingsSnippet key={group.id} group={group} />
            ))}
          </div>
        </PublicSection>
      ) : standings ? (
        <PublicSection title="Tabela (skrót)" icon={<ListOrdered />} action={<SectionLink link={link('standings')}>Zobacz pełną tabelę</SectionLink>}>
          <StandingsSnippet rows={standings} />
        </PublicSection>
      ) : (
        status.standings
      )}
      {leaderboard ? (
        <PublicSection title={leaderboard.label} icon={<Trophy />} action={<SectionLink link={link('stats')}>Wszystkie statystyki</SectionLink>}>
          <LeaderboardLeaders label={leaderboard.label} rows={leaderboard.rows} />
        </PublicSection>
      ) : (
        status.leaderboard
      )}
    </div>
  )
}
