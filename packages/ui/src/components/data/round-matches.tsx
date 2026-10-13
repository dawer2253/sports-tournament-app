import { useState } from 'react'
import { matchDays } from '../../lib/kickoff'
import { Heading } from '../ui/typography'
import { MatchRow, type MatchRowProps } from './match-row'
import type { MatchRowData } from './match-row-data'
import { RoundList } from './round-list'
import type { RoundWithMatches } from './round-groups'

export interface RoundMatchesProps {
  /** Kolejki w kolejności listy; na starcie wybrana pierwsza z meczem `live`, inaczej pierwsza. */
  rounds: RoundWithMatches[]
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Patrz `RoundList.progress`. */
  progress?: boolean
  /** Patrz `MatchRow.statusDisplay`. */
  statusDisplay?: MatchRowProps['statusDisplay']
  /** Adres strony meczu (#210); bez niego wiersze są tylko do odczytu. */
  matchHref?: (match: MatchRowData) => string
  /** Przejęcie kliknięcia w wiersz, np. przez router (`MatchRow.onNavigate`). */
  onMatchNavigate?: (match: MatchRowData) => void
}

/**
 * Mecze po kolejce: `RoundList` z boku (od `lg`) albo zwinięta nad meczami
 * (#198), obok mecze wybranej kolejki na `MatchRow`. Ten sam układ co
 * terminarz panelu, tylko do odczytu — Terminarz i Wyniki strony publicznej.
 *
 * Dopóki kibic sam nie wybierze kolejki, wybrana jest pierwsza z meczem
 * trwającym, a bez takiego pierwsza z listy — także po odświeżeniu, więc
 * „Śledź na żywo” z Przeglądu trafia na mecz trwający (także gdy wcześniejsza
 * kolejka ma jeszcze mecz przełożony), a nowa kolejka w Wynikach albo kolejna
 * w Terminarzu wchodzi na ekran sama. Kolejka wybrana ręcznie zostaje, aż
 * zniknie z danych (np. jej ostatni mecz się zakończył i wypadł
 * z terminarza); wtedy wybór wraca do domyślnej, zamiast zostawić pusty ekran.
 */
export function RoundMatches({ rounds, timeZone, progress, statusDisplay, matchHref, onMatchNavigate }: RoundMatchesProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const round =
    rounds.find((candidate) => candidate.summary.id === chosen) ??
    rounds.find((candidate) => candidate.matches.some((match) => match.status === 'live')) ??
    rounds[0]
  if (!round) return null

  const oneDay = matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length === 1
  const headingId = `round-${round.summary.id}`

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <RoundList
        rounds={rounds.map((candidate) => candidate.summary)}
        value={round.summary.id}
        onValueChange={setChosen}
        progress={progress}
        className="lg:sticky lg:top-4"
      />
      <section aria-labelledby={headingId} className="min-w-0 space-y-2">
        {/* Poniżej `lg` nazwę i daty kolejki niesie już przycisk listy kolejek;
            nagłówek zostaje dla czytnika ekranu jako nazwa sekcji. */}
        <div className="sr-only flex-wrap items-baseline gap-x-2 lg:not-sr-only lg:flex">
          <Heading level="card" id={headingId}>
            {round.summary.name}
          </Heading>
          <span className="text-sm text-muted-foreground">{round.summary.dates}</span>
        </div>
        <ul className="space-y-2">
          {round.matches.map((match) => (
            <li key={match.id}>
              <MatchRow
                match={match}
                showDate={!oneDay}
                timeZone={timeZone}
                statusDisplay={statusDisplay}
                href={matchHref?.(match)}
                onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
