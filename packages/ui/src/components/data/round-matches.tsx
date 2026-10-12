import { useState } from 'react'
import { matchDays } from '../../lib/kickoff'
import { Heading } from '../ui/typography'
import { MatchRow, type MatchRowProps } from './match-row'
import { RoundList } from './round-list'
import type { RoundWithMatches } from './round-groups'

export interface RoundMatchesProps {
  /** Kolejki w kolejności listy; pierwsza jest wybrana na starcie. */
  rounds: RoundWithMatches[]
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Patrz `RoundList.progress`. */
  progress?: boolean
  /** Patrz `MatchRow.statusDisplay`. */
  statusDisplay?: MatchRowProps['statusDisplay']
}

/**
 * Mecze po kolejce: `RoundList` z boku (od `lg`) albo zwinięta nad meczami
 * (#198), obok mecze wybranej kolejki na `MatchRow`. Ten sam układ co
 * terminarz panelu, tylko do odczytu — Terminarz i Wyniki strony publicznej.
 *
 * Wybór trzyma komponent. Kolejka, która zniknęła z danych przy odświeżeniu
 * (np. jej ostatni mecz się zakończył i wypadł z terminarza), oddaje wybór
 * pierwszej z listy, zamiast zostawić pusty ekran.
 */
export function RoundMatches({ rounds, timeZone, progress, statusDisplay }: RoundMatchesProps) {
  const [value, setValue] = useState<number | undefined>(rounds[0]?.summary.id)
  const round = rounds.find((candidate) => candidate.summary.id === value) ?? rounds[0]
  if (!round) return null

  const oneDay = matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length === 1
  const headingId = `round-${round.summary.id}`

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <RoundList
        rounds={rounds.map((candidate) => candidate.summary)}
        value={round.summary.id}
        onValueChange={setValue}
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
              <MatchRow match={match} showDate={!oneDay} timeZone={timeZone} statusDisplay={statusDisplay} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
