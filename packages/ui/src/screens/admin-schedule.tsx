import {
  SlidersHorizontal, RefreshCw, ChevronLeft, ChevronRight, Clock, Check, AlertTriangle,
} from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { tournament, fixtures, standings, scorers } from '@/lib/demo-data'
import type { Match } from '@/lib/demo-data'

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'finished') {
    return (
      <Badge variant="default"><Check /> Zakończony</Badge>
    )
  }
  if (status === 'live') {
    return (
      <Badge variant="destructive">
        <span className="size-1.5 animate-pulse rounded-full bg-destructive" /> Na żywo
      </Badge>
    )
  }
  return <Badge variant="secondary">Zaplanowany</Badge>
}

function MatchRow({ match }: { match: Match }) {
  const played = match.status === 'finished' || match.status === 'live'
  return (
    <div
      className={
        'flex items-center gap-3 rounded-lg px-3 py-3 ' +
        (match.collision ? 'bg-destructive/5' : '')
      }
    >
      <div className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        <span className="tabular-nums">{match.kickoff}</span>
        <span className="truncate">· {match.venue}</span>
      </div>

      <div className="flex-1 text-right font-medium">{match.home.name}</div>

      <div className="shrink-0">
        {played ? (
          <span className="rounded-md bg-foreground px-2.5 py-1 text-sm font-semibold tabular-nums text-background">
            {match.homeScore} : {match.awayScore}
          </span>
        ) : (
          <span className="rounded-md border px-2.5 py-1 text-sm tabular-nums text-muted-foreground">
            – : –
          </span>
        )}
      </div>

      <div className="flex-1 font-medium">{match.away.name}</div>

      <div className="flex shrink-0 items-center gap-2">
        {match.collision && (
          <Badge variant="destructive"><AlertTriangle /> Kolizja boiska</Badge>
        )}
        <StatusBadge status={match.status} />
        {match.status === 'scheduled' ? (
          <Button size="sm" variant="outline">Wpisz wynik</Button>
        ) : (
          <Button size="sm">Edytuj</Button>
        )}
      </div>
    </div>
  )
}

export function AdminSchedule() {
  const roundFixtures = fixtures.filter((m) => m.round === tournament.currentRound)
  const roundDate = roundFixtures[0]?.date ?? ''

  return (
    <AdminShell
      active="schedule"
      title={tournament.name}
      subtitle={`${tournament.teamsCount} drużyn · ${tournament.rounds} kolejek · ${tournament.sport}`}
      actions={
        <>
          <Button variant="outline"><SlidersHorizontal className="size-4" /> Tiebreaki</Button>
          <Button><RefreshCw className="size-4" /> Generuj terminarz</Button>
        </>
      }
    >
      <Tabs defaultValue="terminarz">
        <TabsList>
          <TabsTrigger value="terminarz">Terminarz</TabsTrigger>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="strzelcy">Strzelcy</TabsTrigger>
        </TabsList>

        <TabsContent value="terminarz" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon"><ChevronLeft className="size-4" /></Button>
            <span className="text-sm font-medium">Kolejka {tournament.currentRound}</span>
            <Button variant="ghost" size="icon"><ChevronRight className="size-4" /></Button>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{roundDate}</span>
          </div>

          <Card>
            <CardContent className="divide-y">
              {roundFixtures.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tabela" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Klasyfikacja liczona na podstawie rozegranych meczów. Pełny widok w zakładce Statystyki.
          </p>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Drużyna</TableHead>
                  <TableHead className="w-10 text-center">M</TableHead>
                  <TableHead className="w-10 text-center">W</TableHead>
                  <TableHead className="w-10 text-center">R</TableHead>
                  <TableHead className="w-10 text-center">P</TableHead>
                  <TableHead className="w-16 text-center">Bramki</TableHead>
                  <TableHead className="w-12 text-center !text-foreground">Pkt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((r) => (
                  <TableRow key={r.team.id} className={r.pos === 1 ? 'bg-primary/5' : ''}>
                    <TableCell className="font-semibold">{r.pos}</TableCell>
                    <TableCell className="font-medium">{r.team.name}</TableCell>
                    <TableCell className="text-center">{r.p}</TableCell>
                    <TableCell className="text-center">{r.w}</TableCell>
                    <TableCell className="text-center">{r.d}</TableCell>
                    <TableCell className="text-center">{r.l}</TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {r.gf}:{r.ga}
                    </TableCell>
                    <TableCell className="text-center font-bold">{r.pts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="strzelcy" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Najlepsi strzelcy turnieju według liczby zdobytych bramek.
          </p>
          <Card>
            <CardContent className="divide-y">
              {scorers.map((s) => (
                <div key={s.pos} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold">
                    {s.pos}
                  </span>
                  <span className="font-medium">{s.player}</span>
                  <span className="text-sm text-muted-foreground">{s.team.name}</span>
                  <Badge variant="secondary" className="ml-auto tabular-nums">{s.goals} gol.</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  )
}
