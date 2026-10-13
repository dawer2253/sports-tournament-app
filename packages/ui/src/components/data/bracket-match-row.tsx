import { Trophy } from 'lucide-react'
import { bracketScoreText, bracketWinnerSide } from '../../lib/bracket'
import { formatKickoff } from '../../lib/kickoff'
import { cn } from '../../lib/utils'
import type { BracketMatchRowData, BracketSlot } from './bracket-match-row-data'
import { MatchStatusBadge } from './match-row'

function SlotName({ slot, outcome, align }: { slot: BracketSlot; outcome: 'won' | 'lost' | null; align: 'start' | 'end' }) {
  return (
    <span
      data-slot="bracket-team"
      className={cn(
        'min-w-0 truncate',
        align === 'end' && 'text-right',
        slot.team ? 'font-medium' : 'text-xs italic text-muted-foreground',
        outcome === 'won' && 'font-semibold',
        outcome === 'lost' && 'font-normal text-muted-foreground',
      )}
    >
      {slot.team?.name ?? slot.source ?? 'Do ustalenia'}
    </span>
  )
}

export interface BracketMatchRowProps {
  match: BracketMatchRowData
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Gdy podane, wiersz jest przyciskiem (okno meczu dokłada #228). */
  onSelect?: () => void
  className?: string
}

/**
 * Wiersz meczu drabinki (#217, ustalenie 3): etykieta pozycji i termin |
 * gospodarz | wynik z karnymi | gość | stan i krawędzie. Zwycięzca jest
 * pogrubiony, przegrany przyciszony; pusty slot mówi, skąd przyjdzie
 * drużyna. Poniżej `sm` etykieta i krawędzie idą w osobnych liniach nad
 * i pod parą.
 */
export function BracketMatchRow({ match, timeZone, onSelect, className }: BracketMatchRowProps) {
  const winner = bracketWinnerSide(match)
  const outcome = (side: 'home' | 'away') => (winner === null ? null : winner === side ? 'won' : 'lost')
  const name = (slot: BracketSlot) => slot.team?.name ?? slot.source ?? 'Do ustalenia'
  const label = `${match.label}: ${name(match.home)} – ${name(match.away)}`

  const grid = cn(
    'grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-3 py-2.5 text-left text-sm',
    'sm:grid-cols-[9rem_minmax(0,1fr)_auto_minmax(0,1fr)_12rem]',
    className,
  )

  const content = (
    <>
      <span className="col-span-3 text-xs text-muted-foreground sm:col-span-1">
        <span className="block font-medium text-foreground">{match.label}</span>{' '}
        <span className="block tabular-nums">{formatKickoff(match.kickoffAt, { timeZone })}</span>
      </span>
      <SlotName slot={match.home} outcome={outcome('home')} align="end" />
      <span
        data-slot="bracket-score"
        className={cn(
          'rounded-md px-2 py-0.5 text-center tabular-nums',
          match.homeScore === null ? 'border text-muted-foreground' : 'bg-muted font-semibold',
        )}
      >
        {bracketScoreText(match)}
      </span>
      <SlotName slot={match.away} outcome={outcome('away')} align="start" />
      <span className="col-span-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground sm:col-span-1 sm:justify-end">
        <MatchStatusBadge status={match.status} />
        {match.winnerTo && <span className="whitespace-nowrap">zwycięzca → {match.winnerTo}</span>}
        {match.loserTo && <span className="whitespace-nowrap">przegrany → {match.loserTo}</span>}
      </span>
    </>
  )

  return onSelect ? (
    <button
      type="button"
      data-slot="bracket-match-row"
      aria-label={label}
      onClick={onSelect}
      className={cn(
        grid,
        'transition-colors hover:border-ring/50 hover:bg-muted/40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {content}
    </button>
  ) : (
    <div data-slot="bracket-match-row" role="group" aria-label={label} className={grid}>
      {content}
    </div>
  )
}

/**
 * Mistrz pod listą rund, gdy finał ma zwycięzcę: karta na akcencie marki,
 * jak w makiecie drabinki.
 */
export function BracketChampion({ team, className }: { team: { name: string }; className?: string }) {
  return (
    <div
      role="status"
      data-slot="bracket-champion"
      className={cn('flex items-center gap-3 rounded-lg bg-brand p-4 text-brand-foreground', className)}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-foreground/15">
        <Trophy aria-hidden className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-bold">{team.name}</div>
        <div className="text-xs text-brand-foreground/80">Zwycięzca pucharu</div>
      </div>
    </div>
  )
}
