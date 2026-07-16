import { Shuffle, RefreshCw, Trophy, AlertTriangle } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { bracket, bracketWinner } from '@/lib/demo-data'
import type { BracketMatch, BracketRound } from '@/lib/demo-data'

function TeamRow({
  name,
  abbr,
  score,
  isWinner,
  border,
}: {
  name: string
  abbr: string
  score: number | null
  isWinner: boolean
  border?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        border && 'border-b',
        isWinner ? 'font-medium' : 'text-muted-foreground',
      )}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold">
        {abbr}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="tabular-nums">{score ?? '–'}</span>
    </div>
  )
}

function MatchCard({ match, isFinal }: { match: BracketMatch; isFinal: boolean }) {
  return (
    <div
      className={cn(
        'cursor-pointer overflow-hidden rounded-lg border text-sm transition-shadow hover:shadow-md',
        isFinal && 'ring-2 ring-primary',
      )}
    >
      <TeamRow
        name={match.home?.name ?? 'Do wyłonienia'}
        abbr={match.home?.abbr ?? '?'}
        score={match.homeScore}
        isWinner={match.winner === 'home'}
        border
      />
      <TeamRow
        name={match.away?.name ?? 'Do wyłonienia'}
        abbr={match.away?.abbr ?? '?'}
        score={match.awayScore}
        isWinner={match.winner === 'away'}
      />
    </div>
  )
}

function RoundColumn({ round }: { round: BracketRound }) {
  const isFinal = round.name === 'Finał'
  return (
    <div className="flex w-56 shrink-0 flex-col justify-center gap-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {round.name}
      </div>
      {round.matches.map((match, i) => (
        <MatchCard key={i} match={match} isFinal={isFinal} />
      ))}
    </div>
  )
}

export function AdminBracket() {
  return (
    <AdminShell
      active="bracket"
      title="Drabinka"
      subtitle="Faza pucharowa · single-elimination"
      actions={
        <>
          <Button variant="outline">
            <Shuffle className="size-4" /> Ustaw rozstawienie
          </Button>
          <Button>
            <RefreshCw className="size-4" /> Generuj drabinkę
          </Button>
        </>
      }
    >
      <div className="flex gap-8 overflow-x-auto pb-4">
        {bracket.map((round) => (
          <RoundColumn key={round.name} round={round} />
        ))}

        <div className="flex w-56 shrink-0 flex-col justify-center gap-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Zwycięzca
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-brand p-4 text-brand-foreground">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/15">
              <Trophy className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold">{bracketWinner.name}</div>
              <div className="text-xs text-brand-foreground/80">Mistrz</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="text-sm">
          <div className="font-medium">Edycja wyniku może wpłynąć na kolejne rundy</div>
          <p className="text-muted-foreground">
            Zmiana wyniku meczu, która zmienia zwycięzcę, wyczyści wszystkie kolejne rundy zależne od
            tego pojedynku (kaskada) i wymaga dodatkowego potwierdzenia.
          </p>
        </div>
      </div>
    </AdminShell>
  )
}
