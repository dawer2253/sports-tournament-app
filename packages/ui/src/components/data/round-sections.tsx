import { useState } from 'react'
import { matchDays } from '../../lib/kickoff'
import { Button } from '../ui/button'
import { Heading } from '../ui/typography'
import { MatchRow, type MatchRowProps } from './match-row'
import type { MatchRowData } from './match-row-data'
import type { RoundWithMatches } from './round-groups'

/** Ile kolejek pokazuje pierwsza porcja i ile dokłada każde „Pokaż więcej”. */
export const ROUNDS_PER_PAGE = 3

export interface RoundSectionsProps {
  /** Kolejki w kolejności listy (`groupByRound`). */
  rounds: RoundWithMatches[]
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Patrz `MatchRow.statusDisplay`. */
  statusDisplay?: MatchRowProps['statusDisplay']
  /** Adres strony meczu (#210); bez niego wiersze są tylko do odczytu. */
  matchHref?: (match: MatchRowData) => string
  /** Przejęcie kliknięcia w wiersz, np. przez router (`MatchRow.onNavigate`). */
  onMatchNavigate?: (match: MatchRowData) => void
}

/**
 * Mecze jedną listą kolejek, jak na Flashscore (#226): każda kolejka to sekcja
 * z nagłówkiem (nazwa i zakres dat), pod nim jej mecze na `MatchRow`.
 * Terminarz i Wyniki strony publicznej; panel zostaje przy `RoundList`.
 *
 * Na start widać `ROUNDS_PER_PAGE` pierwszych kolejek, a gdy mecz trwa
 * w dalszej (wcześniejsza ma jeszcze mecz przełożony), pierwsza porcja sięga
 * do ostatniej kolejki z meczem trwającym włącznie — „Śledź na żywo”
 * z Przeglądu trafia więc na mecz. „Pokaż więcej” dokłada kolejne porcje.
 *
 * Komponent pamięta `id` ostatniej pokazanej kolejki, nie liczbę porcji,
 * także przed pierwszym kliknięciem: nowa kolejka na górze Wyników wchodzi
 * przy odpytywaniu ponad to, co widać, a koniec meczu trwającego nie skraca
 * porcji, więc nic nie spada pod „Pokaż więcej”. Gdy zapamiętana kolejka
 * zniknie z danych (Terminarz: jej ostatni mecz się zakończył), lista wraca
 * do domyślnej porcji i od niej liczy dalej.
 */
export function RoundSections({ rounds, timeZone, statusDisplay, matchHref, onMatchNavigate }: RoundSectionsProps) {
  const [lastShown, setLastShown] = useState<number | null>(null)
  const liveIndex = rounds.findLastIndex((round) => round.matches.some((match) => match.status === 'live'))
  const initial = Math.max(ROUNDS_PER_PAGE, liveIndex + 1)
  const lastShownIndex = rounds.findIndex((round) => round.summary.id === lastShown)
  const shown = Math.min(Math.max(initial, lastShownIndex + 1), rounds.length)

  // Zapamiętanie porcji pokazanej bez kliknięcia: stan poprawiany w trakcie
  // renderu, nie w efekcie, żeby odpytywanie nie mignęło krótszą listą.
  const shownLast = rounds[shown - 1]?.summary.id ?? null
  if (shownLast !== lastShown) setLastShown(shownLast)

  function showMore() {
    setLastShown(rounds[Math.min(shown + ROUNDS_PER_PAGE, rounds.length) - 1]!.summary.id)
  }

  return (
    <div className="space-y-8">
      {rounds.slice(0, shown).map((round) => (
        <RoundSection
          key={round.summary.id}
          round={round}
          timeZone={timeZone}
          statusDisplay={statusDisplay}
          matchHref={matchHref}
          onMatchNavigate={onMatchNavigate}
        />
      ))}
      {shown < rounds.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={showMore}>
            Pokaż więcej
          </Button>
        </div>
      )}
    </div>
  )
}

function RoundSection({
  round,
  timeZone,
  statusDisplay,
  matchHref,
  onMatchNavigate,
}: Omit<RoundSectionsProps, 'rounds'> & { round: RoundWithMatches }) {
  // Datę w wierszu pokazuje tylko kolejka rozłożona na kilka dni; jednodniowej
  // wystarcza zakres w nagłówku.
  const oneDay = matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length === 1
  const headingId = `round-${round.summary.id}`

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b pb-1.5">
        <Heading level="card" as="h2" id={headingId}>
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
  )
}
