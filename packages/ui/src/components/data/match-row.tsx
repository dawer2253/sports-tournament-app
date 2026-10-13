import { AlertTriangle, Check, ChevronRight, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatKickoff } from '../../lib/kickoff'
import { cn, isModifiedClick } from '../../lib/utils'
import { LiveMarker } from '../layout/live-marker'
import { Badge } from '../ui/badge'
import { MATCH_STATUS_LABELS, type MatchCollision, type MatchCollisionType, type MatchRowData } from './match-row-data'
import { scorerSides } from './scorer-lines'
import { ScorerList } from './scorer-list'

/**
 * Jedna siatka dla wszystkich wierszy, żeby kolumny stały równo w całej
 * kolejce. Kolumny po bokach mają stałą szerokość, więc wynik stoi w tym
 * samym miejscu niezależnie od plakietki po prawej i długości nazw (#162,
 * pkt 3). Slot kolizji jest stały i stoi przed stanem (#175), więc plakietka
 * kolizji nie przesuwa kolumny wyniku ani stanu.
 *
 * W wąskim wierszu termin i stan idą w linię nad parą, a wynik dalej siedzi
 * w środkowej kolumnie. Miejsce każdej komórki jest jawne (`col-start`,
 * `row-start`), więc kolejność w DOM — termin, gospodarz, wynik, gość, stan —
 * jest ta sama na każdej szerokości i tak też czyta ją czytnik ekranu.
 *
 * Układ przełącza szerokość samego wiersza (container query), nie okna: w
 * panelu obok terminarza stoją sidebar i lista kolejek, więc przy oknie
 * 1024 px wiersz ma ok. 480 px (#198). Sześć kolumn wymaga 478 px na stałe
 * kolumny, odstępy, padding i ramkę; próg `@2xl` (42rem = 672 px) zostawia
 * każdej nazwie drużyny przynajmniej 97 px. Granicę 80 px pilnują stories,
 * więc te liczby to uzasadnienie progu, nie źródło prawdy. Kontener jest
 * nazwany (`match-row`), żeby komórki i `CollisionBadge` nie łapały się na
 * cudzy kontener, np. `@container/card-header` w `Card`.
 *
 * Strzelcy (#208) stoją w osobnym rzędzie pod nazwami drużyn, wyrównani do
 * nich, więc długa lista wydłuża wiersz w dół, a wyniku nie przesuwa.
 * W szerokim wierszu lista zajmuje też puste pod terminem (gospodarz) i pod
 * stanem (gość) kolumny, żeby wpis nie zawijał się bez potrzeby.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 @2xl/match-row:grid-cols-[8rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)_6.5rem_6.5rem]'

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
 * jest `sr-only` w wąskim wierszu — ikona zostaje. Próg czyta z nazwanego
 * kontenera `match-row` (#198), więc poza `MatchRow` plakietka pokazuje samą
 * ikonę, także wewnątrz innego kontenera.
 */
export function CollisionBadge({ collisions, className }: { collisions: MatchCollision[]; className?: string }) {
  if (collisions.length === 0) return null

  const title = collisions.map((collision) => collision.title ?? collisionLabel(collision.type)).join('\n')
  const types = [...new Set(collisions.map((collision) => collision.type))]
  const label = types.length === 1 ? collisionLabel(types[0]!) : `Kolizje (${collisions.length})`

  return (
    <Badge variant="destructive" title={title} className={className}>
      <AlertTriangle />
      <span className="sr-only @2xl/match-row:not-sr-only">{label}</span>
    </Badge>
  )
}

/**
 * Wynik albo „– : –”. Mecz trwający ma wynik cząstkowy w kolorze stanu
 * „na żywo”, tak jak `LiveMarker`.
 */
function Score({ match }: { match: MatchRowData }) {
  const hasScore = match.homeScore !== null && match.awayScore !== null
  const penalties = match.homePenalties != null && match.awayPenalties != null
  return (
    <span className="flex w-full flex-col items-center gap-0.5">
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
      {/* PROTOTYP (#218): karne pod wynikiem, żeby kolumna wyniku nie rosła. */}
      {penalties && (
        <span className="whitespace-nowrap text-[11px] leading-none text-muted-foreground tabular-nums">
          k. {match.homePenalties}:{match.awayPenalties}
        </span>
      )}
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
  /**
   * Adres strony meczu (#210). Gdy podany, cały wiersz jest jednym
   * odnośnikiem ze strzałką „›”, a `onSelect` nie działa. Strona publiczna
   * prowadzi tak z Terminarza, Wyników i Przeglądu.
   */
  href?: string
  /**
   * Przejęcie kliknięcia w odnośnik, np. przez router — wzorem
   * `navHref`/`onNavigate` w `AdminShell`. Klik z klawiszem modyfikującym
   * (nowa karta) zostaje przeglądarce.
   */
  onNavigate?: () => void
  /**
   * `badge` (panel): stan każdego meczu jako plakietka. `live` (strona
   * publiczna): oznaczony jest tylko mecz trwający, `LiveMarker`-em —
   * „Zaplanowany” przy każdym meczu terminarza nic kibicowi nie mówi,
   * a „Zakończony” powtarza wypełniony wynik.
   */
  statusDisplay?: 'badge' | 'live'
  /** Klasy opakowania wiersza, czyli kontenera, od którego liczy się próg układu. */
  className?: string
}

/**
 * Wiersz meczu w terminarzu panelu: termin i obiekt | gospodarz | wynik |
 * gość | stan. Z `onSelect` cały wiersz otwiera okno meczu (#176), a z `href`
 * prowadzi na stronę meczu (#210); makieta terminarza zostawia go tylko do
 * odczytu.
 */
export function MatchRow({
  match,
  showDate = true,
  timeZone,
  onSelect,
  href,
  onNavigate,
  statusDisplay = 'badge',
  className,
}: MatchRowProps) {
  const home = match.homeTeam ? match.homeTeam.name : (match.homeSource ?? teamName(null))
  const away = match.awayTeam ? match.awayTeam.name : (match.awaySource ?? teamName(null))
  const label = `${home} – ${away}`
  const scorers = scorerSides(match)

  const content = (
    <>
      <div className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground @2xl/match-row:col-span-1 @2xl/match-row:block">
        {match.positionLabel && <span className="shrink-0 font-medium text-foreground">{match.positionLabel}</span>}
        <span className="shrink-0 tabular-nums">{formatKickoff(match.kickoffAt, { showDate, timeZone })}</span>
        {match.venue && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{match.venue.name}</span>
          </span>
        )}
      </div>
      <span data-slot="match-team" className={cn('col-start-1 row-start-2 truncate text-right font-medium @2xl/match-row:col-start-2 @2xl/match-row:row-start-1', !match.homeTeam && 'text-xs font-normal italic text-muted-foreground')}>{home}</span>
      <span className="col-start-2 row-start-2 flex @2xl/match-row:col-start-3 @2xl/match-row:row-start-1">
        <Score match={match} />
      </span>
      <span data-slot="match-team" className={cn('col-start-3 row-start-2 truncate font-medium @2xl/match-row:col-start-4 @2xl/match-row:row-start-1', !match.awayTeam && 'text-xs font-normal italic text-muted-foreground')}>{away}</span>
      <ScorerList
        lines={scorers.home}
        team={home}
        align="end"
        className="col-start-1 row-start-3 @2xl/match-row:col-span-2 @2xl/match-row:row-start-2"
      />
      <ScorerList
        lines={scorers.away}
        team={away}
        className="col-start-3 row-start-3 @2xl/match-row:col-span-3 @2xl/match-row:col-start-4 @2xl/match-row:row-start-2"
      />
      {/* Stały slot kolizji przed stanem (#175): miejsce rezerwuje pusty
          wrapper, więc plakietka nie przesuwa kolumny wyniku. */}
      <span className="col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 @2xl/match-row:col-span-2 @2xl/match-row:col-start-5">
        <span className="flex shrink-0 justify-end @2xl/match-row:w-[6.5rem]">
          <CollisionBadge collisions={match.collisions ?? []} />
        </span>
        <span className="flex shrink-0 justify-end @2xl/match-row:w-[6.5rem]">
          {statusDisplay === 'badge' ? (
            <MatchStatusBadge status={match.status} />
          ) : (
            match.status === 'live' && <LiveMarker />
          )}
        </span>
      </span>
    </>
  )

  const grid = cn(ROW_GRID, 'items-center rounded-xl border bg-card px-3 py-2.5 text-sm')
  const interactive = cn(
    'w-full text-left transition-colors hover:border-ring/50 hover:bg-muted/40',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  )

  const row = href !== undefined ? (
    <a
      href={href}
      data-slot="match-row"
      aria-label={label}
      onClick={(event) => {
        if (!onNavigate || isModifiedClick(event)) return
        event.preventDefault()
        onNavigate()
      }}
      // Strzałka stoi poza siatką, w marginesie po prawej, więc kolumny
      // i wynik zostają tam, gdzie w wierszu bez odnośnika.
      className={cn(grid, interactive, 'relative pr-8')}
    >
      {content}
      <ChevronRight aria-hidden className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
    </a>
  ) : onSelect ? (
    <button
      type="button"
      data-slot="match-row"
      aria-label={label}
      onClick={onSelect}
      className={cn(grid, interactive)}
    >
      {content}
    </button>
  ) : (
    <div data-slot="match-row" role="group" aria-label={label} className={grid}>
      {content}
    </div>
  )

  // Kontener zapytania musi być przodkiem siatki (element nie odpytuje sam
  // siebie), więc wiersz dostaje własne opakowanie i konsument nie musi
  // pamiętać o `@container` (#198). `className` trafia na nie, bo to ono
  // jest najbardziej zewnętrznym elementem i od niego liczy się próg.
  return <div className={cn('@container/match-row', className)}>{row}</div>
}
