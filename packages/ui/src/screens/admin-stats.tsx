import { Goal, Trophy } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tournament, standings, scorers } from '@/lib/demo-data'

// Agregaty liczone on-read z istniejących danych demo.
const totalGoals = standings.reduce((sum, r) => sum + r.gf, 0)
const playedMatches = standings.reduce((sum, r) => sum + r.p, 0) / 2
const yellowCards = 34
const avgGoals = playedMatches > 0 ? totalGoals / playedMatches : 0

const metrics = [
  { label: 'Rozegrane mecze', value: playedMatches.toString() },
  { label: 'Bramki łącznie', value: totalGoals.toString() },
  { label: 'Średnia bramek na mecz', value: avgGoals.toFixed(1).replace('.', ',') },
  { label: 'Żółte kartki', value: yellowCards.toString() },
]

// Najskuteczniejsze drużyny — top 5 wg bramek zdobytych.
const topScoring = [...standings].sort((a, b) => b.gf - a.gf).slice(0, 5)
const maxGf = Math.max(...topScoring.map((r) => r.gf))

export function AdminStats() {
  return (
    <AdminShell active="stats" title="Statystyki" subtitle={tournament.name}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-2xl font-bold">{m.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Goal className="size-4 text-primary" /> Najlepsi strzelcy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {scorers.map((s) => (
                <li key={s.pos} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold">
                    {s.pos}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.player}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.team.name}</span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {s.goals} gol{s.goals === 1 ? '' : 'e'}
                  </Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" /> Najskuteczniejsze drużyny
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {topScoring.map((r) => (
                <li key={r.team.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="grid size-6 place-items-center rounded bg-muted text-[10px] font-bold">
                        {r.team.abbr}
                      </span>
                      {r.team.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{r.gf} bramek</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${maxGf > 0 ? (r.gf / maxGf) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
