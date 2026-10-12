import { CalendarClock, ChevronRight, History, ListOrdered, Radio } from 'lucide-react'
import { PublicShell } from '../components/layout/public-shell'
import { PublicSection } from '../components/layout/public-section'
import { LiveMatchTile } from '../components/data/live-match-tile'
import { MatchRow } from '../components/data/match-row'
import { latestRoundMatches, nextRoundMatches } from '../components/data/round-groups'
import { StandingsSnippet } from '../components/data/standings-snippet'
import { Button } from '../components/ui/button'
import {
  publicFixtures,
  publicResults,
  publicTournament,
  scheduleTimeZone,
  standingsTableRows,
} from '../lib/demo-data'

/** Odnośnik w nagłówku sekcji; w makiecie martwy, w aplikacji link routera. */
function SectionLink({ children }: { children: string }) {
  return (
    <Button variant="link" size="sm" className="px-0">
      {children}
      <ChevronRight />
    </Button>
  )
}

export interface PublicHomeProps {
  /** `przed-startem`: brak meczów trwających i rozegranych, tabela z zerami. */
  state?: 'w-trakcie' | 'przed-startem'
}

/**
 * Przegląd strony publicznej (#206), od góry: Na żywo, Najbliższe mecze,
 * Ostatnie wyniki, Tabela (skrót). Sekcja bez meczów znika. Wybór kolejek
 * liczą `nextRoundMatches` i `latestRoundMatches` — te same, których używa
 * `apps/public`.
 */
export function PublicHome({ state = 'w-trakcie' }: PublicHomeProps) {
  const started = state === 'w-trakcie'
  const fixtures = started ? publicFixtures : publicFixtures.map((match) => ({ ...match, status: 'scheduled' as const, homeScore: null, awayScore: null }))
  const results = started ? publicResults : []
  const live = fixtures.filter((match) => match.status === 'live')
  const upcoming = nextRoundMatches(fixtures)
  const latest = latestRoundMatches(results)
  const rows = started
    ? standingsTableRows
    : standingsTableRows
        .map((row) => ({ ...row, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0 }))
        .toSorted((a, b) => a.team.name.localeCompare(b.team.name, 'pl'))
        .map((row, index) => ({ ...row, position: index + 1 }))

  return (
    <PublicShell tournament={publicTournament} active="home">
      <div className="grid gap-6">
        {live.length > 0 && (
          <PublicSection title="Na żywo" icon={<Radio />}>
            {live.map((match) => (
              <LiveMatchTile
                key={match.id}
                match={match}
                action={
                  <Button size="sm" className="w-full">
                    <Radio className="size-4" />
                    Śledź na żywo
                  </Button>
                }
              />
            ))}
          </PublicSection>
        )}
        {upcoming.length > 0 && (
          <PublicSection title="Najbliższe mecze" icon={<CalendarClock />} action={<SectionLink>Cały terminarz</SectionLink>}>
            {upcoming.map((match) => (
              <MatchRow key={match.id} match={match} timeZone={scheduleTimeZone} statusDisplay="live" />
            ))}
          </PublicSection>
        )}
        {latest.length > 0 && (
          <PublicSection title="Ostatnie wyniki" icon={<History />} action={<SectionLink>Wszystkie wyniki</SectionLink>}>
            {latest.map((match) => (
              <MatchRow key={match.id} match={match} timeZone={scheduleTimeZone} statusDisplay="live" />
            ))}
          </PublicSection>
        )}
        <PublicSection title="Tabela (skrót)" icon={<ListOrdered />} action={<SectionLink>Zobacz pełną tabelę</SectionLink>}>
          <StandingsSnippet rows={rows} />
        </PublicSection>
      </div>
    </PublicShell>
  )
}
