import { Plus, Save } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fixtures } from '@/lib/demo-data'
import type { MatchEvent, MatchStatus } from '@/lib/demo-data'

const match = fixtures[0]

const statusOptions: { value: MatchStatus; label: string; variant: 'default' | 'secondary' | 'outline' }[] = [
  { value: 'finished', label: 'Zakończony', variant: 'default' },
  { value: 'live', label: 'Trwa', variant: 'secondary' },
  { value: 'scheduled', label: 'Zaplanowany', variant: 'outline' },
]

const eventMeta: Record<MatchEvent['type'], { emoji: string; label: string }> = {
  goal: { emoji: '⚽', label: 'Gol' },
  yellow: { emoji: '🟨', label: 'Żółta kartka' },
  red: { emoji: '🟥', label: 'Czerwona kartka' },
}

function TeamSide({ abbr, name }: { abbr: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10 font-bold">{abbr}</div>
      <div className="text-sm font-medium">{name}</div>
    </div>
  )
}

export function AdminMatchResult() {
  return (
    <AdminShell
      active="schedule"
      title="Wynik meczu"
      subtitle={`Kolejka ${match.round} · ${match.date} · ${match.kickoff} · ${match.venue}`}
    >
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="flex flex-col items-center gap-6 py-4">
            <div className="flex items-center justify-center gap-6">
              <TeamSide abbr={match.home.abbr} name={match.home.name} />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  defaultValue={match.homeScore ?? undefined}
                  aria-label={`Wynik ${match.home.name}`}
                  className="h-16 w-16 text-center text-3xl font-bold"
                />
                <span className="text-3xl font-bold text-muted-foreground">:</span>
                <Input
                  type="number"
                  min={0}
                  defaultValue={match.awayScore ?? undefined}
                  aria-label={`Wynik ${match.away.name}`}
                  className="h-16 w-16 text-center text-3xl font-bold"
                />
              </div>
              <TeamSide abbr={match.away.abbr} name={match.away.name} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {statusOptions.map((s) => (
                <Badge
                  key={s.value}
                  variant={s.value === match.status ? s.variant : 'outline'}
                  className="cursor-pointer"
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zdarzenia</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm">
                <Plus /> Dodaj
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {(match.events ?? []).map((e, i) => {
              const meta = eventMeta[e.type]
              return (
                <div key={i} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                  <span className="text-base leading-none">{meta.emoji}</span>
                  <span className="flex-1 text-sm">
                    {meta.label} · {e.playerName}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">{e.minute}'</span>
                </div>
              )
            })}
            <p className="mt-2 text-xs text-muted-foreground">
              Typy zdarzeń zależą od sportu (piłka: gol, kartka; kosz: punkty, faul).
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline">Anuluj</Button>
        <Button>
          <Save /> Zapisz
        </Button>
      </div>
    </AdminShell>
  )
}
