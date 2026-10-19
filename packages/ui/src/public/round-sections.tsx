import * as React from 'react'
import type { MatchRowData } from '../components/data/match-row-data'
import { roundsPage, type RoundWithMatches } from '../components/data/round-groups'
import { matchDays } from '../lib/kickoff'
import { Button } from './button'
import { Fact } from './heads'
import { MatchRow, type MatchListMode } from './match-row'

export interface RoundSectionsProps {
  /** Kolejki w kolejności listy (`groupByRound`). */
  rounds: RoundWithMatches[]
  /** Terminarz pokazuje na belce postęp kolejki (`summary.finished` z `summary.total`), Wyniki nie. */
  mode: MatchListMode
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu; bez niego wiersz jest odnośnikiem bez adresu (Storybook). */
  matchHref?: (match: MatchRowData) => string
  /** Przejęcie kliknięcia w wiersz przez router. */
  onMatchNavigate?: (match: MatchRowData) => void
}

/**
 * Terminarz i Wyniki jedną listą kolejek (#226, #292): kolejka to sekcja
 * z belką (nazwa, zakres dat, w Terminarzu postęp), pod nią wiersze meczów.
 * Porcje liczy `roundsPage`: pamięta `id` ostatniej pokazanej kolejki, więc
 * odpytywanie nie zabiera treści sprzed oczu, a kolejka z meczem trwającym
 * stoi zawsze w pierwszej porcji.
 */
export function RoundSections({ rounds, mode, timeZone, matchHref, onMatchNavigate }: RoundSectionsProps) {
  const [lastShown, setLastShown] = React.useState<number | null>(null)
  const page = roundsPage(rounds, lastShown)

  // Zapamiętanie porcji pokazanej bez kliknięcia: stan poprawiany w trakcie
  // renderu, nie w efekcie, żeby odpytywanie nie mignęło krótszą listą.
  if (page.lastShown !== lastShown) setLastShown(page.lastShown)

  return (
    <div data-slot="round-sections" className="flex flex-col gap-10">
      {rounds.slice(0, page.shown).map((round) => (
        <RoundSection key={round.summary.id} round={round} mode={mode} timeZone={timeZone} matchHref={matchHref} onMatchNavigate={onMatchNavigate} />
      ))}
      {page.more !== null && (
        <div className="flex justify-center">
          <Button onClick={() => setLastShown(page.more)}>Pokaż więcej</Button>
        </div>
      )}
    </div>
  )
}

function RoundSection({ round, mode, timeZone, matchHref, onMatchNavigate }: Omit<RoundSectionsProps, 'rounds'> & { round: RoundWithMatches }) {
  // Dzień w wierszu tylko w kolejce rozłożonej na kilka dni; jednodniowej
  // wystarcza zakres na belce.
  const showDay = matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length > 1
  const headingId = `round-${round.summary.id}`
  return (
    <section aria-labelledby={headingId} data-slot="round" className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-rule pb-2">
        <span className="flex flex-wrap items-baseline gap-x-4">
          <h2 id={headingId} className="pub-h2 text-pub-28">
            {round.summary.name}
          </h2>
          <span data-slot="round-dates" className="text-muted-foreground">
            {round.summary.dates}
          </span>
        </span>
        {mode === 'fixtures' && (
          <span className="text-pub-14 text-muted-foreground">
            <Fact value={round.summary.finished}>z {round.summary.total} rozegrane</Fact>
          </span>
        )}
      </div>
      {round.matches.map((match) => (
        <MatchRow
          key={match.id}
          match={match}
          mode={mode}
          showDay={showDay}
          timeZone={timeZone}
          href={matchHref?.(match)}
          onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
        />
      ))}
    </section>
  )
}
