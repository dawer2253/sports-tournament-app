import { cn } from '../../lib/utils'
import { formatEventMinute, type EventTypeOption, type MatchEventRow } from './match-event-data'

export interface MatchTimelineProps {
  /** Zdarzenia w kolejności z API: minuta rosnąco, bez minuty na końcu (#188, reguła 10). */
  events: MatchEventRow[]
  /** Gospodarz idzie z lewej, gość z prawej. */
  homeTeamId: number
  /** Typy sportu — po nich oś wie, które zdarzenie nie wlicza się do klasyfikacji. */
  types: EventTypeOption[]
  /** Klik w zdarzenie; bez tego oś jest tylko do odczytu. */
  onSelect?: (event: MatchEventRow) => void
  className?: string
}

/**
 * Oś meczu jak w relacji (#191): gospodarz z lewej, gość z prawej, minuta
 * pośrodku. Kolejność bierze z wejścia — porządek ustala API, a oś go nie
 * powtarza. Zdarzenie typu z `stat: null` (samobój) ma dopisek, że nie wlicza
 * się do klasyfikacji: należy do drużyny strzelca, a bramkę daje przeciwnikowi.
 */
export function MatchTimeline({ events, homeTeamId, types, onSelect, className }: MatchTimelineProps) {
  if (events.length === 0) {
    return <p className={cn('py-3 text-center text-sm text-muted-foreground', className)}>Brak zdarzeń.</p>
  }

  const outsideStats = new Set(types.filter((type) => type.stat === null).map((type) => type.code))

  return (
    <ol aria-label="Oś meczu" className={cn('grid gap-0.5', className)}>
      {events.map((event) => {
        const home = event.team.id === homeTeamId
        const who = event.player?.name ?? event.team.name
        const minute = formatEventMinute(event.minute)
        const note = outsideStats.has(event.type) ? ' (nie wlicza się do klasyfikacji)' : ''
        const content = (
          <>
            <span className="font-medium">{event.typeLabel}</span>
            <span className="text-muted-foreground"> · </span>
            {who}
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
          </>
        )
        const cellClass = cn('min-w-0 truncate rounded px-1.5 py-0.5 text-sm', home ? 'text-right' : 'text-left')

        const cell = onSelect ? (
          <button
            type="button"
            aria-label={`Edytuj: ${minute} ${event.typeLabel}, ${who} (${event.team.name})`}
            onClick={() => onSelect(event)}
            className={cn(cellClass, 'hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring')}
          >
            {content}
          </button>
        ) : (
          <span className={cellClass}>{content}</span>
        )

        return (
          <li key={event.id} className="grid grid-cols-[1fr_3rem_1fr] items-center">
            {home ? cell : <span />}
            <span className="text-center text-xs text-muted-foreground tabular-nums">{minute}</span>
            {home ? <span /> : cell}
          </li>
        )
      })}
    </ol>
  )
}
