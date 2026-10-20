import { AlertTriangle, Check, ChevronRight, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { formatKickoff } from '../../lib/kickoff'
import { formatSets, playedSets } from '../../lib/sets'
import { cn, isModifiedClick } from '../../lib/utils'
import { LiveMarker } from '../layout/live-marker'
import { Badge } from '../ui/badge'
import { PenaltyScore } from './penalties'
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
 * kolumny, odstępy, padding i ramkę; próg `match-row-wide` (42rem = 672 px) zostawia
 * każdej nazwie drużyny przynajmniej 97 px. Granicę 80 px pilnują stories,
 * więc te liczby to uzasadnienie progu, nie źródło prawdy. Kontener jest
 * nazwany (`match-row`), żeby komórki i `CollisionBadge` nie łapały się na
 * cudzy kontener, np. `@container/card-header` w `Card`.
 *
 * Strzelcy (#208) stoją w osobnym rzędzie pod nazwami drużyn, wyrównani do
 * nich, więc długa lista wydłuża wiersz w dół, a wyniku nie przesuwa.
 * W szerokim wierszu lista zajmuje też puste pod terminem (gospodarz) i pod
 * stanem (gość) kolumny, żeby wpis nie zawijał się bez potrzeby.
 *
 * Wiersz fazy `knockout` w sporcie z remisem ma szerszą kolumnę wyniku, bo
 * pole zawsze trzyma miejsce na karne (#234). Szerokość zależy od sportu
 * i fazy, a nie od meczu, więc w jednej rundzie wynik stoi wszędzie tak samo.
 *
 * Nazwa drużyny łamie się na drugą linię, zanim dostanie wielokropek (#239),
 * a wielokropek zostaje dla nazw dłuższych. Nazwy do 20 znaków
 * („Niedźwiedzie Mokotów”) i podpisy pustych slotów („Przegrany: Półfinał 1”)
 * mieszczą się w dwóch liniach od wiersza 319 px, czyli karty Przeglądu na
 * telefonie 375 px. Dlatego w wąskim wierszu odstęp kolumn jest mniejszy,
 * a strzałka odnośnika stoi w linii terminu zamiast w pasie po prawej; pole
 * wyniku się nie zmienia. Wiersz z miejscem na karne przechodzi w szeroki
 * układ dopiero od 48rem (wariant `match-row-wide` w `index.css`): przy 42rem
 * nazwom zostawało ok. 71 px. Granice pilnuje story „Próg układu (puchar)”.
 */
const rowGrid = cva('grid items-center gap-x-2 gap-y-1.5 match-row-wide:gap-x-3 rounded-xl border bg-card px-3 py-2.5 text-sm', {
  variants: {
    penaltySlot: {
      false:
        'grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] match-row-wide:grid-cols-[8rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)_6.5rem_6.5rem]',
      true: 'grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] match-row-wide:grid-cols-[8rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)_6.5rem_6.5rem]',
    },
  },
})

/**
 * Pole wyniku: puste „– : –” z ramką, a z wynikiem pełne, w kolorze stanu
 * „na żywo” przy meczu trwającym. Z miejscem na karne ma trzy kolumny.
 */
const scoreField = cva('w-full rounded-md px-1 py-1 text-center text-sm tabular-nums', {
  variants: {
    state: {
      empty: 'border text-muted-foreground',
      live: 'bg-destructive font-semibold text-destructive-foreground',
      done: 'bg-foreground font-semibold text-background',
    },
    penaltySlot: {
      false: '',
      true: 'grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-baseline gap-x-0.5',
    },
  },
})

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
      <span className="sr-only match-row-wide:not-sr-only">{label}</span>
    </Badge>
  )
}

/**
 * Wynik albo „– : –”. Mecz trwający ma wynik cząstkowy w kolorze stanu
 * „na żywo”, tak jak `LiveMarker`. W fazie `knockout` sportu z remisem pole
 * ma po bokach miejsce na karne, „(4) 1 : 1 (3)”, z pogrubionymi karnymi
 * zwycięzcy (#234).
 */
function Score({ match }: { match: MatchRowData }) {
  const hasScore = match.homeScore !== null && match.awayScore !== null
  const penaltySlot = match.bracket?.penaltySlot ?? false
  const score = hasScore ? `${match.homeScore} : ${match.awayScore}` : '– : –'
  return (
    <span
      data-slot="match-score"
      className={scoreField({ state: !hasScore ? 'empty' : match.status === 'live' ? 'live' : 'done', penaltySlot })}
    >
      {penaltySlot ? (
        <PenaltyScore match={match} score={score} penaltyClassName="text-[11px]" />
      ) : (
        score
      )}
    </span>
  )
}

function teamName(team: MatchRowData['homeTeam'], source?: string) {
  return team?.name ?? source ?? 'Do ustalenia'
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
  const home = teamName(match.homeTeam, match.bracket?.homeSource)
  const away = teamName(match.awayTeam, match.bracket?.awaySource)
  const label = `${home} – ${away}`
  // Pozycja w drabince albo grupa meczu: obie stoją w linii terminu (#268).
  const positionLabel = match.bracket?.label ?? match.group
  // Pole wyniku z miejscem na karne: szersza kolumna wyniku (`rowGrid`)
  // i późniejszy próg szerokiego układu (`data-penalty-slot`).
  const penaltySlot = match.bracket?.penaltySlot ?? false
  const scorers = scorerSides(match)
  const sets = playedSets(match)
  // Pusty slot z podpisem źródła idzie kursywą i drobniej, jak w wierszu
  // drabinki panelu; po stronie gospodarza z oddechem przy polu wyniku,
  // żeby pochylona końcówka nie dochodziła do ramki.
  const sourceName = 'text-xs font-normal italic text-muted-foreground'

  const content = (
    <>
      <div className="col-span-2 col-start-1 row-start-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground match-row-wide:col-span-1 match-row-wide:block">
        {/* W szerokim wierszu komórka jest blokiem, więc etykieta dostaje
            własną linię nad terminem, a w wąskim odstęp daje `gap`. Mecz
            grupy niesie tu nazwę grupy (#268). */}
        {positionLabel && (
          <span data-slot="match-label" className="shrink-0 font-medium text-foreground match-row-wide:block">
            {positionLabel}
          </span>
        )}
        <span className="shrink-0 tabular-nums">{formatKickoff(match.kickoffAt, { showDate, timeZone })}</span>
        {match.venue && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{match.venue.name}</span>
          </span>
        )}
      </div>
      <span
        data-slot="match-team"
        className={cn(
          'col-start-1 row-start-2 line-clamp-2 text-right font-medium wrap-break-word match-row-wide:col-start-2 match-row-wide:row-start-1',
          !match.homeTeam && cn(sourceName, 'pe-1'),
        )}
      >
        {home}
      </span>
      <span className="col-start-2 row-start-2 flex match-row-wide:col-start-3 match-row-wide:row-start-1">
        <Score match={match} />
      </span>
      {/* Sport z setami (#301): wyniki setów pod polem wyniku, set po secie,
          bo w kolumnie wyniku pięć setów w jednej linii się nie mieści. */}
      {sets && (
        <span
          data-slot="match-sets"
          className="col-start-2 row-start-3 flex flex-wrap justify-center gap-x-1.5 text-xs text-muted-foreground tabular-nums match-row-wide:col-start-3 match-row-wide:row-start-2"
        >
          <span className="sr-only">Sety: {formatSets(sets)}</span>
          {sets.map((set, index) => (
            <span key={index} aria-hidden>
              {set.home}:{set.away}
            </span>
          ))}
        </span>
      )}
      <span
        data-slot="match-team"
        className={cn(
          'col-start-3 row-start-2 line-clamp-2 font-medium wrap-break-word match-row-wide:col-start-4 match-row-wide:row-start-1',
          !match.awayTeam && sourceName,
        )}
      >
        {away}
      </span>
      <ScorerList
        lines={scorers.home}
        team={home}
        align="end"
        className="col-start-1 row-start-3 match-row-wide:col-span-2 match-row-wide:row-start-2"
      />
      <ScorerList
        lines={scorers.away}
        team={away}
        className="col-start-3 row-start-3 match-row-wide:col-span-3 match-row-wide:col-start-4 match-row-wide:row-start-2"
      />
      {/* Stały slot kolizji przed stanem (#175): miejsce rezerwuje pusty
          wrapper, więc plakietka nie przesuwa kolumny wyniku. */}
      <span className="col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 match-row-wide:col-span-2 match-row-wide:col-start-5">
        <span className="flex shrink-0 justify-end match-row-wide:w-[6.5rem]">
          <CollisionBadge collisions={match.collisions ?? []} />
        </span>
        <span className="flex shrink-0 justify-end match-row-wide:w-[6.5rem]">
          {statusDisplay === 'badge' ? (
            <MatchStatusBadge status={match.status} />
          ) : (
            match.status === 'live' && <LiveMarker />
          )}
        </span>
        {/* W wąskim wierszu strzałka odnośnika stoi w linii terminu, a nie
            w pasie po prawej, który zabierał nazwom 20 px (#239). */}
        {href !== undefined && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground match-row-wide:hidden" />}
      </span>
    </>
  )

  const grid = rowGrid({ penaltySlot })
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
      // W szerokim wierszu strzałka stoi poza siatką, w marginesie po prawej,
      // więc kolumny i wynik zostają tam, gdzie w wierszu bez odnośnika.
      className={cn(grid, interactive, 'relative match-row-wide:pr-8')}
    >
      {content}
      <ChevronRight
        aria-hidden
        className="absolute top-1/2 right-2 hidden size-4 -translate-y-1/2 text-muted-foreground match-row-wide:block"
      />
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
  return (
    <div className={cn('@container/match-row', className)} data-penalty-slot={penaltySlot || undefined}>
      {row}
    </div>
  )
}
