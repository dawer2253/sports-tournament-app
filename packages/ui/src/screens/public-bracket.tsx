import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PublicShell } from '@/components/layout/public-shell'
import { bracket, bracketWinner } from '@/lib/demo-data'
import type { BracketMatch, Team } from '@/lib/demo-data'

function TeamRow({
  team,
  score,
  isWinner,
  border,
}: {
  team: Team | null
  score: number | null
  isWinner: boolean
  border: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        border && 'border-b',
        isWinner ? 'font-medium' : 'text-muted-foreground',
      )}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold text-foreground">
        {team?.abbr ?? '?'}
      </span>
      <span className="min-w-0 flex-1 truncate">{team?.name ?? 'Do ustalenia'}</span>
      <span className="tabular-nums">{score ?? '–'}</span>
    </div>
  )
}

function MatchCard({ match, final }: { match: BracketMatch; final?: boolean }) {
  return (
    <div
      className={cn(
        'w-56 overflow-hidden rounded-lg border text-sm',
        final && 'ring-2 ring-primary',
      )}
    >
      <TeamRow team={match.home} score={match.homeScore} isWinner={match.winner === 'home'} border />
      <TeamRow team={match.away} score={match.awayScore} isWinner={match.winner === 'away'} border={false} />
    </div>
  )
}

export function PublicBracket() {
  return (
    <PublicShell active="bracket">
      <div className="flex gap-8 overflow-x-auto pb-4">
        {bracket.map((round) => {
          const final = round.name === 'Finał'
          return (
            <div key={round.name} className="flex flex-col justify-center gap-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {round.name}
              </h2>
              {round.matches.map((match, i) => (
                <MatchCard key={i} match={match} final={final} />
              ))}
            </div>
          )
        })}

        <div className="flex flex-col justify-center gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Zwycięzca
          </h2>
          <div className="w-56 rounded-xl bg-brand px-5 py-8 text-center text-brand-foreground">
            <Trophy className="mx-auto mb-3 size-8" />
            <p className="text-lg font-bold">{bracketWinner.name}</p>
            <p className="mt-1 text-sm text-brand-foreground/80">Mistrz 2026</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Faza pucharowa rozgrywana systemem jednomeczowym. Wyniki tylko do odczytu.
      </p>
    </PublicShell>
  )
}
