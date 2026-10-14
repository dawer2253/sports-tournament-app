import { cva } from 'class-variance-authority'
import { Trophy } from 'lucide-react'
import type * as React from 'react'
import { bracketWinnerSide, type BracketMatch, type BracketTeam } from '../../lib/bracket'
import { formatKickoffParts } from '../../lib/kickoff'
import { cn, isModifiedClick } from '../../lib/utils'
import { Penalties } from './penalties'

/** Wysokość kafla w drzewie; pozycje i łączniki liczą się od niej. */
export const BRACKET_TILE_HEIGHT = 52

/** Pusty slot: skąd przyjdzie drużyna, pokazują łączniki drzewa. */
const EMPTY_SLOT = 'Do ustalenia'

/**
 * Szare pole wyniku: w sporcie z remisem zawsze z miejscem na karne, więc
 * tej samej szerokości w każdym kaflu, a w koszu węższe.
 */
const scoreField = cva('flex shrink-0 flex-col justify-center border-l bg-muted/40 px-1.5 tabular-nums', {
  variants: { penaltySlot: { true: 'w-14', false: 'w-11' } },
})

/** Linia wyniku jednej drużyny: kolumna karnych i kolumna wyniku albo sam wynik. */
const scoreLine = cva('grid h-5 items-center justify-end gap-0.5 leading-5', {
  variants: { penaltySlot: { true: 'grid-cols-[1.375rem_1.25rem]', false: 'grid-cols-[1.75rem]' } },
})

type Outcome = 'won' | 'lost' | null

/**
 * Linia drużyny. Wysokość linii mieści dolne wydłużenia liter („y”, „ę”),
 * które `truncate` przy `leading-none` obcinał, a liczba pikseli jest
 * całkowita, więc nazwa nie jest ucięta w pionie (#218, „Nie sprawdzone”).
 */
function TeamLine({ team, outcome }: { team: BracketTeam | null; outcome: Outcome }) {
  return (
    <span
      data-slot="bracket-tile-team"
      className={cn(
        'block h-5 truncate leading-5',
        !team && 'text-[11px] italic text-muted-foreground',
        outcome === 'won' && 'font-semibold',
        outcome === 'lost' && 'text-muted-foreground',
      )}
    >
      {team?.name ?? EMPTY_SLOT}
    </span>
  )
}

/**
 * Wynik jednej drużyny: karne w nawiasie przed wynikiem, każde w swojej
 * kolumnie, więc wynik stoi zawsze w tym samym miejscu. Zwycięzca ma
 * pogrubiony wynik i karne.
 */
function ScoreLine({
  score,
  penalties,
  penaltySlot,
  outcome,
  live,
}: {
  score: number | null
  penalties: number | null
  penaltySlot: boolean
  outcome: Outcome
  live: boolean
}) {
  return (
    <span
      className={scoreLine({ penaltySlot })}
    >
      {penaltySlot && (
        <Penalties
          value={penalties}
          won={outcome === 'won'}
          className={cn('text-right text-[11px]', outcome === 'won' ? 'text-foreground' : 'text-muted-foreground')}
        />
      )}
      <span
        className={cn(
          'text-right',
          outcome === 'won' && 'font-semibold',
          outcome === 'lost' && 'text-muted-foreground',
          live && 'font-medium text-destructive',
        )}
      >
        {score ?? '–'}
      </span>
    </span>
  )
}

export interface BracketMatchTileProps {
  match: BracketMatch
  /** Etykieta pozycji do nazwy odnośnika: „Półfinał 1”, „Mecz o 3. miejsce”. */
  label: string
  /**
   * Sport z remisem: pole ma zawsze miejsce na karne, więc jest tej samej
   * szerokości w każdym kaflu. W koszu (bez remisów) jest węższe.
   */
  penaltySlot: boolean
  /** Adres strony meczu (#210); bez niego kafel jest tylko do odczytu. */
  href?: string
  /** Przejęcie kliknięcia, np. przez router. Klik z klawiszem modyfikującym zostaje przeglądarce. */
  onNavigate?: () => void
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Kafel meczu drabinki (#218, ustalenie 2): dwie linie, drużyna na linię,
 * a po prawej szare pole stałej szerokości z wynikiem każdej drużyny.
 * Zwycięzca pogrubiony, przegrany szary. Karne stoją w polu, w nawiasie
 * przed wynikiem, „(4) 1”. Mecz zaplanowany ma w polu datę i godzinę, mecz
 * trwający czerwoną belkę z lewej i wynik w kolorze stanu, bez pogrubienia,
 * bo awansuje się dopiero przy `finished` (#216). Pusty slot to „Do
 * ustalenia”: skąd przyjdzie drużyna, pokazują łączniki drzewa.
 *
 * Z `href` cały kafel jest odnośnikiem na stronę meczu, jak `MatchRow`.
 */
export function BracketMatchTile({ match, label, penaltySlot, href, onNavigate, timeZone, className, style }: BracketMatchTileProps) {
  const winner = bracketWinnerSide(match)
  const outcome = (side: 'home' | 'away'): Outcome => (winner === null ? null : winner === side ? 'won' : 'lost')
  const live = match.status === 'live'
  const kickoff = formatKickoffParts(match.kickoffAt, timeZone)
  const name = `${label}: ${match.homeTeam?.name ?? EMPTY_SLOT} – ${match.awayTeam?.name ?? EMPTY_SLOT}`

  const content = (
    <>
      {live && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-destructive" />}
      <span className="flex min-w-0 flex-col justify-center py-1 pr-1 pl-2.5">
        <TeamLine team={match.homeTeam} outcome={outcome('home')} />
        <TeamLine team={match.awayTeam} outcome={outcome('away')} />
      </span>
      <span
        data-slot="bracket-tile-score"
        className={scoreField({ penaltySlot })}
      >
        {match.status === 'scheduled' ? (
          <span className="flex flex-col items-end text-[11px] leading-4 text-muted-foreground">
            <span>{kickoff?.day ?? '–'}</span>
            <span className="font-medium text-foreground">{kickoff?.time ?? ''}</span>
          </span>
        ) : (
          <>
            <ScoreLine score={match.homeScore} penalties={match.homePenalties} penaltySlot={penaltySlot} outcome={outcome('home')} live={live} />
            <ScoreLine score={match.awayScore} penalties={match.awayPenalties} penaltySlot={penaltySlot} outcome={outcome('away')} live={live} />
          </>
        )}
      </span>
    </>
  )

  const tile = cn(
    'relative grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-[13px]',
    live && 'border-destructive/70',
    className,
  )
  const tileStyle = { height: BRACKET_TILE_HEIGHT, ...style }

  if (href === undefined) {
    return (
      <div data-slot="bracket-tile" data-match-id={match.id} role="group" aria-label={name} className={tile} style={tileStyle}>
        {content}
      </div>
    )
  }

  return (
    <a
      href={href}
      data-slot="bracket-tile"
      data-match-id={match.id}
      aria-label={name}
      onClick={(event) => {
        if (!onNavigate || isModifiedClick(event)) return
        event.preventDefault()
        onNavigate()
      }}
      className={cn(
        tile,
        'transition-colors hover:border-ring/60 hover:bg-muted/40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
      style={tileStyle}
    >
      {content}
    </a>
  )
}

/**
 * Wolny los (#215): przerywany kafel z nazwą drużyny w miejscu meczu
 * 1. rundy, którego nie ma. Drużyna stoi od razu w 2. rundzie.
 */
export function BracketByeTile({ team, className, style }: { team: BracketTeam; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      data-slot="bracket-bye"
      role="group"
      aria-label={`Wolny los: ${team.name}`}
      className={cn('flex flex-col justify-center rounded-lg border border-dashed px-2.5 text-[13px] text-muted-foreground', className)}
      style={{ height: BRACKET_TILE_HEIGHT, ...style }}
    >
      <span className="block h-5 truncate leading-5">{team.name}</span>
      <span className="block h-5 text-[11px] leading-5 italic">wolny los</span>
    </div>
  )
}

/** Mistrz pod finałem w drzewie: karta na akcencie marki, wysoka jak kafel. */
export function BracketChampionTile({ team, className, style }: { team: BracketTeam; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      role="status"
      data-slot="bracket-champion"
      className={cn('flex items-center gap-2.5 rounded-lg bg-brand px-2.5 text-brand-foreground', className)}
      style={{ height: BRACKET_TILE_HEIGHT, ...style }}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-foreground/15">
        <Trophy aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block h-5 truncate text-sm leading-5 font-bold">{team.name}</span>
        <span className="block text-[11px] leading-4 text-brand-foreground/80">Zwycięzca pucharu</span>
      </span>
    </div>
  )
}
