import { Plus, Pencil } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tournament, teams, players } from '@/lib/demo-data'
import type { Team, Player } from '@/lib/demo-data'

const placeholderPositions = ['Bramkarz', 'Napastnik']

function PlayerRow({ number, name, position }: { number: number | string; name: string; position: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-[10px] font-bold tabular-nums text-muted-foreground">
        {number}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{position}</span>
    </li>
  )
}

function TeamCard({ team }: { team: Team }) {
  const roster: Player[] = players.filter((p) => p.teamId === team.id)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-bold text-primary">
          {team.abbr}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{team.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{team.players} zawodników</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={`Edytuj drużynę ${team.name}`}>
          <Pencil className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {roster.length > 0
            ? roster.map((p) => (
                <PlayerRow key={p.id} number={p.number} name={p.name} position={p.position} />
              ))
            : placeholderPositions.map((position, i) => (
                <PlayerRow
                  key={i}
                  number="—"
                  name={`Zawodnik ${i + 1}`}
                  position={position}
                />
              ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-1 text-primary">
          <Plus className="size-3.5" /> Dodaj zawodnika
        </Button>
      </CardContent>
    </Card>
  )
}

export function AdminTeams() {
  return (
    <AdminShell
      active="teams"
      title="Drużyny"
      subtitle={`${tournament.name} · ${teams.length} drużyn`}
      actions={
        <Button>
          <Plus className="size-4" /> Dodaj drużynę
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </AdminShell>
  )
}
