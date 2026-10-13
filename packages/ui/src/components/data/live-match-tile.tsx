import { MapPin } from 'lucide-react'
import type * as React from 'react'
import { LiveMarker } from '../layout/live-marker'
import type { MatchRowData } from './match-row-data'
import { scorerSides } from './scorer-lines'
import { ScorerList } from './scorer-list'

export interface LiveMatchTileProps {
  /** Mecz `live`; pole `round` to `Match.round` z kontraktu. */
  match: MatchRowData & { round: { name: string } }
  /** Akcja pod wynikiem, np. odnośnik „Śledź na żywo”. */
  action?: React.ReactNode
}

/**
 * Wyróżniony kafel meczu trwającego na Przeglądzie strony publicznej:
 * kolejka, `LiveMarker`, obiekt, para, wynik cząstkowy i strzelcy (#208).
 * Wynik jest najmocniejszym elementem kafla, więc stan nie dostaje
 * plakietki, tylko znacznik (patrz `LiveMarker`).
 */
export function LiveMatchTile({ match, action }: LiveMatchTileProps) {
  const home = match.homeTeam?.name ?? 'Do ustalenia'
  const away = match.awayTeam?.name ?? 'Do ustalenia'
  const scorers = scorerSides(match)

  return (
    <article
      aria-label={`${home} – ${away}`}
      className="rounded-lg border border-primary/25 bg-primary/5 p-4"
    >
      {/* Kolejka to kontekst całego meczu, obiekt to jeden z jego faktów —
          różna ranga, więc różne miejsce w układzie, a nie kropka między nimi. */}
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{match.round.name}</p>
      <div className="mb-3 flex items-center justify-between gap-2">
        <LiveMarker />
        {match.venue && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{match.venue.name}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className="truncate text-right font-semibold">{home}</span>
        <span
          data-slot="match-score"
          className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-2xl font-extrabold tabular-nums shadow-sm"
        >
          <span>{match.homeScore ?? 0}</span>
          <span aria-hidden className="text-muted-foreground">:</span>
          <span>{match.awayScore ?? 0}</span>
        </span>
        <span className="truncate font-semibold">{away}</span>
        {/* Strzelcy pod nazwami, w ich kolumnach: wynik zostaje na miejscu (#208). */}
        <ScorerList lines={scorers.home} team={home} align="end" className="col-start-1" />
        <ScorerList lines={scorers.away} team={away} className="col-start-3" />
      </div>
      {action && <div className="mt-3">{action}</div>}
    </article>
  )
}
