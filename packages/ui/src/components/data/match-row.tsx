import { AlertTriangle, Check, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatKickoff } from '../../lib/kickoff'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { MATCH_STATUS_LABELS, type MatchCollision, type MatchCollisionType, type MatchRowData } from './match-row-data'

/**
 * Jedna siatka dla wszystkich wierszy, żeby kolumny stały równo w całej
 * kolejce. Kolumny po bokach mają stałą szerokość, więc wynik stoi w tym
 * samym miejscu niezależnie od plakietki po prawej i długości nazw (#162,
 * pkt 3). Slot kolizji jest stały i stoi przed stanem (#175), więc plakietka
 * kolizji nie przesuwa kolumny wyniku ani stanu.
 *
 * Na telefonie termin i stan idą w linię nad parą, a wynik dalej siedzi
 * w środkowej kolumnie. Miejsce każdej komórki jest jawne (`col-start`,
 * `row-start`), więc kolejność w DOM — termin, gospodarz, wynik, gość, stan —
 * jest ta sama na każdej szerokości i tak też czyta ją czytnik ekranu.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)_6.5rem_6.5rem]'

const STATUS_BADGE: Record<
  MatchRowData['status'],
  { label: string; variant: 'secondary' | 'destructive' | 'outline'; icon?: ReactNode }
> = {
  scheduled: { label: MATCH_STATUS_LABELS.scheduled, variant: 'secondary' },
  live: {
    label: MATCH_STATUS_LABELS.live,
    variant: 'destructive',
    icon: <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-destructive" />,
  },
  finished: { label: MATCH_STATUS_LABELS.finished, variant: 'outline', icon: <Check /> },
}

/** Stan meczu jako plakietka, z tymi samymi nazwami co okno meczu (#159). */
export function MatchStatusBadge({ status, className }: { status: MatchRowData['status']; className?: string }) {
  const badge = STATUS_BADGE[status]
  return (
    <Badge variant={badge.variant} className={className}>
      {badge.icon}
      {badge.label}
    </Badge>
  )
}

/** Etykiety rodzajów kolizji z rozstrzygnięcia #158. */
export function collisionLabel(type: MatchCollisionType): string {
  return type === 'team' ? 'Kolizja drużyny' : 'Kolizja boiska'
}

/**
 * Plakietka kolizji z opisem drugiej strony w `title` (#158). Przy kilku
 * kolizjach pokazuje ich liczbę, a pełny opis niesie `title`. Nazwa rodzaju
 * jest `sr-only` na telefonie, gdzie wiersz jest ciasny — ikona zostaje.
 */
export function CollisionBadge({ collisions, className }: { collisions: MatchCollision[]; className?: string }) {
  if (collisions.length === 0) return null

  const title = collisions.map((collision) => collision.title ?? collisionLabel(collision.type)).join('\n')
  const types = [...new Set(collisions.map((collision) => collision.type))]
  const label = types.length === 1 ? collisionLabel(types[0]!) : `Kolizje (${collisions.length})`

  return (
    <Badge variant="destructive" title={title} className={className}>
      <AlertTriangle />
      <span className="sr-only sm:not-sr-only">{label}</span>
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
  /**
   * Gdy podane, wiersz jest przyciskiem otwierającym okno meczu (#176).
   * Bez tego zostaje grupą tylko do odczytu (makieta terminarza).
   */
  onSelect?: () => void
  className?: string
}

/**
 * Wiersz meczu w terminarzu panelu: termin i obiekt | gospodarz | wynik |
 * gość | stan. Z `onSelect` cały wiersz otwiera okno meczu (#176); makieta
 * terminarza zostawia go tylko do odczytu.
 */
export function MatchRow({ match, showDate = true, timeZone, onSelect, className }: MatchRowProps) {
  const home = teamName(match.homeTeam)
  const away = teamName(match.awayTeam)
  const label = `${home} – ${away}`

  const content = (
    <>
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
      {/* Stały slot kolizji przed stanem (#175): miejsce rezerwuje pusty
          wrapper, więc plakietka nie przesuwa kolumny wyniku. */}
      <span className="col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 sm:col-span-2 sm:col-start-5">
        <span className="flex shrink-0 justify-end sm:w-[6.5rem]">
          <CollisionBadge collisions={match.collisions ?? []} />
        </span>
        <span className="flex shrink-0 justify-end sm:w-[6.5rem]">
          <MatchStatusBadge status={match.status} />
        </span>
      </span>
    </>
  )

  const grid = cn(ROW_GRID, 'items-center rounded-xl border bg-card px-3 py-2.5 text-sm', className)

  if (onSelect) {
    return (
      <button
        type="button"
        data-slot="match-row"
        aria-label={label}
        onClick={onSelect}
        className={cn(
          grid,
          'w-full text-left transition-colors hover:border-ring/50 hover:bg-muted/40',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <div data-slot="match-row" role="group" aria-label={label} className={grid}>
      {content}
    </div>
  )
}
