import { CalendarClock, MapPin } from 'lucide-react'
import type * as React from 'react'
import fieldPhoto from '../../assets/public/field.webp'
import basketballPhoto from '../../assets/public/hero-basketball.webp'
import { formatKickoff } from '../../lib/kickoff'
import { matchBandScrim, type MatchBandBackdrop } from '../../lib/match-band'
import { cn } from '../../lib/utils'
import { LiveMarker } from '../layout/live-marker'
import { MetaList } from '../layout/meta-list'
import { PhotoPanel } from '../layout/photo-panel'
import type { SportCode } from '../layout/public-shell-tournament'
import { TeamLogo } from '../layout/team-logo'
import type { MatchPageMatch, MatchPageTeam } from './match-page-data'
import { MATCH_STATUS_LABELS } from './match-row-data'
import { scorerSides, type ScorerLine } from './scorer-lines'

/** Zdjęcie pod pasem i jego kadr (`PhotoPanel.focus`). */
type BandPhoto = { src: string; focus: string }

/**
 * Tło pasa per sport. Pas ma ok. 300 px wysokości i ciągnie się przez całą
 * szerokość treści, więc kadr celuje w fakturę nawierzchni, a nie w obiekt,
 * który poszatkowałby się na plaster i stał jasną plamą pod tekstem: piłka
 * bierze dół zdjęcia z samą murawą, z dala od piłki, a kosz dół zdjęcia hero
 * z liniami boiska (#210). Sport bez wpisu ma płaski kolor turnieju, jak hero
 * w `PublicShell`.
 */
const PHOTO_BY_SPORT: Readonly<Record<string, BandPhoto | undefined>> = {
  football: { src: fieldPhoto, focus: '90% 100%' },
  basketball: { src: basketballPhoto, focus: '40% 100%' },
} satisfies Partial<Record<SportCode, BandPhoto>>

export interface MatchHeaderProps {
  match: MatchPageMatch
  /** Kod sportu turnieju: wybiera zdjęcie pod pasem. */
  sport: string
  /**
   * Kolor turnieju (`branding.primaryColor`). Pas bierze go ze zmiennej
   * `--brand` shella, a tu wyznacza kierunek gradientu pod tekstem.
   */
  brandColor: string
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  className?: string
}

/**
 * Atrybut tekstu pasa: część pasa, w której stoi (`top`, `bottom`), a przy
 * wyniku także `large`. Po nim funkcja `play` znajduje każdy tekst i liczy
 * jego kontrast (`matchBandContrast`).
 */
function bandText(region: 'top' | 'bottom', large = false) {
  return { 'data-band-text': region, ...(large && { 'data-band-large': '' }) }
}

function teamName(team: MatchPageTeam | null) {
  return team?.name ?? 'Do ustalenia'
}

function Status({ status }: { status: MatchPageMatch['status'] }) {
  if (status === 'live') {
    // Kolor tekstu pasa zamiast czerwieni stanu: czerwień na zdjęciu pod
    // nakładką marki nie trzymałaby kontrastu.
    return <LiveMarker {...bandText('top')} className="text-sm text-current [&>span]:bg-current" />
  }
  return <span {...bandText('top')}>{MATCH_STATUS_LABELS[status]}</span>
}

function BandTeam({ team }: { team: MatchPageTeam | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamLogo
        logoUrl={team?.logoUrl ?? null}
        name={teamName(team)}
        className="size-12 rounded-full bg-white/15 p-1 ring-1 ring-white/30 sm:size-16"
      />
      <span {...bandText('top')} className="text-sm leading-tight font-bold wrap-break-word hyphens-auto sm:text-lg">
        {teamName(team)}
      </span>
    </div>
  )
}

function BandScorers({ lines, team, side }: { lines: ScorerLine[]; team: string; side: 'home' | 'away' }) {
  return (
    <ul
      aria-label={`Strzelcy: ${team}`}
      className={cn('min-w-0 space-y-1', side === 'home' ? 'col-start-1 text-right' : 'col-start-2 sm:col-start-3')}
    >
      {lines.map((line) => (
        <li key={line.key} {...bandText('bottom')} className="wrap-break-word hyphens-auto">
          {line.name}{' '}
          <span className="font-semibold whitespace-nowrap tabular-nums">
            {line.detail}
            {line.ownGoal && ' (sam.)'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Tło pasa: zdjęcie sportu pod nakładką (`PhotoPanel`) albo płaski kolor turnieju. */
function Band({ sport, className, children }: { sport: string; className?: string; children: React.ReactNode }) {
  const photo = PHOTO_BY_SPORT[sport]
  if (photo) {
    return (
      <PhotoPanel
        src={photo.src}
        focus={photo.focus}
        overlay="band"
        data-backdrop={'photo' satisfies MatchBandBackdrop}
        className={className}
      >
        {children}
      </PhotoPanel>
    )
  }
  return (
    <div data-backdrop={'flat' satisfies MatchBandBackdrop} className={cn('relative isolate overflow-hidden bg-brand text-brand-foreground', className)}>
      {children}
    </div>
  )
}

/**
 * Pas strony meczu (#210, wariant B1 prototypu #205): kolejka i stan, herby
 * z nazwami i duży wynik, strzelcy, a pod kreską termin i obiekt.
 *
 * - Drużyny i wynik stoją na stałej siatce, więc długość nazw ani list
 *   strzelców nie przesuwa wyniku (#162).
 * - Strzelcy bez limitu (#192); format i strony z klocka strzelców #208
 *   (`scorerSides`). Mecz zaplanowany ma „– : –” i nie ma strzelców.
 * - Na telefonie fakty stoją jeden pod drugim, bez kresek, a kolumny
 *   strzelców zajmują całą szerokość.
 * - Każdy tekst ma kontrast ≥ 4.5:1, a wynik ≥ 3:1, wobec najgorszego
 *   piksela zdjęcia: warstwy i rachunek są w `lib/match-band.ts`.
 *
 * Kolor turnieju bierze ze zmiennych `--brand` i `--brand-foreground`, które
 * stawia `PublicShell`.
 */
export function MatchHeader({ match, sport, brandColor, timeZone, className }: MatchHeaderProps) {
  const home = teamName(match.homeTeam)
  const away = teamName(match.awayTeam)
  const scheduled = match.status === 'scheduled'
  const scorers = scorerSides(match, { limit: Infinity })
  const hasScorers = !scheduled && scorers.home.length + scorers.away.length > 0
  const score =
    scheduled || match.homeScore === null || match.awayScore === null ? '– : –' : `${match.homeScore} : ${match.awayScore}`

  return (
    <Band sport={sport} className={cn('rounded-xl px-4 pt-4 pb-5 sm:px-8', className)}>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: matchBandScrim(brandColor) }} />
      <section aria-label={`Mecz: ${home} – ${away}`} data-slot="match-band" className="text-sm">
        <div className="mb-3 flex items-center justify-between gap-2 font-medium">
          <span {...bandText('top')}>{match.round.name}</span>
          <Status status={match.status} />
        </div>

        <div className="grid grid-cols-[1fr_5rem_1fr] items-start gap-3 sm:grid-cols-[1fr_9rem_1fr] sm:gap-6">
          <BandTeam team={match.homeTeam} />
          <p
            {...bandText('top', true)}
            data-slot="match-band-score"
            aria-label={scheduled ? 'Mecz jeszcze się nie zaczął' : `Wynik ${score}`}
            className="pt-2 text-center text-4xl font-extrabold whitespace-nowrap tabular-nums sm:text-6xl"
          >
            {score}
          </p>
          <BandTeam team={match.awayTeam} />
        </div>

        {hasScorers && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-[1fr_9rem_1fr] sm:gap-x-6 sm:text-sm">
            <BandScorers lines={scorers.home} team={home} side="home" />
            <BandScorers lines={scorers.away} team={away} side="away" />
          </div>
        )}

        <MetaList className="mt-5 justify-center gap-y-1 border-t border-current/25 pt-3 max-sm:flex-col max-sm:[&>[data-slot=separator]]:hidden">
          <span {...bandText('bottom')} className="flex items-center gap-1.5">
            <CalendarClock aria-hidden className="size-3.5 shrink-0" />
            {formatKickoff(match.kickoffAt, { timeZone })}
          </span>
          {match.venue && (
            <span {...bandText('bottom')} className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              {match.venue.name}
            </span>
          )}
        </MetaList>
      </section>
    </Band>
  )
}
