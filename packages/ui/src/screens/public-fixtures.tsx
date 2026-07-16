import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { PublicShell } from '@/components/layout/public-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fixtures } from '@/lib/demo-data'
import type { Match } from '@/lib/demo-data'

const round = fixtures.length > 0 ? fixtures[0].round : 1
const roundDate = fixtures.length > 0 ? fixtures[0].date : ''

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'finished') return <Badge variant="default">Zakończony</Badge>
  if (status === 'live')
    return (
      <Badge variant="secondary" className="text-destructive">
        <span className="mr-1 size-2 animate-pulse rounded-full bg-destructive" /> Na żywo
      </Badge>
    )
  return <Badge variant="secondary">Zaplanowany</Badge>
}

function ScoreCell({ match }: { match: Match }) {
  if (match.status === 'finished' || match.status === 'live') {
    return (
      <span className="rounded-md bg-foreground px-2.5 py-1 font-bold tabular-nums text-background">
        {match.homeScore} : {match.awayScore}
      </span>
    )
  }
  return (
    <span className="rounded-md border border-border px-2.5 py-1 text-sm font-medium tabular-nums text-muted-foreground">
      {match.kickoff}
    </span>
  )
}

export function PublicFixtures() {
  return (
    <PublicShell active="fixtures">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Poprzednia kolejka">
          <ChevronLeft />
        </Button>
        <span className="text-lg font-semibold">Kolejka {round}</span>
        <Button variant="ghost" size="icon" aria-label="Następna kolejka">
          <ChevronRight />
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">{roundDate}</span>
      </div>

      <div className="divide-y rounded-xl border bg-card shadow-sm">
        {fixtures.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex w-32 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              <span className="tabular-nums">{m.kickoff}</span>
              <span className="truncate">· {m.venue}</span>
            </span>
            <span className="flex-1 text-right font-medium">{m.home.name}</span>
            <span className="flex w-24 shrink-0 justify-center">
              <ScoreCell match={m} />
            </span>
            <span className="flex-1 font-medium">{m.away.name}</span>
            <span className="w-28 shrink-0 text-right">
              <StatusBadge status={m.status} />
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Terminarz kolejki {round}. Godziny mogą ulec zmianie — sprawdzaj aktualizacje przed meczem.
      </p>
    </PublicShell>
  )
}
