import { cva } from 'class-variance-authority'
import { Trophy } from 'lucide-react'
import { bracketWinnerSide } from '../../lib/bracket'
import { formatKickoff } from '../../lib/kickoff'
import { cn } from '../../lib/utils'
import type { BracketMatchRowData, BracketSlot } from './bracket-match-row-data'
import { MatchStatusBadge } from './match-row'
import { PenaltyScore } from './penalties'

/** Pole wyniku: puste z ramką albo wypełnione; w sporcie z remisem o stałej szerokości, z kolumnami na karne. */
const scoreField = cva('rounded-md px-2 py-0.5 text-center tabular-nums', {
  variants: {
    empty: { true: 'border text-muted-foreground', false: 'bg-muted font-semibold' },
    penaltySlot: { true: 'grid w-28 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-baseline gap-x-1', false: '' },
  },
})

function SlotName({ slot, outcome, align }: { slot: BracketSlot; outcome: 'won' | 'lost' | null; align: 'start' | 'end' }) {
  return (
    <span
      data-slot="bracket-team"
      className={cn(
        'line-clamp-2 min-w-0 wrap-break-word',
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
  /** Gdy podane, wiersz jest przyciskiem otwierającym okno meczu (#228). */
  onSelect?: () => void
  /**
   * Sport z remisem (`allowsDraw`): pole wyniku zawsze ma miejsce na karne,
   * więc wynik nie skacze między wierszami rundy (#234). W koszu pole jest
   * węższe, bez miejsca na karne.
   */
  penaltySlot?: boolean
  /** Klasy opakowania wiersza, czyli kontenera, od którego liczy się próg układu. */
  className?: string
}

/**
 * Wiersz meczu drabinki (#217, ustalenie 3): etykieta pozycji i termin |
 * gospodarz | wynik z karnymi | gość | stan i krawędzie. Zwycięzca jest
 * pogrubiony, przegrany przyciszony; pusty slot mówi, skąd przyjdzie
 * drużyna. Karne stoją w polu wyniku, w nawiasie przy wyniku każdej
 * drużyny, „(4) 1:1 (3)”, jak w drabince strony publicznej (#234).
 *
 * Układ przełącza szerokość samego wiersza (container query), nie okna, jak
 * `MatchRow` (#198): przy oknie ok. 800 px wiersz obok sidebaru ma ok.
 * 510 px, a pięć kolumn wymaga 522 px na stałe kolumny, odstępy, padding
 * i ramkę, więc nazwom nie zostawało nic (#239). Poniżej progu `@3xl`
 * (48rem = 768 px, nazwom zostaje po ok. 120 px) etykieta i krawędzie idą
 * w osobnych liniach nad i pod parą, a odstęp kolumn jest mniejszy, żeby na
 * telefonie 375 px najdłuższe słowo nazwy z DoD („Niedźwiedzie”, pogrubione
 * u zwycięzcy) mieściło się w linii. Nazwa łamie się na drugą linię, zanim
 * dostanie wielokropek; granice pilnuje story „Próg układu”.
 */
export function BracketMatchRow({ match, timeZone, onSelect, penaltySlot = false, className }: BracketMatchRowProps) {
  const winner = bracketWinnerSide(match)
  const outcome = (side: 'home' | 'away') => (winner === null ? null : winner === side ? 'won' : 'lost')
  const name = (slot: BracketSlot) => slot.team?.name ?? slot.source ?? 'Do ustalenia'
  const label = `${match.label}: ${name(match.home)} – ${name(match.away)}`
  const score = match.homeScore === null || match.awayScore === null ? '–' : `${match.homeScore}:${match.awayScore}`

  const grid = cn(
    'grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-xl border bg-card px-3 py-2.5 text-left text-sm',
    '@3xl/bracket-row:grid-cols-[9rem_minmax(0,1fr)_auto_minmax(0,1fr)_12rem] @3xl/bracket-row:gap-x-3',
  )

  const content = (
    <>
      <span className="col-span-3 text-xs text-muted-foreground @3xl/bracket-row:col-span-1">
        <span className="block font-medium text-foreground">{match.label}</span>{' '}
        <span className="block tabular-nums">{formatKickoff(match.kickoffAt, { timeZone })}</span>
      </span>
      <SlotName slot={match.home} outcome={outcome('home')} align="end" />
      <span
        data-slot="bracket-score"
        className={scoreField({ empty: match.homeScore === null, penaltySlot })}
      >
        {penaltySlot ? (
          <PenaltyScore match={match} score={score} penaltyClassName="text-xs" />
        ) : (
          score
        )}
      </span>
      <SlotName slot={match.away} outcome={outcome('away')} align="start" />
      <span className="col-span-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground @3xl/bracket-row:col-span-1 @3xl/bracket-row:justify-end">
        <MatchStatusBadge status={match.status} />
        {match.winnerTo && <span className="whitespace-nowrap">zwycięzca → {match.winnerTo}</span>}
        {match.loserTo && <span className="whitespace-nowrap">przegrany → {match.loserTo}</span>}
      </span>
    </>
  )

  const row = onSelect ? (
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

  // Kontener zapytania musi być przodkiem siatki, więc wiersz ma własne
  // opakowanie, a `className` trafia na nie: od niego liczy się próg.
  return <div className={cn('@container/bracket-row', className)}>{row}</div>
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
