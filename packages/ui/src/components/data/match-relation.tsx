import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Heading } from '../ui/typography'
import { EventIcon } from './event-icon'
import { formatEventMinute } from './match-event-data'
import type { MatchRelationEvent, MatchRelationPeriod } from './match-page-data'
import type { MatchStatus } from './match-row-data'

/**
 * Powyżej tylu zdarzeń w meczu (w praktyce kosz) części startują zwinięte,
 * a płaska lista pokazuje tylko tyle zdarzeń (#210).
 */
export const RELATION_COLLAPSE_THRESHOLD = 20

/** Kod samobója: dopisek drużyny przy etykiecie typu, jak w prototypie #205. */
const OWN_GOAL = 'own_goal'

/** Polska odmiana po liczebniku: „1 zdarzenie”, „3 zdarzenia”, „6 zdarzeń”. */
function eventsCount(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  if (count === 1) return '1 zdarzenie'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return `${count} zdarzenia`
  return `${count} zdarzeń`
}

/** Grupa relacji: część meczu albo zdarzenia bez minuty na końcu. */
type RelationGroup = {
  key: string
  label: string
  /** Wynik części, np. „2:1”; `null`, gdy go nie ma (grupa „Bez minuty”, niezgodność z wynikiem). */
  score: string | null
  events: MatchRelationEvent[]
}

/**
 * Zdarzenia po częściach w kolejności ekranu. Po meczu chronologicznie, na
 * żywo najnowsze u góry: części i zdarzenia w nich od końca. Zdarzenia bez
 * części idą zawsze na koniec, w grupie „Bez minuty” — także na żywo, bo
 * nie wiadomo, kiedy się wydarzyły.
 */
function relationGroups(events: MatchRelationEvent[], periods: MatchRelationPeriod[], live: boolean): RelationGroup[] {
  const order = <T,>(items: T[]) => (live ? items.toReversed() : items)
  const groups: RelationGroup[] = order(periods).map((period) => ({
    key: String(period.number),
    label: period.label,
    score: period.homeScore === null || period.awayScore === null ? null : `${period.homeScore}:${period.awayScore}`,
    events: order(events.filter((event) => event.period === period.number)),
  }))
  const unassigned = events.filter((event) => event.period === null)
  if (unassigned.length > 0) groups.push({ key: 'none', label: 'Bez minuty', score: null, events: unassigned })
  return groups
}

/**
 * Płaska lista turnieju bez podziału: po meczu w kolejności API, na żywo
 * najnowsze u góry. Zdarzenia bez minuty i tak stoją na końcu.
 */
function flatOrder(events: MatchRelationEvent[], live: boolean): MatchRelationEvent[] {
  if (!live) return events
  return [...events.filter((event) => event.minute !== null).toReversed(), ...events.filter((event) => event.minute === null)]
}

function EventRow({ event, homeTeamId }: { event: MatchRelationEvent; homeTeamId: number | null }) {
  const home = event.team.id === homeTeamId
  return (
    <li data-side={home ? 'home' : 'away'} className="grid grid-cols-[2.75rem_minmax(0,1fr)_3rem] items-center gap-2 py-2">
      <span className="text-xs text-muted-foreground tabular-nums">{formatEventMinute(event.minute)}</span>
      <span className={cn('flex min-w-0 items-center gap-2', !home && 'flex-row-reverse text-right')}>
        <EventIcon type={event.type} />
        <span className={cn('min-w-0 text-sm wrap-break-word hyphens-auto', event.scoreAfter && 'font-semibold')}>
          {event.player?.name ?? event.team.name}
          <span className="block text-xs font-normal text-muted-foreground">
            {event.typeLabel}
            {event.type === OWN_GOAL && ` (${event.team.name})`}
          </span>
        </span>
      </span>
      <span data-slot="score-after" className="text-right text-sm font-bold tabular-nums">
        {event.scoreAfter && `${event.scoreAfter.home}:${event.scoreAfter.away}`}
      </span>
    </li>
  )
}

function EventList({ events, homeTeamId }: { events: MatchRelationEvent[]; homeTeamId: number | null }) {
  return (
    <ol className="divide-y">
      {events.map((event) => (
        <EventRow key={event.id} event={event} homeTeamId={homeTeamId} />
      ))}
    </ol>
  )
}

function GroupBlock({
  group,
  open,
  onToggle,
  homeTeamId,
}: {
  group: RelationGroup
  open: boolean
  onToggle: () => void
  homeTeamId: number | null
}) {
  const panelId = useId()
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="text-sm font-semibold">{group.label}</span>
          {group.score && <span className="text-sm text-muted-foreground tabular-nums">{group.score}</span>}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            {eventsCount(group.events.length)}
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="border-t px-4">
        {open && <EventList events={group.events} homeTeamId={homeTeamId} />}
      </div>
    </section>
  )
}

/** Komunikat w miejscu relacji: mecz bez zdarzeń albo jeszcze nierozpoczęty. */
function Notice({ children }: { children: string }) {
  return <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">{children}</p>
}

export interface MatchRelationProps {
  status: MatchStatus
  /** Gospodarz idzie z lewej, gość z prawej. `null`, gdy miejsce w drabince nie jest rozstrzygnięte. */
  homeTeamId: number | null
  /** Zdarzenia w kolejności z API (#188, reguła 10). */
  events: MatchRelationEvent[]
  /** Części ze zdarzeniami; pusta lista to turniej bez podziału. */
  periods: MatchRelationPeriod[]
  className?: string
}

/**
 * Relacja pod pasem strony meczu (#210, prototyp #205).
 *
 * - Bez części (`periods: []`) jedna płaska lista, bez nagłówków i bez
 *   grupy „Bez minuty”. Ponad `RELATION_COLLAPSE_THRESHOLD` zdarzeń widać
 *   ich tyle (na żywo najnowsze) i przycisk „Pokaż całą relację (n)”.
 * - Z częściami zdarzenia są pogrupowane (`relationGroups`). Nagłówek części
 *   to przycisk z `aria-expanded`: etykieta, wynik części i liczba zdarzeń.
 *   Ponad progiem części startują zwinięte, a na żywo otwarta jest najnowsza;
 *   poniżej wszystkie są otwarte. Wybór kibica zostaje przy odświeżeniu.
 * - Na żywo „Relacja na żywo”, najnowsze u góry; po meczu „Przebieg meczu”.
 * - Wiersz na stałej siatce: minuta | ikona i zawodnik (bez zawodnika
 *   drużyna) z typem pod spodem | wynik po zdarzeniu. Gość ma wiersz
 *   odwrócony, a zdarzenie zmieniające wynik jest pogrubione.
 */
export function MatchRelation({ status, homeTeamId, events, periods, className }: MatchRelationProps) {
  const live = status === 'live'
  const [expanded, setExpanded] = useState(false)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  if (status === 'scheduled') return <Notice>Mecz jeszcze się nie zaczął.</Notice>
  if (events.length === 0) return <Notice>Do tego meczu nie wpisano zdarzeń.</Notice>

  const collapse = events.length > RELATION_COLLAPSE_THRESHOLD
  const title = live ? 'Relacja na żywo' : 'Przebieg meczu'

  let body: ReactNode
  if (periods.length === 0) {
    const ordered = flatOrder(events, live)
    const visible = collapse && !expanded ? ordered.slice(0, RELATION_COLLAPSE_THRESHOLD) : ordered
    body = (
      <div className="rounded-xl border bg-card px-4 shadow-sm">
        <EventList events={visible} homeTeamId={homeTeamId} />
        {visible.length < ordered.length && (
          <div className="border-t py-2 text-center">
            <Button variant="link" size="sm" onClick={() => setExpanded(true)}>
              Pokaż całą relację ({ordered.length})
            </Button>
          </div>
        )}
      </div>
    )
  } else {
    const groups = relationGroups(events, periods, live)
    // Domyślnie: poniżej progu wszystko otwarte, powyżej zwinięte poza
    // najnowszą częścią na żywo. Klik kibica nadpisuje domyślną, więc nowa
    // część w trakcie meczu otwiera się sama, a zwinięta ręcznie zostaje.
    const defaultOpen = (group: RelationGroup, index: number) => !collapse || (live && index === 0 && group.key !== 'none')
    body = groups.map((group, index) => {
      const open = toggled[group.key] ?? defaultOpen(group, index)
      return (
        <GroupBlock
          key={group.key}
          group={group}
          open={open}
          onToggle={() => setToggled((current) => ({ ...current, [group.key]: !open }))}
          homeTeamId={homeTeamId}
        />
      )
    })
  }

  return (
    <section aria-label={title} className={cn('flex flex-col gap-3', className)}>
      <Heading level="section">{title}</Heading>
      {body}
    </section>
  )
}
