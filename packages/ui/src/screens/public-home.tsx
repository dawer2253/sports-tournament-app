import { CalendarClock, ChevronRight, MapPin, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PublicShell } from '@/components/layout/public-shell'
import { fixtures, scorers, standings } from '@/lib/demo-data'
import type { Match } from '@/lib/demo-data'

const upcoming: Match[] = fixtures.filter((m) => m.status === 'live' || m.status === 'scheduled')
const topStandings = standings.slice(0, 5)
const [leader, ...chasers] = scorers
const topChasers = chasers.slice(0, 3)

function MatchCard({ match }: { match: Match }) {
  const live = match.status === 'live'
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold">
            {match.home.abbr}
          </span>
          <span className="truncate">{match.home.name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 font-medium">
          <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold">
            {match.away.abbr}
          </span>
          <span className="truncate">{match.away.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 text-right">
        {live ? (
          <Badge variant="destructive">
            <span className="mr-1 size-2 animate-pulse rounded-full bg-destructive" /> Na żywo
          </Badge>
        ) : (
          <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            {match.kickoff}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {match.venue}
        </span>
      </div>
    </div>
  )
}

export function PublicHome() {
  return (
    <PublicShell active="home">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              Najbliższe i trwające mecze
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.length > 0 ? (
              upcoming.map((m) => <MatchCard key={m.id} match={m} />)
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Brak zaplanowanych meczów.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabela (skrót)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {topStandings.map((r) => (
              <div key={r.team.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-4 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">
                  {r.pos}
                </span>
                <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold">
                  {r.team.abbr}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.team.name}</span>
                <span className="shrink-0 font-bold tabular-nums">{r.pts}</span>
              </div>
            ))}
            <Button variant="link" size="sm" className="mt-1 self-start px-0">
              Zobacz pełną tabelę
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-muted-foreground" />
              Król strzelców
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:items-center">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/5 p-4">
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{leader.player}</p>
                <p className="truncate text-sm text-muted-foreground">{leader.team.name}</p>
              </div>
              <div className="text-right leading-none">
                <span className="text-4xl font-extrabold tabular-nums text-primary">
                  {leader.goals}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">goli</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {topChasers.map((s) => (
                <div key={s.pos} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-4 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">
                    {s.pos}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.player}</span>
                  <span className="truncate text-xs text-muted-foreground">{s.team.name}</span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {s.goals}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  )
}
