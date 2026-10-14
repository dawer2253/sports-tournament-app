import { Check } from 'lucide-react'
import {
  bracketChampion,
  bracketFinal,
  bracketRoundSummaries,
  bracketTeamsInPlay,
  currentRoundOrder,
  type BracketMatch,
} from '../../lib/bracket'
import { cn } from '../../lib/utils'
import { BracketChampion } from './bracket-match-row'
import { BracketMatchTile } from './bracket-match-tile'

export interface BracketSummaryProps<M extends BracketMatch> {
  /** Komplet meczów fazy `knockout`; pusty, dopóki drabinki nie ma. */
  matches: readonly M[]
  /** Sport z remisem: pole wyniku finału ma miejsce na karne. */
  penaltySlot: boolean
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu (#210) dla kafla finału. */
  matchHref?: (match: M) => string
  onMatchNavigate?: (match: M) => void
}

/**
 * Treść karty „Drabinka” na Przeglądzie pucharu (#218, ustalenie 5), w miejscu
 * skrótu tabeli: rundy z paskiem postępu i liczbą rozegranych, bieżąca runda
 * wyróżniona (z kropką, gdy coś w niej trwa) i zdanie „W grze 13 z 128
 * drużyn”. Po finale zamiast zdania stoją mistrz i kafel finału z wynikiem.
 * Bieżąca runda to ta sama, od której startuje okno Drabinki.
 */
export function BracketSummary<M extends BracketMatch>({ matches, penaltySlot, timeZone, matchHref, onMatchNavigate }: BracketSummaryProps<M>) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">Drabinka pojawi się tu, gdy organizator ją ułoży.</p>
  }

  const champion = bracketChampion(matches)
  const final = bracketFinal(matches)
  const current = currentRoundOrder(matches)
  const { inPlay, total } = bracketTeamsInPlay(matches)

  return (
    <div className="space-y-4">
      {champion && final ? (
        <div className="space-y-2">
          <BracketChampion team={champion} />
          <BracketMatchTile
            match={final}
            label="Finał"
            penaltySlot={penaltySlot}
            timeZone={timeZone}
            href={matchHref?.(final)}
            onNavigate={onMatchNavigate && (() => onMatchNavigate(final))}
          />
        </div>
      ) : (
        <p className="text-sm">
          W grze {inPlay} z {total} drużyn
        </p>
      )}
      <ol aria-label="Rundy drabinki" className="space-y-1.5">
        {bracketRoundSummaries(matches).map((round) => {
          const isCurrent = round.order === current
          const done = round.finished === round.total
          return (
            <li
              key={round.id}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm',
                !isCurrent && 'text-muted-foreground',
              )}
            >
              <span className={cn('flex min-w-0 items-center gap-1.5', isCurrent && 'font-semibold text-foreground')}>
                <span className="truncate">{round.name}</span>
                {isCurrent && round.live && (
                  <>
                    <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-destructive" />
                    <span className="sr-only">, trwa mecz</span>
                  </>
                )}
              </span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn('block h-full rounded-full', done ? 'bg-foreground/40' : 'bg-primary')}
                  style={{ width: `${(round.finished / round.total) * 100}%` }}
                />
              </span>
              <span className="flex items-center justify-end gap-1 text-xs tabular-nums">
                {done && <Check aria-hidden className="size-3" />}
                {round.finished}/{round.total}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
