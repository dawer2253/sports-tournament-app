import { bracketWinnerSide, type BracketScore } from '../../lib/bracket'
import { cn } from '../../lib/utils'

/**
 * Karne jednej drużyny w nawiasie, „(4)”, w polu wyniku przy jej wyniku
 * (#234): ten sam zapis w kaflu drabinki, w wierszu meczu, w wierszu
 * drabinki panelu i w pasie strony meczu. Karne zwycięzcy są pogrubione.
 * Bez karnych zostaje pusty element, który trzyma miejsce w polu.
 */
export function Penalties({ value, won, className }: { value: number | null | undefined; won: boolean; className?: string }) {
  return (
    <span data-slot="penalties" className={cn('tabular-nums', won ? 'font-bold' : 'font-normal', className)}>
      {value != null && `(${value})`}
    </span>
  )
}

export interface PenaltyScoreProps {
  /** Wynik meczu; karne opcjonalne, bo wiersz ligi ich nie niesie. */
  match: Omit<BracketScore, 'homePenalties' | 'awayPenalties'> & Partial<Pick<BracketScore, 'homePenalties' | 'awayPenalties'>>
  /** Napis wyniku w środku pola, np. „1 : 1” albo „–”. */
  score: string
  /** Wielkość napisu karnych, dobrana do pola. */
  penaltyClassName?: string
}

/**
 * Pole wyniku w jednej linii z karnymi po bokach, „(4) 1 : 1 (3)”: karne
 * gospodarza przy jego wyniku z lewej, gościa z prawej, pogrubione
 * u zwycięzcy. Trzy komórki do siatki pola o stałych kolumnach na karne
 * (`MatchRow`, `BracketMatchRow`), więc wynik stoi w tym samym miejscu
 * w meczu z karnymi i bez.
 */
export function PenaltyScore({ match, score, penaltyClassName }: PenaltyScoreProps) {
  const winner = bracketWinnerSide(match)
  return (
    <>
      <Penalties value={match.homePenalties} won={winner === 'home'} className={cn('text-right', penaltyClassName)} />
      <span>{score}</span>
      <Penalties value={match.awayPenalties} won={winner === 'away'} className={cn('text-left', penaltyClassName)} />
    </>
  )
}
