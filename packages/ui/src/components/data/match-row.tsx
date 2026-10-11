import { Check, MapPin } from 'lucide-react'
import { formatKickoff } from '../../lib/kickoff'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import type { MatchRowData } from './match-row-data'

/**
 * Jedna siatka dla wszystkich wierszy, żeby kolumny stały równo w całej
 * kolejce. Kolumny po bokach mają stałą szerokość, więc wynik stoi w tym
 * samym miejscu niezależnie od plakietki po prawej i długości nazw (#162,
 * pkt 3).
 *
 * Na telefonie termin i stan idą w linię nad parą, a wynik dalej siedzi
 * w środkowej kolumnie. Miejsce każdej komórki jest jawne (`col-start`,
 * `row-start`), więc kolejność w DOM — termin, gospodarz, wynik, gość, stan —
 * jest ta sama na każdej szerokości i tak też czyta ją czytnik ekranu.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)_6.5rem]'

const STATUS_LABEL: Record<MatchRowData['status'], string> = {
  scheduled: 'Zaplanowany',
  live: 'Trwa',
  finished: 'Zakończony',
}

/** Stan meczu jako plakietka, z tymi samymi nazwami co okno meczu (#159). */
export function MatchStatusBadge({ status, className }: { status: MatchRowData['status']; className?: string }) {
  if (status === 'live') {
    return (
      <Badge variant="destructive" className={className}>
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-destructive" />
        {STATUS_LABEL.live}
      </Badge>
    )
  }
  if (status === 'finished') {
    return (
      <Badge variant="outline" className={className}>
        <Check /> {STATUS_LABEL.finished}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={className}>
      {STATUS_LABEL.scheduled}
    </Badge>
  )
}

/**
 * Wynik albo „– : –”. Mecz trwający ma wynik cząstkowy w kolorze stanu
 * „na żywo”, tak jak `LiveMarker`.
 */
function Score({ match }: { match: MatchRowData }) {
  const hasScore = match.homeScore !== null && match.awayScore !== null
  return (
    <span
      data-slot="match-score"
      className={cn(
        'w-full rounded-md px-1 py-1 text-center text-sm tabular-nums',
        hasScore ? 'font-semibold' : 'border text-muted-foreground',
        hasScore && (match.status === 'live' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background'),
      )}
    >
      {hasScore ? `${match.homeScore} : ${match.awayScore}` : '– : –'}
    </span>
  )
}

function teamName(team: MatchRowData['homeTeam']) {
  return team?.name ?? 'Do ustalenia'
}

export interface MatchRowProps {
  match: MatchRowData
  /**
   * `false`, gdy cała kolejka gra jednego dnia: data stoi wtedy nad listą,
   * a wiersz pokazuje samą godzinę.
   */
  showDate?: boolean
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  className?: string
}

/**
 * Wiersz meczu w terminarzu panelu: termin i obiekt | gospodarz | wynik |
 * gość | stan. Tylko do odczytu — okno meczu dochodzi w #176.
 */
export function MatchRow({ match, showDate = true, timeZone, className }: MatchRowProps) {
  const home = teamName(match.homeTeam)
  const away = teamName(match.awayTeam)

  return (
    <div
      data-slot="match-row"
      role="group"
      aria-label={`${home} – ${away}`}
      className={cn(ROW_GRID, 'items-center rounded-xl border bg-card px-3 py-2.5 text-sm', className)}
    >
      <div className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:col-span-1 sm:block">
        <span className="shrink-0 tabular-nums">{formatKickoff(match.kickoffAt, { showDate, timeZone })}</span>
        {match.venue && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{match.venue.name}</span>
          </span>
        )}
      </div>
      <span className="col-start-1 row-start-2 truncate text-right font-medium sm:col-start-2 sm:row-start-1">{home}</span>
      <span className="col-start-2 row-start-2 flex sm:col-start-3 sm:row-start-1">
        <Score match={match} />
      </span>
      <span className="col-start-3 row-start-2 truncate font-medium sm:col-start-4 sm:row-start-1">{away}</span>
      <span className="col-start-3 row-start-1 flex justify-end sm:col-start-5">
        <MatchStatusBadge status={match.status} />
      </span>
    </div>
  )
}
