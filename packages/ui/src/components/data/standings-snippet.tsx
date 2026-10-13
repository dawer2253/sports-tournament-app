import type * as React from 'react'
import { TeamLogo } from '../layout/team-logo'
import type { StandingsTableRow } from './standings-table-row'

/** Ile wierszy ma skrót tabeli na Przeglądzie. */
export const STANDINGS_SNIPPET_ROWS = 5

export interface StandingsSnippetProps {
  /** Wiersze tabeli w kolejności z API; skrót bierze pierwsze `STANDINGS_SNIPPET_ROWS`. */
  rows: StandingsTableRow[]
  /** Akcja pod listą, np. odnośnik „Zobacz pełną tabelę”. */
  action?: React.ReactNode
}

/**
 * Skrót tabeli na Przeglądzie strony publicznej: miejsce, herb, nazwa
 * i punkty pierwszych drużyn. Kolejności nie poprawia — rozstrzygają ją
 * kryteria turnieju po stronie API.
 */
export function StandingsSnippet({ rows, action }: StandingsSnippetProps) {
  return (
    <div className="flex flex-col gap-1">
      <ol aria-label="Czołówka tabeli" className="flex flex-col gap-1">
        {rows.slice(0, STANDINGS_SNIPPET_ROWS).map((row) => (
          <li key={row.team.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="w-4 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">
              {row.position}
            </span>
            <TeamLogo logoUrl={row.team.logoUrl} name={row.team.name} />
            <span className="min-w-0 flex-1 truncate font-medium">{row.team.name}</span>
            <span className="shrink-0 font-bold tabular-nums">
              {row.points}
              <span className="sr-only"> pkt</span>
            </span>
          </li>
        ))}
      </ol>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
