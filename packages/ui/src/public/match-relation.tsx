import { useId, useState, type ReactNode } from 'react'
import { EventIcon } from '../components/data/event-icon'
import { formatEventMinute } from '../components/data/match-event-data'
import type { MatchRelationEvent, MatchRelationPeriod } from '../components/data/match-page-data'
import type { MatchStatus } from '../components/data/match-row-data'
import { plural } from '../lib/plural'
import { cn } from '../lib/utils'
import { EmptyBoard } from './board'
import { Button } from './button'
import { Crest } from './crest'

/**
 * Powyżej tylu zdarzeń w meczu (w praktyce kosz) części startują zwinięte,
 * a płaska lista pokazuje tylko tyle zdarzeń (#210).
 */
export const RELATION_COLLAPSE_THRESHOLD = 20

/** Kod samobója: dopisek drużyny przy etykiecie typu. */
const OWN_GOAL = 'own_goal'

const EVENTS = ['zdarzenie', 'zdarzenia', 'zdarzeń'] as const

/** Grupa relacji: część meczu albo zdarzenia bez minuty na końcu. */
type RelationGroup = {
  key: string
  label: string
  /** Wynik części, np. „2:1”; `null` w grupie „Bez minuty” i przy niezgodności z wynikiem. */
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

/**
 * Wiersz relacji: minuta, ikona, herb drużyny, zawodnik (bez zawodnika
 * drużyna) z typem pod spodem i wynik po zdarzeniu w okienku. Zdarzenie
 * zmieniające wynik jest pogrubione.
 */
function EventRow({ event, homeTeamId }: { event: MatchRelationEvent; homeTeamId: number | null }) {
  return (
    <li
      data-side={event.team.id === homeTeamId ? 'home' : 'away'}
      className="grid min-h-14 grid-cols-[3rem_1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline py-2"
    >
      <span className="pub-num text-lg text-muted-foreground">{formatEventMinute(event.minute)}</span>
      <EventIcon type={event.type} />
      <span className="flex min-w-0 items-center gap-3">
        <Crest name={event.team.name} className="size-5" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn('wrap-break-word', event.scoreAfter ? 'font-semibold' : 'font-medium')}>{event.player?.name ?? event.team.name}</span>
          <span className="text-xs text-muted-foreground">
            {event.typeLabel}
            {event.type === OWN_GOAL && ` (${event.team.name})`}
          </span>
        </span>
      </span>
      <span data-slot="score-after" className={cn('min-w-12 rounded-sm px-2 py-1 text-center pub-num text-lg', event.scoreAfter && 'bg-sunken')}>
        {event.scoreAfter && `${event.scoreAfter.home}:${event.scoreAfter.away}`}
      </span>
    </li>
  )
}

function EventList({ events, homeTeamId, id, hidden }: { events: MatchRelationEvent[]; homeTeamId: number | null; id?: string; hidden?: boolean }) {
  return (
    <ol id={id} hidden={hidden}>
      {!hidden && events.map((event) => <EventRow key={event.id} event={event} homeTeamId={homeTeamId} />)}
    </ol>
  )
}

/** Część meczu: nagłówek-przycisk z wynikiem części i liczbą zdarzeń, pod nim zdarzenia. */
function GroupBlock({ group, open, onToggle, homeTeamId }: { group: RelationGroup; open: boolean; onToggle: () => void; homeTeamId: number | null }) {
  const panelId = useId()
  return (
    <div data-slot="relation-group">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-baseline gap-4 border-b-2 border-rule py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line"
        >
          <span className="pub-h3 text-[1.375rem]">{group.label}</span>
          {group.score && <span className="pub-num text-lg text-muted-foreground">{group.score}</span>}
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {group.events.length} {plural(group.events.length, EVENTS)}
            <span aria-hidden className={cn('transition-transform', open && 'rotate-180')}>
              ▾
            </span>
          </span>
        </button>
      </h3>
      <EventList id={panelId} hidden={!open} events={group.events} homeTeamId={homeTeamId} />
    </div>
  )
}

export interface MatchRelationProps {
  status: MatchStatus
  /** Id gospodarza; `null`, gdy miejsce w drabince nie jest rozstrzygnięte. */
  homeTeamId: number | null
  /** Zdarzenia w kolejności z API (#188, reguła 10). */
  events: MatchRelationEvent[]
  /** Części ze zdarzeniami; pusta lista to turniej bez podziału. */
  periods: MatchRelationPeriod[]
  className?: string
}

/**
 * Relacja pod tablicą strony meczu (#295, reguły z #210), jedną kolumną.
 *
 * - Bez części (`periods: []`) jedna płaska lista, bez nagłówków i bez
 *   grupy „Bez minuty”. Ponad `RELATION_COLLAPSE_THRESHOLD` zdarzeń widać
 *   ich tyle (na żywo najnowsze) i „Pokaż całą relację (n)”.
 * - Z częściami nagłówek części to przycisk z `aria-expanded`: etykieta,
 *   wynik części i liczba zdarzeń. Ponad progiem części startują zwinięte,
 *   a na żywo otwarta jest najnowsza; poniżej wszystkie są otwarte. Wybór
 *   kibica zostaje przy odświeżeniu danych.
 * - Na żywo „Relacja na żywo”, najnowsze u góry; po meczu „Przebieg meczu”.
 * - Mecz zaplanowany i mecz bez zdarzeń mają komunikat w miejscu relacji.
 */
export function MatchRelation({ status, homeTeamId, events, periods, className }: MatchRelationProps) {
  const live = status === 'live'
  const titleId = useId()
  const [expanded, setExpanded] = useState(false)
  // Klik kibica nadpisuje domyślną dla danej części. Stan żyje w komponencie,
  // więc odpytywanie (nowe `events`) go nie kasuje.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  if (status === 'scheduled') {
    return (
      <EmptyBoard title="Mecz jeszcze się nie zaczął" className={className}>
        Relacja ruszy, gdy organizator wpisze pierwsze zdarzenie.
      </EmptyBoard>
    )
  }
  if (events.length === 0) {
    return (
      <EmptyBoard title="Brak relacji" className={className}>
        Do tego meczu nie wpisano zdarzeń.
      </EmptyBoard>
    )
  }

  const collapse = events.length > RELATION_COLLAPSE_THRESHOLD
  const title = live ? 'Relacja na żywo' : 'Przebieg meczu'

  let body: ReactNode
  if (periods.length === 0) {
    const ordered = flatOrder(events, live)
    const visible = collapse && !expanded ? ordered.slice(0, RELATION_COLLAPSE_THRESHOLD) : ordered
    body = (
      <>
        <EventList events={visible} homeTeamId={homeTeamId} />
        {visible.length < ordered.length && (
          <Button className="self-center" onClick={() => setExpanded(true)}>
            Pokaż całą relację ({ordered.length})
          </Button>
        )}
      </>
    )
  } else {
    const defaultOpen = (group: RelationGroup, index: number) => !collapse || (live && index === 0 && group.key !== 'none')
    body = relationGroups(events, periods, live).map((group, index) => {
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
    <section aria-labelledby={titleId} data-slot="match-relation" className={cn('flex flex-col gap-4', className)}>
      <h2 id={titleId} className="pub-h2">
        {title}
      </h2>
      {body}
    </section>
  )
}
