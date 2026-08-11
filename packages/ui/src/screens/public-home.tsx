import { CalendarClock, ChevronRight, MapPin, Radio, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PublicShell } from '@/components/layout/public-shell'
import { PhotoPanel } from '@/components/layout/photo-panel'
import { LiveMarker } from '@/components/layout/live-marker'
import { TeamCrest } from '@/components/layout/team-crest'
import { fixtures, scorers, standings } from '@/lib/demo-data'
import type { Match } from '@/lib/demo-data'
import scorersImg from '@/assets/public/scorers.webp'

const liveMatch = fixtures.find((m) => m.status === 'live')
const scheduled = fixtures.filter((m) => m.status === 'scheduled')
const topStandings = standings.slice(0, 5)
const [leader, ...chasers] = scorers
const topChasers = chasers.slice(0, 3)

/** Wyróżniony mecz na żywo — bohater sekcji na Przeglądzie. */
function FeaturedMatch({ match }: { match: Match }) {
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      {/* Kolejka to kontekst całego meczu, miejsce to jeden z jego faktów —
          różna ranga, więc różne miejsce w układzie, a nie kropka między nimi. */}
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Kolejka {match.round}
      </p>
      <div className="mb-3 flex items-center justify-between gap-2">
        <LiveMarker />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {match.venue}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate font-semibold">{match.home.name}</span>
          <TeamCrest abbr={match.home.abbr} />
        </div>
        <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-2xl font-extrabold tabular-nums shadow-sm">
          <span>{match.homeScore}</span>
          <span className="text-muted-foreground">:</span>
          <span>{match.awayScore}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest abbr={match.away.abbr} />
          <span className="truncate font-semibold">{match.away.name}</span>
        </div>
      </div>
      <Button size="sm" className="mt-3 w-full">
        <Radio className="size-4" />
        Śledź na żywo
      </Button>
    </div>
  )
}

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          <TeamCrest abbr={match.home.abbr} />
          <span className="truncate">{match.home.name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 font-medium">
          <TeamCrest abbr={match.away.abbr} />
          <span className="truncate">{match.away.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 text-right">
        <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          {match.kickoff}
        </span>
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
            {liveMatch && <FeaturedMatch match={liveMatch} />}
            {scheduled.length > 0 ? (
              scheduled.map((m) => <MatchCard key={m.id} match={m} />)
            ) : (
              !liveMatch && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Brak zaplanowanych meczów.
                </p>
              )
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
                <TeamCrest abbr={r.team.abbr} />
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
            <PhotoPanel
              src={scorersImg}
              overlay="strong"
              className="flex items-center justify-between gap-4 rounded-lg p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-xl font-bold drop-shadow-sm">{leader.player}</p>
                <p className="truncate text-sm text-brand-foreground/85 drop-shadow-sm">
                  {leader.team.name}
                </p>
              </div>
              <div className="text-right leading-none">
                <span className="text-4xl font-extrabold tabular-nums drop-shadow-sm">
                  {leader.goals}
                </span>
                <p className="mt-1 text-xs text-brand-foreground/85">goli</p>
              </div>
            </PhotoPanel>
            <div className="flex flex-col gap-1">
              {topChasers.map((s) => (
                <div key={s.pos} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-4 shrink-0 text-center font-semibold tabular-nums text-muted-foreground">
                    {s.pos}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.player}</span>
                  <span className="truncate text-xs text-muted-foreground">{s.team.name}</span>
                  <span className="w-5 shrink-0 text-right font-bold tabular-nums">{s.goals}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  )
}
