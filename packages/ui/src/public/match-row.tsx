import type { MatchRowData } from '../components/data/match-row-data'
import { bracketLoserSide } from '../lib/bracket'
import { formatKickoff, formatShortDay } from '../lib/kickoff'
import { cn } from '../lib/utils'
import { Anchor } from './anchor'
import { Crest } from './crest'
import { LiveBadge, LiveClock } from './live'
import { sideName, teamOf, type Side } from './match-sides'
import { ScoreCell } from './score-cell'

/** Lista, w której stoi wiersz: Terminarz pokazuje godzinę, Wyniki krótki dzień. */
export type MatchListMode = 'fixtures' | 'results'

function scoreOf(match: MatchRowData, side: Side) {
  return side === 'home' ? match.homeScore : match.awayScore
}

function penaltiesOf(match: MatchRowData, side: Side) {
  return (side === 'home' ? match.homePenalties : match.awayPenalties) ?? null
}

/** Przegrany meczu zakończonego, także po karnych: jego strona jest przygaszona. */
function lostMatch(match: MatchRowData, side: Side): boolean {
  return bracketLoserSide(match) === side
}

/**
 * Drużyna w wierszu: herb, nazwa i karne w nawiasie, z „w karnych” dla
 * czytnika. Na telefonie od lewej, w szerokim układzie gospodarz od prawej
 * (herb przy wyniku). Nazwa łamie się na drugą linię zamiast dostać
 * wielokropek (#239); wielokropek dopiero za drugą linią. Pusty slot
 * pucharu ma podpis kursywą i puste miejsce po herbie, żeby kolumny stały.
 */
function TeamCell({ match, side, className }: { match: MatchRowData; side: Side; className?: string }) {
  const team = teamOf(match, side)
  const penalties = penaltiesOf(match, side)
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2 lg:gap-2.5',
        side === 'home' && 'lg:flex-row-reverse lg:text-right',
        lostMatch(match, side) ? 'text-muted-foreground' : 'font-semibold',
        className,
      )}
    >
      {team ? <Crest name={team.name} logoUrl={team.logoUrl} className="size-5 lg:size-6" /> : <span aria-hidden className="size-5 shrink-0 lg:size-6" />}
      <span
        data-slot="match-team"
        className={cn('line-clamp-2 min-w-0 leading-snug wrap-break-word', !team && 'font-normal text-muted-foreground italic')}
      >
        {sideName(match, side)}
      </span>
      {penalties !== null && (
        <span data-slot="penalties" className="shrink-0 text-sm font-normal text-muted-foreground">
          ({penalties})<span className="sr-only"> w karnych</span>
        </span>
      )}
    </span>
  )
}

/** Termin w kolumnie z lewej: plakietka meczu trwającego, godzina w Terminarzu albo krótki dzień w Wynikach. */
function When({ match, mode, showDay, timeZone }: { match: MatchRowData; mode: MatchListMode; showDay: boolean; timeZone?: string }) {
  // Plakietka nie łamie się, a zegar (#297) stoi pod nią, bo „90+4′” obok
  // plakietki nie mieści się w kolumnie terminu telefonu.
  if (match.status === 'live') {
    return (
      <span className="flex flex-col items-start gap-1">
        <LiveBadge />
        <LiveClock clock={match} className="text-base leading-tight" />
      </span>
    )
  }
  const day = formatShortDay(match.kickoffAt, timeZone)
  if (day === null) return <span className="text-xs leading-tight text-muted-foreground">{formatKickoff(null)}</span>
  if (mode === 'results') return <span className="pub-num text-base whitespace-nowrap text-muted-foreground">{day}</span>
  return (
    <span className="flex flex-col whitespace-nowrap">
      <span className="pub-num text-xl leading-tight">{formatKickoff(match.kickoffAt, { showDate: false, timeZone })}</span>
      {showDay && <span className="text-xs text-muted-foreground">{day}</span>}
    </span>
  )
}

export interface MatchRowProps {
  match: MatchRowData
  mode: MatchListMode
  /** Kolejka rozłożona na kilka dni: w Terminarzu pod godziną stoi dzień. */
  showDay?: boolean
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu. */
  href?: string
  /** Przejęcie kliknięcia przez router; klik z klawiszem modyfikującym zostaje przeglądarce. */
  onNavigate?: () => void
}

/**
 * Wiersz meczu strony publicznej (#288 wariant A, #292) na stałych kolumnach:
 * termin | gospodarz | wynik w dwóch okienkach | gość | pozycja i obiekt.
 * Okienka mają stałą szerokość na trzy cyfry (kosz), więc wynik stoi w tym
 * samym miejscu w każdym wierszu, z karnymi i bez. Na telefonie termin
 * z lewej, obok dwie linie drużyna–wynik, pod nimi pozycja.
 *
 * Jedno drzewo DOM na każdą szerokość (miejsca komórek jawnie w siatce), więc
 * czytnik ekranu i testy widzą każdy napis raz. Bez strzelców: są na stronie
 * meczu (#288). Cały wiersz to jeden odnośnik z nazwą „Gospodarz – Gość”,
 * a pozycja i grupa zostają w jego treści.
 */
export function MatchRow({ match, mode, showDay = false, timeZone, href, onNavigate }: MatchRowProps) {
  const label = match.bracket?.label ?? match.group
  const played = match.status !== 'scheduled'
  const score = (side: Side, row: string) => (
    <ScoreCell
      value={played ? scoreOf(match, side) : null}
      dim={!played || lostMatch(match, side)}
      className={cn('w-12 min-w-0 px-1 text-xl leading-8 lg:text-2xl lg:leading-9', 'col-start-3', row, 'lg:col-auto lg:row-auto')}
    />
  )

  return (
    <Anchor
      href={href}
      onNavigate={onNavigate}
      data-slot="match-row"
      aria-label={`${sideName(match, 'home')} – ${sideName(match, 'away')}`}
      className={cn(
        'grid grid-cols-[5.75rem_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1.5 border-b border-hairline px-3 py-3 transition-colors hover:bg-card/60',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-line',
        'lg:min-h-16 lg:grid-cols-[6.5rem_minmax(0,1fr)_6.25rem_minmax(0,1fr)_8.5rem] lg:gap-x-4 lg:px-4 lg:py-2.5',
        match.status === 'live' && 'bg-destructive/5',
      )}
    >
      <span data-slot="match-when" className="col-start-1 row-span-2 row-start-1 flex self-start pt-0.5 lg:row-span-1 lg:self-center lg:pt-0">
        <When match={match} mode={mode} showDay={showDay} timeZone={timeZone} />
      </span>
      <TeamCell match={match} side="home" className="col-start-2 row-start-1" />
      {/* Na telefonie okienka stoją przy swoich drużynach, w szerokim układzie razem w kolumnie wyniku. */}
      <span data-slot="match-score" className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:justify-center lg:gap-1">
        {score('home', 'row-start-1')}
        {score('away', 'row-start-2')}
      </span>
      <TeamCell match={match} side="away" className="col-start-2 row-start-2 lg:col-start-4 lg:row-start-1" />
      {/* Na telefonie pod drużynami stoi sama pozycja; obiekt dopiero w szerokim układzie. */}
      <span
        className={cn(
          'col-span-2 col-start-2 row-start-3 gap-x-3 text-xs leading-tight text-muted-foreground',
          label ? 'flex' : 'hidden lg:flex',
          'lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:flex-col lg:items-end lg:text-right lg:text-sm',
        )}
      >
        {label && (
          <span data-slot="match-label" className="font-medium text-foreground">
            {label}
          </span>
        )}
        {match.venue && <span className="hidden lg:inline">{match.venue.name}</span>}
      </span>
    </Anchor>
  )
}
